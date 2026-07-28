import { describe, it, expect } from "vitest";
import {
  CALL_SLOTS,
  EMPTY_ONBOARDING_PROFILE,
  callSlotDefaultTime,
  type OnboardingProfile,
} from "@/lib/contracts/onboarding";
import {
  DEFAULT_CALL_TIME,
  DEFAULT_SCHEDULE_TYPE,
  buildSchedulePrefill,
} from "./schedulePrefill";

function profile(patch: Partial<OnboardingProfile>): OnboardingProfile {
  return { ...EMPTY_ONBOARDING_PROFILE, ...patch };
}

describe("buildSchedulePrefill — 발신 시각", () => {
  it("프로필이 없으면(건너뛰기·조회 실패) 기존 기본값과 힌트 없음", () => {
    for (const p of [null, undefined]) {
      const r = buildSchedulePrefill(p);
      expect(r.callTime).toBe(DEFAULT_CALL_TIME);
      expect(r.types).toEqual([DEFAULT_SCHEDULE_TYPE]);
      expect(r.hint).toBeNull();
    }
  });

  it("전 문항이 비어 있으면 기존 기본값과 힌트 없음", () => {
    const r = buildSchedulePrefill(EMPTY_ONBOARDING_PROFILE);
    expect(r.callTime).toBe(DEFAULT_CALL_TIME);
    expect(r.types).toEqual([DEFAULT_SCHEDULE_TYPE]);
    expect(r.hint).toBeNull();
  });

  it.each(CALL_SLOTS)("선호 시간대 %s → 계약의 기본 시각", (slot) => {
    const r = buildSchedulePrefill(profile({ preferred_call_slot: slot }));
    expect(r.callTime).toBe(callSlotDefaultTime[slot]);
    expect(r.hint).toContain(callSlotDefaultTime[slot]);
  });

  it("계약 매핑 실제 값 (MORNING 09:00 / NOON 13:00 / EVENING 18:00)", () => {
    expect(buildSchedulePrefill(profile({ preferred_call_slot: "MORNING" })).callTime).toBe(
      "09:00",
    );
    expect(buildSchedulePrefill(profile({ preferred_call_slot: "NOON" })).callTime).toBe(
      "13:00",
    );
    expect(buildSchedulePrefill(profile({ preferred_call_slot: "EVENING" })).callTime).toBe(
      "18:00",
    );
  });
});

describe("buildSchedulePrefill — 유형", () => {
  it("MEDICATION → 복약", () => {
    const r = buildSchedulePrefill(profile({ primary_concern: "MEDICATION" }));
    expect(r.types).toEqual(["MEDICATION"]);
    expect(r.hint).toContain("복약");
  });

  it("MEAL → 식사", () => {
    const r = buildSchedulePrefill(profile({ primary_concern: "MEAL" }));
    expect(r.types).toEqual(["MEAL"]);
    expect(r.hint).toContain("식사");
  });

  it.each(["LONELINESS", "COGNITIVE", "ETC"] as const)(
    "%s 는 억지 매핑하지 않고 기본값 유지 (시간대 없으면 힌트도 없음)",
    (concern) => {
      const r = buildSchedulePrefill(profile({ primary_concern: concern }));
      expect(r.types).toEqual([DEFAULT_SCHEDULE_TYPE]);
      expect(r.hint).toBeNull();
    },
  );

  it("시간대만 있으면 유형은 기본값 그대로, 힌트에는 시각만", () => {
    const r = buildSchedulePrefill(profile({ preferred_call_slot: "EVENING" }));
    expect(r.types).toEqual([DEFAULT_SCHEDULE_TYPE]);
    expect(r.hint).toContain("18:00");
    expect(r.hint).not.toContain("유형");
  });

  it("둘 다 있으면 힌트에 두 항목이 모두 담긴다", () => {
    const r = buildSchedulePrefill(
      profile({ preferred_call_slot: "NOON", primary_concern: "MEAL" }),
    );
    expect(r.callTime).toBe("13:00");
    expect(r.types).toEqual(["MEAL"]);
    expect(r.hint).toContain("13:00");
    expect(r.hint).toContain("식사");
  });

  it("무관한 문항(연령대·거주 거리)은 프리필에 영향이 없다", () => {
    const r = buildSchedulePrefill(
      profile({ guardian_age_band: "40s", parent_age_band: "70s", residence_distance: "FAR" }),
    );
    expect(r.callTime).toBe(DEFAULT_CALL_TIME);
    expect(r.types).toEqual([DEFAULT_SCHEDULE_TYPE]);
    expect(r.hint).toBeNull();
  });
});
