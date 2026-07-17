/**
 * 통화 기록 기간 필터 — 순수 함수 (KST 날짜 경계 기준).
 * 목록이 너무 길어 기본은 "최근 3일"만 노출한다. 필터링은 항상 KST 달력 날짜(yyyy-MM-dd)
 * 문자열 비교로 수행한다 (암묵적 로컬 타임존 의존 금지).
 */
import { formatInTimeZone } from "date-fns-tz";

const KST = "Asia/Seoul";

/** 기간 옵션. days=null은 "전체"(제한 없음). */
export type PeriodKey = "3D" | "7D" | "ALL";

export const PERIOD_OPTIONS: { key: PeriodKey; label: string; days: number | null }[] = [
  { key: "3D", label: "최근 3일", days: 3 },
  { key: "7D", label: "최근 7일", days: 7 },
  { key: "ALL", label: "전체", days: null },
];

/**
 * 오늘(KST yyyy-MM-dd)을 포함해 `days`일 창의 시작 경계 날짜(포함)를 반환한다.
 * 예: today=2026-07-17, days=3 → 2026-07-15 (15·16·17 3일).
 * 정오(12:00 KST) 앵커로 날짜 산술 → 경계/DST 흔들림 방지.
 */
export function periodCutoffYmd(todayYmd: string, days: number): string {
  const anchor = new Date(`${todayYmd}T12:00:00+09:00`);
  anchor.setUTCDate(anchor.getUTCDate() - (days - 1));
  return formatInTimeZone(anchor, KST, "yyyy-MM-dd");
}

/**
 * `sessionYmd`(KST yyyy-MM-dd)가 기간 창 안에 드는지 판정.
 * days=null(전체)이면 항상 true. 문자열 사전식 비교(yyyy-MM-dd는 안전).
 */
export function isWithinPeriod(
  sessionYmd: string,
  todayYmd: string,
  days: number | null,
): boolean {
  if (days == null) return true;
  return sessionYmd >= periodCutoffYmd(todayYmd, days);
}
