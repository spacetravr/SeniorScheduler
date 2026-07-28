import "server-only";
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { getAdminClient } from "@/lib/supabase/admin";
import { buildDigest, type DigestInput } from "@/lib/reports/digest";
import { renderReportEmail } from "@/lib/reports/render/email";
import { renderReportAlimtalk } from "@/lib/reports/render/alimtalk";
import { reportLinks } from "@/lib/notify/links";
import { parseNotifyLevel, routeNotify } from "@/lib/notify";
import { createSupabaseNotifyDedupe } from "@/lib/notify/dedupe";
import type { NotifyResult } from "@/lib/contracts/notify";

/**
 * 예외 알림 훅 — 통화 리포트가 기록된 **직후** 호출한다(mock 동기 경로·실벤더 콜백 경로 공통).
 *
 * 동작: 그 피보호자의 **오늘(KST)** 리포트를 모아 `buildDigest("DAY")` 로 톤을 판정하고,
 * 보호자의 알림 레벨에 따라 발송 여부를 라우터가 결정한다(shouldNotify).
 * 통화 1건이 아니라 "오늘 전체"를 기준으로 판정하는 이유: 단발 MISSED 를 ALERT 로 올리지 않고,
 * 같은 날 이상이 누적됐을 때만 올리기 위함(THIRD-PLAN P0-4 오경보 관리).
 *
 * **절대 throw 하지 않는다.** 알림은 통화 파이프라인의 부수 작업이며, 실패해도 통화·리포트
 * 기록은 이미 끝나 있다. 모든 예외를 흡수하고 빈 결과를 돌려준다.
 * PII: 이메일 주소·전화번호·요약 본문은 로깅하지 않는다.
 */

const KST = "Asia/Seoul";

/** 오늘(KST) 하루의 [start, end) UTC ISO 경계 + 달력 표기. */
export function todayRangeKst(now: Date): {
  startIso: string;
  endIso: string;
  ymd: string;
} {
  const ymd = formatInTimeZone(now, KST, "yyyy-MM-dd");
  const [y, m, d] = ymd.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d, 12));
  next.setUTCDate(next.getUTCDate() + 1);
  const nextYmd = next.toISOString().slice(0, 10);
  return {
    startIso: fromZonedTime(`${ymd}T00:00:00`, KST).toISOString(),
    endIso: fromZonedTime(`${nextYmd}T00:00:00`, KST).toISOString(),
    ymd,
  };
}

type SessionRow = { id: string; purpose: string; senior_id: string };
type SeniorRow = { id: string; name: string | null; phone: string | null; guardian_id: string };
type GuardianRow = { id: string; email: string | null; notify_level?: string | null };

/**
 * @param sessionId 방금 리포트가 기록된 통화 세션 id
 * @returns 채널별 발송 결과(빈 배열 = 발송 대상 아님 또는 조기 종료)
 */
export async function notifyExceptionForSession(
  sessionId: string,
  now: Date = new Date(),
): Promise<NotifyResult[]> {
  try {
    const supabase = getAdminClient();

    const { data: sRow, error: sErr } = await supabase
      .from("call_sessions")
      .select("id, purpose, senior_id")
      .eq("id", sessionId)
      .maybeSingle();
    if (sErr || !sRow) return [];
    const session = sRow as SessionRow;
    // CONSENT(동의) 콜은 리포트 대상이 아니다.
    if (session.purpose !== "SCHEDULE") return [];

    const { data: seRow, error: seErr } = await supabase
      .from("seniors")
      .select("id, name, phone, guardian_id")
      .eq("id", session.senior_id)
      .maybeSingle();
    if (seErr || !seRow) return [];
    const senior = seRow as SeniorRow;

    const { data: gRow, error: gErr } = await supabase
      .from("guardians")
      .select("id, email, notify_level")
      .eq("id", senior.guardian_id)
      .maybeSingle();
    if (gErr || !gRow) return [];
    const guardian = gRow as GuardianRow;

    const { startIso, endIso, ymd } = todayRangeKst(now);

    // 이 피보호자의 오늘(KST) 리포트 전부 — 일정 제목은 세션 임베드로.
    const { data: rRows, error: rErr } = await supabase
      .from("call_reports")
      .select(
        "id, session_id, adherence_status, summary, mood_flag, health_flag, created_at, " +
          "call_sessions!inner(senior_id, schedules(title))",
      )
      .gte("created_at", startIso)
      .lt("created_at", endIso)
      .eq("call_sessions.senior_id", senior.id);
    if (rErr) {
      console.error("[notify/hook] reports:", rErr.code, rErr.message);
      return [];
    }

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

    const items: DigestInput[] = ((rRows ?? []) as unknown as ReportRow[]).map((row) => {
      const sess = (Array.isArray(row.call_sessions) ? row.call_sessions[0] : row.call_sessions) as {
        schedules?: { title?: string } | { title?: string }[] | null;
      } | null;
      const sched = Array.isArray(sess?.schedules) ? sess?.schedules[0] : sess?.schedules;
      return {
        id: row.id,
        sessionId: row.session_id ?? null,
        createdAt: row.created_at,
        status: row.adherence_status as DigestInput["status"],
        summary: row.summary ?? "",
        moodFlag: Boolean(row.mood_flag),
        healthFlag: Boolean(row.health_flag),
        seniorName: senior.name ?? "",
        seniorId: senior.id,
        title: sched?.title ?? "",
      };
    });
    if (items.length === 0) return [];

    const digest = buildDigest("DAY", items, { startYmd: ymd, endYmd: ymd });
    const links = reportLinks();
    const mail = renderReportEmail(digest, links);
    const talk = renderReportAlimtalk(digest, {
      reportUrl: links.reportUrl,
      seniorPhone: senior.phone,
    });

    return await routeNotify(
      {
        kind: "EXCEPTION_ALERT",
        level: parseNotifyLevel(guardian.notify_level),
        tone: digest.tone,
        // ALIMTALK 수신 번호는 보호자 번호 컬럼이 아직 없어 미지정(어댑터가 skip). 심사·컬럼 추가 후 연결.
        recipients: { EMAIL: guardian.email },
        subject: mail.subject,
        text: mail.text,
        html: mail.html,
        templateVars: talk.templateVars,
        linkUrl: links.reportUrl,
        // 하루 1회 상한 — 같은 날 이상 신호가 여러 번 생겨도 알림은 한 번만(오경보 관리).
        guardianId: guardian.id,
        now,
      },
      undefined,
      createSupabaseNotifyDedupe(supabase),
    );
  } catch (err) {
    // 알림 실패가 통화 파이프라인을 죽이지 않게 — 이름만 로깅(PII·스택 미노출).
    console.error("[notify/hook] unexpected:", err instanceof Error ? err.name : "error");
    return [];
  }
}
