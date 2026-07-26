/**
 * 주간 리포트 다이제스트 — /api/cron/weekly-report 가 사용하는 순수 헬퍼.
 * 시간대(CLAUDE.md): 모든 경계 계산은 date-fns-tz Asia/Seoul 명시. 암묵적 UTC/로컬 금지.
 */
import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { MEDICAL_DISCLAIMER } from "@/lib/contracts/domain";
import { buildReportSummary, periodLabel, type ReportItem } from "@/lib/reports/summary";

const KST = "Asia/Seoul";

/**
 * 주간 집계 윈도우 — 오늘(KST) 이전의 "지난 7일"(완전한 7개 KST 달력일).
 * 월요일 09:00 실행 시 직전 월~일 주간을 정확히 커버한다.
 *   start = KST 00:00 (오늘-7일), end = KST 00:00 (오늘) → 반개구간 [start, end).
 * 반환은 UTC ISO(Supabase timestamptz 필터용).
 */
export function weeklyWindowKst(now: Date): { startIso: string; endIso: string } {
  const todayYmd = formatInTimeZone(now, KST, "yyyy-MM-dd");
  const start7Ymd = addDaysYmd(todayYmd, -7);
  const startIso = fromZonedTime(`${start7Ymd}T00:00:00`, KST).toISOString();
  const endIso = fromZonedTime(`${todayYmd}T00:00:00`, KST).toISOString();
  return { startIso, endIso };
}

/** "YYYY-MM-DD" 문자열 달력 가감(정오 앵커로 DST/TZ 영향 배제). */
function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

/**
 * 주간 다이제스트 제목/본문 생성. items 가 비면 null(발송 대상 아님).
 * 본문은 buildReportSummary(WEEK) 재사용 + 마지막에 정식 고지 문구(MEDICAL_DISCLAIMER) 부착.
 * (가드레일 1 — 리포트 UI 와 동일 고지. buildReportSummary 의 짧은 요약 라인은 그대로 두고,
 *  법적 고지는 도메인 상수로 최종 고정.)
 */
export function composeWeeklyDigest(
  items: ReportItem[],
): { subject: string; text: string } | null {
  if (items.length === 0) return null;

  const ymds = items.map((i) => i.createdAt).map((iso) => formatInTimeZone(iso, KST, "yyyy-MM-dd"));
  const period = periodLabel("WEEK", ymds);
  const subject = `[주간 리포트] ${period}`;
  const text = `${buildReportSummary("WEEK", items)}\n\n${MEDICAL_DISCLAIMER}`;
  return { subject, text };
}
