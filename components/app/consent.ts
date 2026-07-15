/**
 * 피보호자 동의 상태 판정 (순수 함수 — 표시 전용).
 *
 * 전기통신사업법 자동발신 대응으로 동의는 2단계다:
 *  1) 보호자 대리동의(consent_at) — 등록 폼 체크박스.
 *  2) 부모님 본인 동의(self_consent_at) — 첫 "동의 콜"에서 본인이 직접 승낙.
 *
 * 주의: 실 DB에 self_consent_at 컬럼이 아직 없을 수 있어(0003 마이그레이션 대기)
 * 조회 결과에서 undefined 로 올 수 있다 → nullish 안전 처리(!값)로 "본인 동의 대기" 취급.
 */
import type { Senior } from "@/lib/contracts/domain";

export type ConsentStatus = "NONE" | "SELF_PENDING" | "DONE";

/** consent_at / self_consent_at 만으로 판정 (undefined·null 모두 미동의로 처리). */
export function getConsentStatus(
  senior: Pick<Senior, "consent_at" | "self_consent_at">,
): ConsentStatus {
  if (!senior.consent_at) return "NONE";
  if (!senior.self_consent_at) return "SELF_PENDING";
  return "DONE";
}

export const consentStatusLabel: Record<ConsentStatus, string> = {
  NONE: "동의 필요",
  SELF_PENDING: "본인 동의 대기",
  DONE: "동의 완료",
};

/** SELF_PENDING 상태에서 카드에 함께 보여줄 짧은 안내 (존댓말, 의료 뉘앙스 없음). */
export const SELF_CONSENT_PENDING_HINT =
  "첫 통화(동의 콜)에서 부모님께 직접 동의를 여쭙습니다. 부모님이 동의하시면 일정 전화가 시작됩니다.";
