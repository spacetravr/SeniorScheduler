import { describe, it, expect } from "vitest";
import { fmtDate, fmtTime, fmtDateTime, fmtRrule } from "./format";

const ISO = "2026-07-06T09:05:00+09:00";

describe("fmtDate", () => {
  it("월/일을 앞 0 없이 표시한다", () => {
    expect(fmtDate(ISO)).toBe("7월 6일");
    expect(fmtDate("2026-12-25T00:00:00+09:00")).toBe("12월 25일");
  });
});

describe("fmtTime", () => {
  it("HH:mm만 슬라이싱한다", () => {
    expect(fmtTime(ISO)).toBe("09:05");
    expect(fmtTime("2026-07-06T19:00:00+09:00")).toBe("19:00");
  });
});

describe("fmtDateTime", () => {
  it("날짜와 시각을 결합한다", () => {
    expect(fmtDateTime(ISO)).toBe("7월 6일 09:05");
  });
});

describe("fmtRrule", () => {
  it("FREQ=DAILY → 매일", () => {
    expect(fmtRrule("FREQ=DAILY")).toBe("매일");
  });

  it("주중 5일(순서 무관) → 주중 (월~금)", () => {
    expect(fmtRrule("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR")).toBe("주중 (월~금)");
    expect(fmtRrule("FREQ=WEEKLY;BYDAY=FR,MO,WE,TH,TU")).toBe("주중 (월~금)");
  });

  it("주말 → 주말 (토·일)", () => {
    expect(fmtRrule("FREQ=WEEKLY;BYDAY=SA,SU")).toBe("주말 (토·일)");
    expect(fmtRrule("FREQ=WEEKLY;BYDAY=SU,SA")).toBe("주말 (토·일)");
  });

  it("커스텀 요일 조합 → 요일 라벨을 ·로 연결(입력 순서 아닌 요일 순서)", () => {
    expect(fmtRrule("FREQ=WEEKLY;BYDAY=MO,WE,FR")).toBe("매주 월·수·금");
    expect(fmtRrule("FREQ=WEEKLY;BYDAY=FR,MO,WE")).toBe("매주 월·수·금");
    expect(fmtRrule("FREQ=WEEKLY;BYDAY=TU")).toBe("매주 화");
  });

  it("BYDAY 없는 주간 규칙 → 매주 폴백", () => {
    expect(fmtRrule("FREQ=WEEKLY")).toBe("매주");
    expect(fmtRrule("FREQ=WEEKLY;INTERVAL=2")).toBe("매주");
  });

  it("예상 밖 입력은 안전하게 폴백한다", () => {
    expect(fmtRrule("")).toBe("매주");
    expect(fmtRrule("FREQ=MONTHLY")).toBe("매주");
    expect(fmtRrule("나쁜입력")).toBe("매주");
  });
});
