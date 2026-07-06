/**
 * 표시 전용 포맷 헬퍼 — KST ISO 문자열("2026-07-06T09:00:00+09:00")을
 * 문자열 슬라이싱만으로 변환한다. Date 연산 금지(Phase 1 규칙).
 */

/** "2026-07-06T09:00:00+09:00" → "7월 6일" */
export function fmtDate(iso: string): string {
  const month = Number(iso.slice(5, 7));
  const day = Number(iso.slice(8, 10));
  return `${month}월 ${day}일`;
}

/** "2026-07-06T09:00:00+09:00" → "09:00" */
export function fmtTime(iso: string): string {
  return iso.slice(11, 16);
}

/** "2026-07-06T09:00:00+09:00" → "7월 6일 09:00" */
export function fmtDateTime(iso: string): string {
  return `${fmtDate(iso)} ${fmtTime(iso)}`;
}

/** 요일 정규 순서 (BYDAY 입력 순서와 무관하게 이 순서로 표시) */
const RRULE_DAY_ORDER = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
const RRULE_DAY_LABEL: Record<string, string> = {
  MO: "월",
  TU: "화",
  WE: "수",
  TH: "목",
  FR: "금",
  SA: "토",
  SU: "일",
};

/** RRULE 문자열을 한국어 반복 설명으로 (표시 전용) */
export function fmtRrule(rrule: string): string {
  if (rrule.includes("FREQ=DAILY")) return "매일";
  const byday = rrule.match(/BYDAY=([A-Z,]+)/)?.[1];
  if (!byday) return "매주";
  const days = byday.split(",");
  if (
    days.length === 5 &&
    ["MO", "TU", "WE", "TH", "FR"].every((d) => days.includes(d))
  ) {
    return "주중 (월~금)";
  }
  if (days.length === 2 && days.includes("SA") && days.includes("SU")) {
    return "주말 (토·일)";
  }
  const ordered = RRULE_DAY_ORDER.filter((d) => days.includes(d));
  const labels = ordered.length ? ordered : days;
  return `매주 ${labels.map((d) => RRULE_DAY_LABEL[d] ?? d).join("·")}`;
}
