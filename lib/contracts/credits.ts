import { z } from "zod";

/**
 * 크레딧 계약 — contract-first 단일 소스 (오케스트레이터 승인 없이 변경 금지).
 *
 * 베타 정책(오케스트레이터 확정):
 *   - 크레딧은 **표시용**이다. 잔액이 0 이하여도 발신을 차단하지 않는다(가격 미정, 설문 측정 중).
 *   - 가입 보너스 120 크레딧(SIGNUP_GRANT), COMPLETED 된 SCHEDULE 콜 1건당 1 크레딧 차감
 *     (CALL_DEDUCT). CONSENT 콜·MISSED 는 무차감.
 *
 * ui 레인은 기존 MOCK_CREDITS=120 상수 대신 이 파일의 CREDIT_SIGNUP_GRANT / CreditBalance 를
 * 참조한다(단일 소스).
 */

/** 가입 보너스 크레딧 — 기존 UI MOCK_CREDITS 와 동일 값(단일 소스). */
export const CREDIT_SIGNUP_GRANT = 120;

/** 원장(ledger) 엔트리 사유. SIGNUP_GRANT/CALL_DEDUCT 는 시스템, ADJUST 는 수동 보정 여지. */
export const CREDIT_REASONS = ["SIGNUP_GRANT", "CALL_DEDUCT", "ADJUST"] as const;
export type CreditReason = (typeof CREDIT_REASONS)[number];

/**
 * credit_ledger 행 계약 — supabase/migrations/0009_credit_ledger.sql 과 1:1.
 *   - delta: 가감분(양수=적립, 음수=차감). SIGNUP_GRANT=+120, CALL_DEDUCT=-1.
 *   - call_session_id: CALL_DEDUCT 만 채운다(멱등 partial unique 키). 그 외 null.
 */
export const creditLedgerEntrySchema = z.object({
  id: z.string().uuid(),
  guardian_id: z.string().uuid(),
  delta: z.number().int(),
  reason: z.enum(CREDIT_REASONS),
  call_session_id: z.string().uuid().nullable(),
  created_at: z.string(),
});
export type CreditLedgerEntry = z.infer<typeof creditLedgerEntrySchema>;

/** 잔액 응답 계약 — 서버 액션 getMyCredits() 반환, ui CreditBadge/billing 이 참조. */
export type CreditBalance = { balance: number };
