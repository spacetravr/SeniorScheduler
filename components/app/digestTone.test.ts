import { describe, it, expect } from "vitest";
import { escalateTone, sparklineHeight, sparklineLabel, telHref } from "./digestTone";

describe("escalateTone", () => {
  it("연속 불발이 없으면 원래 톤을 유지한다", () => {
    expect(escalateTone("CALM", false)).toBe("CALM");
    expect(escalateTone("ATTENTION", false)).toBe("ATTENTION");
    expect(escalateTone("ALERT", false)).toBe("ALERT");
  });

  it("연속 불발이 있으면 ALERT 로 승격한다", () => {
    expect(escalateTone("CALM", true)).toBe("ALERT");
    expect(escalateTone("ATTENTION", true)).toBe("ALERT");
    expect(escalateTone("ALERT", true)).toBe("ALERT");
  });
});

describe("sparklineLabel", () => {
  it("빈 추이", () => {
    expect(sparklineLabel([])).toBe("표시할 추이가 없습니다");
  });

  it("null 은 기록 없음으로 읽는다 (0% 오해 방지)", () => {
    const label = sparklineLabel([100, null, 50]);
    expect(label).toContain("최근 3일");
    expect(label).toContain("1번째 100%");
    expect(label).toContain("2번째 기록 없음");
    expect(label).toContain("3번째 50%");
  });
});

describe("sparklineHeight", () => {
  it("null 과 0 도 최소 높이를 갖는다", () => {
    expect(sparklineHeight(null)).toBe(6);
    expect(sparklineHeight(0)).toBe(8);
  });

  it("값이 크면 값 그대로", () => {
    expect(sparklineHeight(100)).toBe(100);
    expect(sparklineHeight(42)).toBe(42);
  });
});

describe("telHref", () => {
  it("하이픈을 제거한다", () => {
    expect(telHref("010-1234-5678")).toBe("tel:01012345678");
  });

  it("빈 값이면 null", () => {
    expect(telHref("")).toBeNull();
    expect(telHref("--")).toBeNull();
  });
});
