import { NextResponse } from "next/server";
import type { Senior, Schedule } from "@/lib/contracts/domain";
import { getAdminClient } from "@/lib/supabase/admin";
import { instanceOnKstDate, kstDateOf } from "@/lib/scheduling/occurrences";
import { canDispatchScheduleCall, canDispatchConsentCall } from "@/lib/calls/state-machine";
import { isConsentSessionDue } from "@/lib/calls/consent-scheduling";
import { runScheduleCall, runConsentCall } from "@/lib/calls/run-call";
import { MockAdapter } from "@/lib/telephony/mock-adapter";
import { createLlmClient } from "@/lib/ai/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/cron/dispatch-calls  (5분 주기 GitHub Actions cron 이 호출)
 *
 * 동작:
 *   (1) SCHEDULE 콜: 현재 KST 시각 ±5분 윈도우에 발신 예정인 활성 일정을 찾아 MockAdapter 로
 *       통화를 실행하고 call_sessions/turns/reports 를 기록한다.
 *   (2) CONSENT 콜: seniors Server Action 이 예약한 due(SCHEDULED·scheduled_at<=now) 동의
 *       세션을 runConsentCall 로 실행하고, 성사 시 seniors.self_consent_at 을 기록한다.
 *   - 인증: Authorization: Bearer ${CRON_SECRET}
 *   - 서버 write 는 admin(secret key, RLS 우회) — no-store fetch 규칙은 admin.ts 가 보장.
 *   - 발신 가드(가드레일 5): SCHEDULE 은 consent_at && self_consent_at 둘 다,
 *     CONSENT 는 consent_at 있고 self_consent_at 없을 때만(본인동의를 받으러 가는 콜).
 *   - 중복 방지: SCHEDULE 은 같은 schedule_id + 동일 scheduled_at 세션 존재 시 스킵.
 *     CONSENT 는 예약 단계(seniors.ts)에서 열린 세션 1개로 제한(0004 부분 unique).
 *
 * 시간대(CLAUDE.md): 발생 시각 계산은 lib/scheduling/occurrences.ts(Asia/Seoul 명시).
 */

const WINDOW_MS = 5 * 60 * 1000; // ±5분

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[dispatch] CRON_SECRET 미설정");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

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
  if (schedules.length === 0) {
    return NextResponse.json({ dispatched: 0, skipped: 0, due: 0 });
  }

  const seniorIds = Array.from(new Set(schedules.map((s) => s.senior_id)));
  const { data: seniorRows, error: seniorErr } = await supabase
    .from("seniors")
    .select("id, name, phone, relationship, birth_year, consent_at, consent_by, self_consent_at, created_at")
    .in("id", seniorIds);
  if (seniorErr) {
    console.error("[dispatch] seniors:", seniorErr.code, seniorErr.message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  const seniorById = new Map((seniorRows ?? []).map((s) => [s.id, s as Senior]));

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
      // unique 경합(다른 tick 동시 실행) 등은 스킵 처리.
      console.error("[dispatch] session insert:", insErr?.code, insErr?.message);
      skipped += 1;
      continue;
    }
    const sessionId = created.id as string;

    // 통화 실행(Mock).
    const result = await runScheduleCall({
      sessionId,
      senior,
      schedule,
      adapter: new MockAdapter(),
      llm: createLlmClient(),
      clock: () => new Date(now.getTime()),
    });

    // 세션 종료 상태 반영.
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

    // 턴 저장(있으면).
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

    // 리포트 저장.
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

  // ── CONSENT(본인 동의) 콜 디스패치 ─────────────────────────────────────────────
  // seniors Server Action 이 예약한 due(SCHEDULED · scheduled_at<=now) CONSENT 세션을
  // 동의 콜 엔진(runConsentCall)으로 실행한다. 상태 기계·재시도(1분/10분→MISSED)는 엔진이
  // 관장하며, 성사 시 seniors.self_consent_at 을 여기서 기록한다(엔진은 부수효과 없음).
  let consentDispatched = 0;
  let consentSkipped = 0;
  let consentDue = 0;

  const { data: consentRows, error: consentErr } = await supabase
    .from("call_sessions")
    .select("id, senior_id, status, scheduled_at, attempt")
    .eq("purpose", "CONSENT")
    .eq("status", "SCHEDULED")
    .lte("scheduled_at", now.toISOString());
  if (consentErr) {
    console.error("[dispatch] consent sessions:", consentErr.code, consentErr.message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const consentSessions = consentRows ?? [];
  if (consentSessions.length > 0) {
    // due 세션들의 senior 를 일괄 로드.
    const cSeniorIds = Array.from(new Set(consentSessions.map((r) => r.senior_id as string)));
    const { data: cSeniorRows, error: cSeniorErr } = await supabase
      .from("seniors")
      .select(
        "id, name, phone, relationship, birth_year, consent_at, consent_by, self_consent_at, created_at",
      )
      .in("id", cSeniorIds);
    if (cSeniorErr) {
      console.error("[dispatch] consent seniors:", cSeniorErr.code, cSeniorErr.message);
      return NextResponse.json({ error: "query_failed" }, { status: 500 });
    }
    const cSeniorById = new Map((cSeniorRows ?? []).map((s) => [s.id, s as Senior]));

    for (const session of consentSessions) {
      // 순수 due 판정(쿼리로 이미 좁혔지만 경계·상태를 명시적으로 재확인).
      if (!isConsentSessionDue({ status: session.status, scheduled_at: session.scheduled_at }, now)) {
        continue;
      }
      consentDue += 1;

      const senior = cSeniorById.get(session.senior_id as string);
      // 발신 가드(가드레일 5): CONSENT 콜은 대리동의 있음 && 본인동의 없음일 때만.
      // (이미 본인동의를 받았거나 대리동의가 철회됐으면 스킵 — 세션은 그대로 둔다.)
      if (!senior || !canDispatchConsentCall(senior)) {
        consentSkipped += 1;
        continue;
      }

      const sessionId = session.id as string;
      const result = await runConsentCall({
        sessionId,
        senior,
        adapter: new MockAdapter(),
        clock: () => new Date(now.getTime()),
      });

      // 세션 종료 상태 반영(cost_krw 포함).
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

      // 턴 저장(있으면). CONSENT 콜은 리포트를 만들지 않는다(일정 이행 판정 대상 아님).
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

      // 본인 동의 성사 → seniors.self_consent_at 기록(엔진이 판정, 기록은 라우트 몫).
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
    dispatched,
    skipped,
    due,
    consentDispatched,
    consentSkipped,
    consentDue,
  });
}
