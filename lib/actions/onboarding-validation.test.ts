import { describe, expect, it } from "vitest";
import {
  EMPTY_ONBOARDING_PROFILE,
  callSlotDefaultTime,
  onboardingProfileSchema,
  onboardingStateSchema,
} from "@/lib/contracts/onboarding";

/**
 * 온보딩 입력 검증 — lib/actions/onboarding.ts 가 저장 전에 쓰는 계약 스키마.
 * (Server Action 자체는 "use server" + Supabase 의존이라 여기서는 검증 규칙만 고정한다.)
 */

describe("onboardingProfileSchema", () => {
  it("전 문항 null(=건너뛴 상태)도 유효하다 — 조사는 이탈 지점이 되면 안 된다", () => {
    expect(onboardingProfileSchema.safeParse(EMPTY_ONBOARDING_PROFILE).success).toBe(true);
  });

  it("정상 값을 통과시킨다", () => {
    const r = onboardingProfileSchema.safeParse({
      guardian_age_band: "40s",
      residence_distance: "FAR",
      parent_age_band: "70s",
      primary_concern: "MEDICATION",
      preferred_call_slot: "MORNING",
    });
    expect(r.success).toBe(true);
  });

  it("enum 밖의 값은 거부한다", () => {
    expect(
      onboardingProfileSchema.safeParse({ ...EMPTY_ONBOARDING_PROFILE, guardian_age_band: "10s" })
        .success,
    ).toBe(false);
    expect(
      onboardingProfileSchema.safeParse({ ...EMPTY_ONBOARDING_PROFILE, primary_concern: "DISEASE" })
        .success,
    ).toBe(false);
  });

  it("키 누락은 거부한다 (부분 저장 방지 — 액션은 항상 5문항 전부를 받는다)", () => {
    expect(onboardingProfileSchema.safeParse({ guardian_age_band: "30s" }).success).toBe(false);
  });

  it("undefined 는 null 과 다르게 취급한다(명시적 null 요구)", () => {
    expect(
      onboardingProfileSchema.safeParse({ ...EMPTY_ONBOARDING_PROFILE, parent_age_band: undefined })
        .success,
    ).toBe(false);
  });
});

describe("onboardingStateSchema", () => {
  it("완료 상태를 파싱한다", () => {
    const r = onboardingStateSchema.safeParse({
      onboarded_at: "2026-07-28T00:00:00+09:00",
      skipped: false,
      profile: EMPTY_ONBOARDING_PROFILE,
    });
    expect(r.success).toBe(true);
  });

  it("미완료(onboarded_at=null)를 허용한다", () => {
    const r = onboardingStateSchema.safeParse({
      onboarded_at: null,
      skipped: false,
      profile: EMPTY_ONBOARDING_PROFILE,
    });
    expect(r.success).toBe(true);
  });

  it("오프셋 없는 시각 문자열은 거부한다 (KST 명시 원칙)", () => {
    const r = onboardingStateSchema.safeParse({
      onboarded_at: "2026-07-28 09:00:00",
      skipped: false,
      profile: EMPTY_ONBOARDING_PROFILE,
    });
    expect(r.success).toBe(false);
  });
});

describe("callSlotDefaultTime", () => {
  it("선호 시간대 → 기본 발신 시각(KST HH:mm) 매핑이 전부 존재한다", () => {
    expect(callSlotDefaultTime.MORNING).toBe("09:00");
    expect(callSlotDefaultTime.NOON).toBe("13:00");
    expect(callSlotDefaultTime.EVENING).toBe("18:00");
  });
});
