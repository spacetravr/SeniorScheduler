/**
 * 다이제스트 표시 보조 순수 함수 (리포트·대시보드 공용).
 *
 * buildDigest(lib/reports/digest.ts) 가 만든 tone 을 **재계산하지 않는다** — 표시 레이어에서
 * 필요한 최소한의 보정(연속 불발 승격)과 라벨 생성만 담당한다. 집계·판정의 단일 소스는 여전히
 * buildDigest 다 (docs/report-spec.md).
 */
import type { DigestTone } from "@/lib/contracts/report-view";

/**
 * 3회 연속 불발(missedStreak) 이 있으면 톤을 ALERT 로 승격한다.
 * 근거: 단발 MISSED 는 ALERT 로 올리지 않지만(오경보 관리), **연속** 불발은 사람이 직접
 * 확인해야 하는 신호다(THIRD-PLAN P0-4). 승격만 하고 강등은 절대 하지 않는다.
 */
export function escalateTone(tone: DigestTone, hasMissedStreak: boolean): DigestTone {
  return hasMissedStreak ? "ALERT" : tone;
}

/** 스파크라인 aria-label — 값이 없는 날은 "기록 없음"으로 읽어 준다(0% 오해 방지). */
export function sparklineLabel(trend: (number | null)[]): string {
  if (trend.length === 0) return "표시할 추이가 없습니다";
  const parts = trend.map((v, i) => {
    const nth = `${i + 1}번째`;
    return v === null ? `${nth} 기록 없음` : `${nth} ${v}%`;
  });
  return `최근 ${trend.length}일 이행률 추이 — ${parts.join(", ")}`;
}

/** 스파크라인 막대 높이(%) — null 이나 0 도 눈에 보이도록 최소 높이를 준다. */
export function sparklineHeight(value: number | null): number {
  if (value === null) return 6;
  return Math.max(value, 8);
}

/** tel: 링크용 번호 정규화 (하이픈·공백 제거). 빈 문자열이면 null. */
export function telHref(phone: string): string | null {
  const digits = phone.replace(/[^0-9+]/g, "");
  return digits.length > 0 ? `tel:${digits}` : null;
}
