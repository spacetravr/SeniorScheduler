import { describe, it, expect } from "vitest";
import { hasThreeConsecutiveMissed, type MissedStreakSession } from "./missedStreak";

/** 테스트 헬퍼 — 날짜 순서만 의미 있으므로 day 로 scheduled_at 생성. */
function s(
  day: number,
  status: string,
  purpose: string = "SCHEDULE",
): MissedStreakSession {
  return {
    purpose,
    status,
    scheduled_at: `2026-07-${String(day).padStart(2, "0")}T09:00:00+09:00`,
  };
}

describe("hasThreeConsecutiveMissed", () => {
  it("최신 3건이 모두 MISSED 면 true", () => {
    expect(
      hasThreeConsecutiveMissed([s(3, "MISSED"), s(2, "MISSED"), s(1, "MISSED")]),
    ).toBe(true);
  });

  it("SCHEDULE 세션이 3건 미만이면 false", () => {
    expect(hasThreeConsecutiveMissed([s(2, "MISSED"), s(1, "MISSED")])).toBe(false);
    expect(hasThreeConsecutiveMissed([])).toBe(false);
  });

  it("최신 3건 중 하나라도 MISSED 가 아니면 false", () => {
    expect(
      hasThreeConsecutiveMissed([s(3, "COMPLETED"), s(2, "MISSED"), s(1, "MISSED")]),
    ).toBe(false);
  });

  it("입력 순서가 뒤섞여도 scheduled_at 최신순 3건으로 판정한다", () => {
    // 최신(4,3,2)=MISSED, 가장 오래된(1)=COMPLETED → 최신 3건 모두 MISSED 이므로 true
    expect(
      hasThreeConsecutiveMissed([
        s(1, "COMPLETED"),
        s(4, "MISSED"),
        s(2, "MISSED"),
        s(3, "MISSED"),
      ]),
    ).toBe(true);
  });

  it("과거 3건이 MISSED 여도 최신 건이 성공이면 false", () => {
    expect(
      hasThreeConsecutiveMissed([
        s(4, "COMPLETED"),
        s(3, "MISSED"),
        s(2, "MISSED"),
        s(1, "MISSED"),
      ]),
    ).toBe(false);
  });

  it("CONSENT 목적 세션은 제외하고 SCHEDULE 만 센다", () => {
    // CONSENT MISSED 2건 + SCHEDULE MISSED 3건 → SCHEDULE 기준 최신 3건 MISSED = true
    expect(
      hasThreeConsecutiveMissed([
        s(6, "MISSED", "CONSENT"),
        s(5, "MISSED", "CONSENT"),
        s(3, "MISSED"),
        s(2, "MISSED"),
        s(1, "MISSED"),
      ]),
    ).toBe(true);
    // SCHEDULE 이 2건뿐이면 CONSENT 가 많아도 false
    expect(
      hasThreeConsecutiveMissed([
        s(6, "MISSED", "CONSENT"),
        s(2, "MISSED"),
        s(1, "MISSED"),
      ]),
    ).toBe(false);
  });
});
