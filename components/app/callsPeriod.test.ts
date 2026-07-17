import { describe, it, expect } from "vitest";
import { periodCutoffYmd, isWithinPeriod } from "./callsPeriod";

describe("periodCutoffYmd", () => {
  it("오늘 포함 N일 창의 시작 경계를 반환한다", () => {
    expect(periodCutoffYmd("2026-07-17", 3)).toBe("2026-07-15");
    expect(periodCutoffYmd("2026-07-17", 7)).toBe("2026-07-11");
    expect(periodCutoffYmd("2026-07-17", 1)).toBe("2026-07-17");
  });

  it("월 경계를 넘어도 KST 달력으로 정확히 계산한다", () => {
    expect(periodCutoffYmd("2026-08-01", 3)).toBe("2026-07-30");
    expect(periodCutoffYmd("2026-03-02", 7)).toBe("2026-02-24");
  });

  it("연 경계를 넘어도 정확히 계산한다", () => {
    expect(periodCutoffYmd("2026-01-01", 3)).toBe("2025-12-30");
  });
});

describe("isWithinPeriod", () => {
  const today = "2026-07-17";

  it("전체(days=null)는 항상 포함한다", () => {
    expect(isWithinPeriod("2020-01-01", today, null)).toBe(true);
  });

  it("최근 3일 경계(자정) 안/밖을 정확히 가른다", () => {
    // 창: 07-15 ~ 07-17
    expect(isWithinPeriod("2026-07-15", today, 3)).toBe(true); // 시작 경계 포함
    expect(isWithinPeriod("2026-07-17", today, 3)).toBe(true); // 오늘 포함
    expect(isWithinPeriod("2026-07-14", today, 3)).toBe(false); // 경계 밖
  });

  it("최근 7일 경계를 정확히 가른다", () => {
    expect(isWithinPeriod("2026-07-11", today, 7)).toBe(true);
    expect(isWithinPeriod("2026-07-10", today, 7)).toBe(false);
  });
});
