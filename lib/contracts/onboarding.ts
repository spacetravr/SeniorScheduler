import { z } from "zod";

/**
 * 온보딩 프로필 계약 — contract-first 단일 소스 (오케스트레이터 승인 없이 변경 금지).
 *
 * 목적: 앱 첫 진입 시 대시보드 앞단에서 받는 짧은 신상 조사(2스텝·5문항).
 *  1) 서비스 개인화 — 기본 통화 시간대·첫 일정 추천의 입력값
 *  2) 세그먼트 분석 — 거주 거리 × 최우선 걱정 (MARKETING-PLAN Phase 0 / 베타 초대 우선순위)
 * 전부 선택 입력이며 건너뛰기 가능. 민감정보(질병명·상세 병력) 수집 금지 — 걱정 카테고리까지만.
 *
 * DB: guardians 테이블 확장 컬럼(0010 마이그레이션)과 1:1. 값은 전부 nullable.
 */

// ── STEP 1: 보호자(자녀) 본인 ──
export const GUARDIAN_AGE_BANDS = ["20s", "30s", "40s", "50s", "60s+"] as const;
export type GuardianAgeBand = (typeof GUARDIAN_AGE_BANDS)[number];
export const guardianAgeBandLabel: Record<GuardianAgeBand, string> = {
  "20s": "20대",
  "30s": "30대",
  "40s": "40대",
  "50s": "50대",
  "60s+": "60대 이상",
};

export const RESIDENCE_DISTANCES = ["TOGETHER", "NEARBY", "FAR", "OVERSEAS"] as const;
export type ResidenceDistance = (typeof RESIDENCE_DISTANCES)[number];
export const residenceDistanceLabel: Record<ResidenceDistance, string> = {
  TOGETHER: "함께 살아요",
  NEARBY: "가까이 살아요 (차로 1시간 이내)",
  FAR: "멀리 살아요 (다른 지역)",
  OVERSEAS: "해외에 있어요",
};

// ── STEP 2: 부모님 ──
export const PARENT_AGE_BANDS = ["60s", "70s", "80s", "90s+"] as const;
export type ParentAgeBand = (typeof PARENT_AGE_BANDS)[number];
export const parentAgeBandLabel: Record<ParentAgeBand, string> = {
  "60s": "60대",
  "70s": "70대",
  "80s": "80대",
  "90s+": "90대 이상",
};

export const PRIMARY_CONCERNS = ["MEDICATION", "MEAL", "LONELINESS", "COGNITIVE", "ETC"] as const;
export type PrimaryConcern = (typeof PRIMARY_CONCERNS)[number];
export const primaryConcernLabel: Record<PrimaryConcern, string> = {
  MEDICATION: "약을 잘 챙기시는지",
  MEAL: "식사를 거르지 않으시는지",
  LONELINESS: "혼자 계신 시간·외로움",
  COGNITIVE: "기억력·인지 변화",
  ETC: "그 밖의 일상 안부",
};

/** 통화 선호 시간대 — 첫 일정 등록 시 기본 시각 프리필에 사용 */
export const CALL_SLOTS = ["MORNING", "NOON", "EVENING"] as const;
export type CallSlot = (typeof CALL_SLOTS)[number];
export const callSlotLabel: Record<CallSlot, string> = {
  MORNING: "아침 (8~11시)",
  NOON: "낮 (12~16시)",
  EVENING: "저녁 (17~20시)",
};
/** 각 시간대의 기본 발신 시각 "HH:mm" (KST) — ScheduleForm 프리필 단일 소스 */
export const callSlotDefaultTime: Record<CallSlot, string> = {
  MORNING: "09:00",
  NOON: "13:00",
  EVENING: "18:00",
};

// ── 폼 스키마 ──
export const onboardingProfileSchema = z.object({
  guardian_age_band: z.enum(GUARDIAN_AGE_BANDS).nullable(),
  residence_distance: z.enum(RESIDENCE_DISTANCES).nullable(),
  parent_age_band: z.enum(PARENT_AGE_BANDS).nullable(),
  primary_concern: z.enum(PRIMARY_CONCERNS).nullable(),
  preferred_call_slot: z.enum(CALL_SLOTS).nullable(),
});
export type OnboardingProfile = z.infer<typeof onboardingProfileSchema>;

export const EMPTY_ONBOARDING_PROFILE: OnboardingProfile = {
  guardian_age_band: null,
  residence_distance: null,
  parent_age_band: null,
  primary_concern: null,
  preferred_call_slot: null,
};

/**
 * 온보딩 완료 상태. `onboarded_at` 이 있으면(건너뛰기 포함) 게이트를 통과시킨다 —
 * 조사는 이탈 지점이 되어선 안 되므로 재노출하지 않는다(설정에서 언제든 수정 가능).
 */
export const onboardingStateSchema = z.object({
  onboarded_at: z.string().datetime({ offset: true }).nullable(),
  skipped: z.boolean(),
  profile: onboardingProfileSchema,
});
export type OnboardingState = z.infer<typeof onboardingStateSchema>;
