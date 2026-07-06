import { z } from "zod";

/**
 * CTA 추적 계약 — contract-first 단일 소스 (오케스트레이터 승인 없이 변경 금지).
 * ui: 이 스키마 타입으로 fetch 바디 구성 / data: 이 스키마로 검증·저장.
 *
 * API 계약:
 *   POST /api/cta      body: CtaEventInput  → 204 (성공/VIEW 중복 무시) | 400 (검증 실패)
 *   POST /api/waitlist body: WaitlistInput  → 201 { ok: true } (이메일 중복도 성공 처리) | 400
 */

export const CTA_EVENT_TYPES = [
  "VIEW",
  "CLICK_SUBSCRIBE",
  "CLICK_TRY",
  "WAITLIST_SUBMIT",
] as const;
export type CtaEventType = (typeof CTA_EVENT_TYPES)[number];

export const utmSchema = z.object({
  utm_source: z.string().max(100).nullish(),
  utm_medium: z.string().max(100).nullish(),
  utm_campaign: z.string().max(100).nullish(),
});
export type Utm = z.infer<typeof utmSchema>;

export const ctaEventInputSchema = utmSchema.extend({
  type: z.enum(CTA_EVENT_TYPES),
  session_uuid: z.string().uuid(),
});
export type CtaEventInput = z.infer<typeof ctaEventInputSchema>;

export const waitlistInputSchema = utmSchema.extend({
  email: z.string().email().max(255),
  session_uuid: z.string().uuid(),
});
export type WaitlistInput = z.infer<typeof waitlistInputSchema>;
