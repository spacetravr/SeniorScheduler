import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "@/lib/supabase/admin";
import { selectEmailBackend } from "@/lib/email";
import { weeklyWindowKst, composeWeeklyDigest } from "@/lib/reports/weekly";
import type { ReportItem } from "@/lib/reports/summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/cron/weekly-report  (매주 월요일 09:00 KST GitHub Actions cron 이 호출)
 *
 * notify_weekly_summary=true 인 보호자에게 지난 7일(KST) 통화 리포트 요약 메일을 발송한다.
 * 인증: Authorization: Bearer ${CRON_SECRET} (dispatch-calls 라우트와 동일). 미설정/불일치 → 401.
 * 서버 write/read 는 admin(secret key, RLS 우회). 시간대(CLAUDE.md): 집계 경계는 weeklyWindowKst
 * 가 Asia/Seoul 명시로 계산.
 *
 * RESEND_API_KEY 미설정 시 DisabledAdapter 가 발송을 skip 하므로(무해) 워크플로는 상시 활성 가능.
 * PII: 수신 이메일 주소는 로그에 남기지 않는다.
 * 가드레일 1: 메일 본문 하단에 의료 조언 미제공 고지(MEDICAL_DISCLAIMER) 고정 포함(composeWeeklyDigest).
 */

/** guardian.id → 그 보호자의 이번 주 ReportItem[] (senior_id 경유 그룹핑). */
async function loadWeeklyItemsByGuardian(
  supabase: SupabaseClient,
  guardianIds: string[],
  startIso: string,
  endIso: string,
): Promise<Map<string, ReportItem[]>> {
  const byGuardian = new Map<string, ReportItem[]>();
  for (const id of guardianIds) byGuardian.set(id, []);

  // 대상 보호자들의 seniors → seniorId 별 {이름, 소속 보호자}.
  const { data: seniorRows, error: sErr } = await supabase
    .from("seniors")
    .select("id, name, guardian_id")
    .in("guardian_id", guardianIds);
  if (sErr) {
    console.error("[weekly] seniors:", sErr.code, sErr.message);
    return byGuardian;
  }
  const seniorInfo = new Map<string, { name: string; guardianId: string }>();
  for (const s of seniorRows ?? []) {
    seniorInfo.set(s.id as string, {
      name: (s.name as string) ?? "",
      guardianId: s.guardian_id as string,
    });
  }
  const seniorIds = Array.from(seniorInfo.keys());
  if (seniorIds.length === 0) return byGuardian;

  // 지난 7일 리포트 + 세션(senior_id, 일정 제목). CONSENT 콜은 리포트가 없으므로 자연히 제외.
  const { data: reportRows, error: rErr } = await supabase
    .from("call_reports")
    .select(
      "id, session_id, adherence_status, summary, mood_flag, health_flag, created_at, " +
        "call_sessions!inner(senior_id, schedule_id, schedules(title))",
    )
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .in("call_sessions.senior_id", seniorIds);
  if (rErr) {
    console.error("[weekly] reports:", rErr.code, rErr.message);
    return byGuardian;
  }

  // 임베드 select 문자열은 supabase-js 타입 추론을 무력화하므로 로컬 타입으로 캐스팅.
  type ReportRow = {
    id: string;
    session_id: string | null;
    adherence_status: string;
    summary: string | null;
    mood_flag: boolean | null;
    health_flag: boolean | null;
    created_at: string;
    call_sessions: unknown;
  };

  for (const row of (reportRows ?? []) as unknown as ReportRow[]) {
    // PostgREST 임베드는 단일 관계도 객체/배열로 올 수 있어 방어적으로 정규화.
    const session = Array.isArray(row.call_sessions)
      ? (row.call_sessions as unknown[])[0]
      : row.call_sessions;
    const sess = (session ?? {}) as {
      senior_id?: string;
      schedules?: { title?: string } | { title?: string }[] | null;
    };
    const seniorId = sess.senior_id;
    if (!seniorId) continue;
    const info = seniorInfo.get(seniorId);
    if (!info) continue;

    const sched = Array.isArray(sess.schedules) ? sess.schedules[0] : sess.schedules;
    const title = (sched?.title as string | undefined) ?? "";

    const item: ReportItem = {
      id: row.id as string,
      sessionId: (row.session_id as string) ?? null,
      createdAt: row.created_at as string,
      status: row.adherence_status as ReportItem["status"],
      summary: (row.summary as string) ?? "",
      moodFlag: Boolean(row.mood_flag),
      healthFlag: Boolean(row.health_flag),
      seniorName: info.name,
      title,
    };
    byGuardian.get(info.guardianId)?.push(item);
  }

  return byGuardian;
}

/** guardian 수신 이메일 — guardians.email 우선, 없으면 auth.users 조회(서비스 롤). */
async function resolveRecipient(
  supabase: SupabaseClient,
  guardianId: string,
  guardianEmail: string | null,
): Promise<string | null> {
  if (guardianEmail && guardianEmail.length > 0) return guardianEmail;
  try {
    const { data, error } = await supabase.auth.admin.getUserById(guardianId);
    if (error) {
      console.error("[weekly] getUserById:", error.message);
      return null;
    }
    return data.user?.email ?? null;
  } catch (e) {
    console.error("[weekly] getUserById unexpected:", e instanceof Error ? e.name : "error");
    return null;
  }
}

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[weekly] CRON_SECRET 미설정");
    return NextResponse.json({ error: "not_configured" }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getAdminClient();
  const now = new Date();
  const { startIso, endIso } = weeklyWindowKst(now);

  // 주간 요약 수신 보호자 조회.
  const { data: gRows, error: gErr } = await supabase
    .from("guardians")
    .select("id, email")
    .eq("notify_weekly_summary", true);
  if (gErr) {
    console.error("[weekly] guardians:", gErr.code, gErr.message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }
  const guardians = (gRows ?? []) as { id: string; email: string | null }[];
  if (guardians.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, skipped: 0, failed: 0 });
  }

  const itemsByGuardian = await loadWeeklyItemsByGuardian(
    supabase,
    guardians.map((g) => g.id),
    startIso,
    endIso,
  );

  const email = selectEmailBackend();
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const g of guardians) {
    const items = itemsByGuardian.get(g.id) ?? [];
    const digest = composeWeeklyDigest(items);
    if (!digest) {
      // 이번 주 리포트 없음 — 발송 대상 아님.
      skipped += 1;
      continue;
    }
    const to = await resolveRecipient(supabase, g.id, g.email);
    if (!to) {
      // 수신 주소 없음 — 주소는 로그하지 않는다(PII).
      console.warn("[weekly] 수신 이메일 없음 — skip");
      skipped += 1;
      continue;
    }
    const res = await email.send({ to, subject: digest.subject, text: digest.text });
    if (res.skipped) {
      skipped += 1;
    } else if (res.ok) {
      sent += 1;
    } else {
      failed += 1;
    }
  }

  return NextResponse.json({ ok: true, sent, skipped, failed });
}
