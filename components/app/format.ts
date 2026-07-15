/**
 * 표시 전용 포맷 헬퍼 — 임의 오프셋의 ISO 문자열(+00:00 UTC이든 +09:00이든)을
 * 항상 KST(Asia/Seoul)로 변환해 표기한다. Supabase REST는 timestamptz를 UTC(+00:00)로
 * 반환하므로 문자열 슬라이싱 대신 date-fns-tz의 formatInTimeZone으로 명시 변환한다.
 * (같은 순간이면 입력 오프셋과 무관하게 동일한 KST 표기가 나와야 함)
 */
import { formatInTimeZone } from "date-fns-tz";

const KST = "Asia/Seoul";

/** ISO(임의 오프셋) → KST "7월 6일" (앞 0 없이) */
export function fmtDate(iso: string): string {
  const month = Number(formatInTimeZone(iso, KST, "M"));
  const day = Number(formatInTimeZone(iso, KST, "d"));
  return `${month}월 ${day}일`;
}

/** ISO(임의 오프셋) → KST "09:00" */
export function fmtTime(iso: string): string {
  return formatInTimeZone(iso, KST, "HH:mm");
}

/** ISO(임의 오프셋) → KST "7월 6일 09:00" */
export function fmtDateTime(iso: string): string {
  return `${fmtDate(iso)} ${fmtTime(iso)}`;
}

/** ISO(임의 오프셋) → KST 달력 날짜 "yyyy-MM-dd" (버킷 키·집계용) */
export function kstYmd(iso: string): string {
  return formatInTimeZone(iso, KST, "yyyy-MM-dd");
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
