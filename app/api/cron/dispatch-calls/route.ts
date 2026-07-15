import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Senior, Schedule } from "@/lib/contracts/domain";
import { getAdminClient } from "@/lib/supabase/admin";
import { instanceOnKstDate, kstDateOf } from "@/lib/scheduling/occurrences";
import { canDispatchScheduleCall, canDispatchConsentCall } from "@/lib/calls/state-machine";
import { isConsentSessionDue } from "@/lib/calls/consent-scheduling";
import { runScheduleCall, runConsentCall } from "@/lib/calls/run-call";
import { createLlmClient } from "@/lib/ai/llm";
import { selectTelephony } from "@/lib/telephony/provider";
import { TelephonyNotConfiguredError, type TelephonyAdapter } from "@/lib/telephony/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/cron/dispatch-calls  (5분 주기 GitHub Actions cron 이 호출)
 *
 * provider(TELEPHONY_PROVIDER)에 따라 두 모델로 동작:
 *   - mock(sync): 지금처럼 한 통화를 인라인으로 완주(발신→대화→분류→리포트)하고 기록한다.
 *   - clova(async): 세션 생성 → 발신 트리거 → 상태 DIALING(발신 중)으로 두고 종료. 통화 완료는
 *     콜백(/api/telephony/callback)이 담당한다. 무응답/실패 재시도는 콜백이 next_attempt_at 을
 *     예약하고, 다음 tick 이 재시도 due 세션을 집어가 다시 트리거한다.
 *
 * clova 인데 필수 설정(CLOVA_*)이 없으면 **발신을 시도하지 않고** 명확한 로그 후 skip 한다
 * (조용한 mock 폴백 금지 — 실환경에서 가짜 통화가 진짜처럼 기록되면 안 됨).
 *
 * 인증: Authorization: Bearer ${CRON_SECRET}. 서버 write 는 admin(secret key, RLS 우회).
 * 시간대(CLAUDE.md): 발생 시각 계산은 lib/scheduling/occurrences.ts(Asia/Seoul 명시).
 */

const WINDOW_MS = 5 * 60 * 1000; // ±5분

const SENIOR_COLS =
  "id, name, phone, relationship, birth_year, consent_at, consent_by, self_consent_at, created_at";

/** 비동기 발신 트리거 — 성공 시 DIALING, 실패(미설정/오류) 시 skip. */
async function triggerAsyncCall(
  supabase: SupabaseClient,
  adapter: TelephonyAdapter,
  args: { sessionId: string; seniorId: string; to: string; purpose: "SCHEDULE" | "CONSENT" },
): Promise<"triggered" | "skipped"> {
  try {
    if (!adapter.triggerCall) {
      throw new TelephonyNotConfiguredError("어댑터가 비동기 triggerCall 을 지원하지 않습니다.");
    }
    const { providerCallId } = await adapter.triggerCall({
      sessionId: args.sessionId,
      seniorId: args.seniorId,
      to: args.to,
      purpose: args.purpose,
    });
    // 발신 트리거 성공 → 발신 중. 완료/재시도는 콜백이 처리.
    // provider_call_id: 벤더 CallId — 전사 조회·CallId 역조회 상관키(0006). 없으면 미설정.
    await supabase
      .from("call_sessions")
      .update({
        status: "DIALING",
        next_attempt_at: null,
        ...(providerCallId ? { provider_call_id: providerCallId } : {}),
      })
      .eq("id", args.sessionId);
    return "triggered";
  } catch (err) {
    if (err instanceof TelephonyNotConfiguredError) {
      console.error("[dispatch] 텔레포니 미구성 — 세션 skip:", args.sessionId);
    } else {
      console.error("[dispatch] 발신 트리거 오류:", err instanceof Error ? err.name : "error");
    }
    return "skipped";
  }
}

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[dispatch] CRON_SECRET 미설정");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // 어댑터·모드 선택. clova 설정 미비 시 발신 없이 명확히 skip.
  const telephony = selectTelephony();
  if (!telephony.ok) {
    console.error(
      "[dispatch] 텔레포니 설정 미비 — 발신 skip. provider=%s missing=%s",
      telephony.provider,
      telephony.missing.join(","),
    );
    return NextResponse.json(
      { error: "telephony_not_configured", provider: telephony.provider, missing: telephony.missing },
      { status: 200 },
    );
  }
  const { adapter, mode } = telephony;

  const now = new Date();
  const todayYmd = kstDateOf(now);
  const supabase = getAdminClient();

  // 활성 일정 + 소속 senior 로드(관리자 조회, RLS 우회).
  const { data: schedRows, error: schedErr } = await supabase
    .from("schedules")
    .select("id, senior_id, type, title, script_template, call_time, rrule, active, created_at")
    .eq("active", true);
  if (schedErr) {
    console.error("[dispatch] schedules:", schedErr.code, schedErr.message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  const schedules = (schedRows ?? []) as Schedule[];

  const seniorIds = Array.from(new Set(schedules.map((s) => s.senior_id)));
  const seniorById = new Map<string, Senior>();
  if (seniorIds.length > 0) {
    const { data: seniorRows, error: seniorErr } = await supabase
      .from("seniors")
      .select(SENIOR_COLS)
      .in("id", seniorIds);
    if (seniorErr) {
      console.error("[dispatch] seniors:", seniorErr.code, seniorErr.message);
      return NextResponse.json({ error: "query_failed" }, { status: 500 });
    }
    for (const s of seniorRows ?? []) seniorById.set(s.id, s as Senior);
  }

  let dispatched = 0;
  let skipped = 0;
  let due = 0;

  for (const schedule of schedules) {
    // 오늘 KST 발생 여부 + 발신 instant.
    let inst: Date | null;
    try {
      inst = instanceOnKstDate(schedule.rrule, schedule.call_time, todayYmd);
    } catch {
      console.error("[dispatch] bad schedule:", schedule.id);
      continue;
    }
    if (!inst) continue;
    // ±5분 윈도우.
    if (Math.abs(inst.getTime() - now.getTime()) > WINDOW_MS) continue;
    due += 1;

    const senior = seniorById.get(schedule.senior_id);
    if (!senior) {
      skipped += 1;
      continue;
    }
    // 발신 가드(가드레일 5).
    if (!canDispatchScheduleCall(senior)) {
      skipped += 1;
      continue;
    }

    const scheduledAtIso = inst.toISOString();

    // 중복 방지: 같은 schedule + 동일 예정 시각 세션 존재 시 스킵.
    const { data: existing, error: exErr } = await supabase
      .from("call_sessions")
      .select("id")
      .eq("schedule_id", schedule.id)
      .eq("scheduled_at", scheduledAtIso)
      .maybeSingle();
    if (exErr) {
      console.error("[dispatch] dedup check:", exErr.code, exErr.message);
      continue;
    }
    if (existing) {
      skipped += 1;
      continue;
    }

    // 세션 생성(SCHEDULED).
    const { data: created, error: insErr } = await supabase
      .from("call_sessions")
      .insert({
        purpose: "SCHEDULE",
        schedule_id: schedule.id,
        senior_id: senior.id,
        status: "SCHEDULED",
        attempt: 1,
        scheduled_at: scheduledAtIso,
      })
      .select("id")
      .single();
    if (insErr || !created) {
      console.error("[dispatch] session insert:", insErr?.code, insErr?.message);
      skipped += 1;
      continue;
    }
    const sessionId = created.id as string;

    if (mode === "async") {
      // 실벤더: 발신만 트리거. 완료는 콜백. 미구성/오류면 방금 만든 세션을 제거(다음 tick 재시도).
      const r = await triggerAsyncCall(supabase, adapter, {
        sessionId,
        seniorId: senior.id,
        to: senior.phone,
        purpose: "SCHEDULE",
      });
      if (r === "triggered") {
        dispatched += 1;
      } else {
        await supabase.from("call_sessions").delete().eq("id", sessionId);
        skipped += 1;
      }
      continue;
    }

    // mock(sync): 한 통화를 인라인으로 완주하고 기록.
    const result = await runScheduleCall({
      sessionId,
      senior,
      schedule,
      adapter,
      llm: createLlmClient(),
      clock: () => new Date(now.getTime()),
    });

    await supabase
      .from("call_sessions")
      .update({
        status: result.status,
        attempt: result.attempt,
        started_at: result.startedAt,
        ended_at: result.endedAt,
        cost_krw: result.costKrw,
      })
      .eq("id", sessionId);

    if (result.turns.length > 0) {
      await supabase.from("call_turns").insert(
        result.turns.map((t) => ({
          session_id: sessionId,
          role: t.role,
          input_kind: t.input_kind,
          text: t.text,
          created_at: t.at,
        })),
      );
    }

    await supabase.from("call_reports").insert({
      session_id: sessionId,
      adherence_status: result.report.adherence_status,
      summary: result.report.summary,
      mood_flag: result.report.mood_flag,
      health_flag: result.report.health_flag,
      prompt_version: result.report.prompt_version,
    });

    dispatched += 1;
  }

  // ── 실벤더 SCHEDULE 재시도 스캔(async 전용) ────────────────────────────────────
  // 콜백이 예약한 재시도 due 세션(status=SCHEDULED, next_attempt_at<=now)을 다시 트리거한다.
  let retried = 0;
  if (mode === "async") {
    const { data: retryRows, error: retryErr } = await supabase
      .from("call_sessions")
      .select("id, senior_id, attempt")
      .eq("purpose", "SCHEDULE")
      .eq("status", "SCHEDULED")
      .not("next_attempt_at", "is", null)
      .lte("next_attempt_at", now.toISOString());
    if (retryErr) {
      console.error("[dispatch] retry scan:", retryErr.code, retryErr.message);
    } else if ((retryRows ?? []).length > 0) {
      const rIds = Array.from(new Set((retryRows ?? []).map((r) => r.senior_id as string)));
      const { data: rSeniors } = await supabase.from("seniors").select(SENIOR_COLS).in("id", rIds);
      const rSeniorById = new Map((rSeniors ?? []).map((s) => [s.id, s as Senior]));
      for (const row of retryRows ?? []) {
        const senior = rSeniorById.get(row.senior_id as string);
        if (!senior || !canDispatchScheduleCall(senior)) continue;
        const r = await triggerAsyncCall(supabase, adapter, {
          sessionId: row.id as string,
          seniorId: senior.id,
          to: senior.phone,
          purpose: "SCHEDULE",
        });
        if (r === "triggered") retried += 1;
      }
    }
  }

  // ── CONSENT(본인 동의) 콜 디스패치 ─────────────────────────────────────────────
  let consentDispatched = 0;
  let consentSkipped = 0;
  let consentDue = 0;

  const { data: consentRows, error: consentErr } = await supabase
    .from("call_sessions")
    .select("id, senior_id, status, scheduled_at, attempt, next_attempt_at")
    .eq("purpose", "CONSENT")
    .eq("status", "SCHEDULED")
    .lte("scheduled_at", now.toISOString());
  if (consentErr) {
    console.error("[dispatch] consent sessions:", consentErr.code, consentErr.message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const consentSessions = consentRows ?? [];
  if (consentSessions.length > 0) {
    const cSeniorIds = Array.from(new Set(consentSessions.map((r) => r.senior_id as string)));
    const { data: cSeniorRows, error: cSeniorErr } = await supabase
      .from("seniors")
      .select(SENIOR_COLS)
      .in("id", cSeniorIds);
    if (cSeniorErr) {
      console.error("[dispatch] consent seniors:", cSeniorErr.code, cSeniorErr.message);
      return NextResponse.json({ error: "query_failed" }, { status: 500 });
    }
    const cSeniorById = new Map((cSeniorRows ?? []).map((s) => [s.id, s as Senior]));

    for (const session of consentSessions) {
      if (!isConsentSessionDue({ status: session.status, scheduled_at: session.scheduled_at }, now)) {
        continue;
      }
      // async 재시도 지연 존중: next_attempt_at 이 미래면 아직 재시도 시점 아님.
      const nextAt = session.next_attempt_at as string | null;
      if (mode === "async" && nextAt != null && Date.parse(nextAt) > now.getTime()) {
        continue;
      }
      consentDue += 1;

      const senior = cSeniorById.get(session.senior_id as string);
      // 발신 가드(가드레일 5): CONSENT 콜은 대리동의 있음 && 본인동의 없음일 때만.
      if (!senior || !canDispatchConsentCall(senior)) {
        consentSkipped += 1;
        continue;
      }

      const sessionId = session.id as string;

      if (mode === "async") {
        const r = await triggerAsyncCall(supabase, adapter, {
          sessionId,
          seniorId: senior.id,
          to: senior.phone,
          purpose: "CONSENT",
        });
        if (r === "triggered") consentDispatched += 1;
        else consentSkipped += 1;
        continue;
      }

      // mock(sync): 동의 콜 인라인 완주 + self_consent_at 기록.
      const result = await runConsentCall({
        sessionId,
        senior,
        adapter,
        clock: () => new Date(now.getTime()),
      });

      await supabase
        .from("call_sessions")
        .update({
          status: result.status,
          attempt: result.attempt,
          started_at: result.startedAt,
          ended_at: result.endedAt,
          cost_krw: result.costKrw,
        })
        .eq("id", sessionId);

      if (result.turns.length > 0) {
        await supabase.from("call_turns").insert(
          result.turns.map((t) => ({
            session_id: sessionId,
            role: t.role,
            input_kind: t.input_kind,
            text: t.text,
            created_at: t.at,
          })),
        );
      }

      if (result.consentGranted && result.endedAt) {
        const { error: upErr } = await supabase
          .from("seniors")
          .update({ self_consent_at: result.endedAt })
          .eq("id", senior.id);
        if (upErr) {
          console.error("[dispatch] self_consent update:", upErr.code, upErr.message);
        }
      }

      consentDispatched += 1;
    }
  }

  return NextResponse.json({
    provider: telephony.provider,
    mode,
    dispatched,
    skipped,
    due,
    retried,
    consentDispatched,
    consentSkipped,
    consentDue,
  });
}
