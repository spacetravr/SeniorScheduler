import { describe, it, expect } from "vitest";
import { fmtDate, fmtTime, fmtDateTime, kstYmd, fmtRrule } from "./format";

const ISO = "2026-07-06T09:05:00+09:00";
// 같은 순간을 UTC(+00:00) 오프셋으로 표현 (Supabase REST 실제 반환 형태)
const ISO_UTC = "2026-07-06T00:05:00+00:00";

describe("fmtDate", () => {
  it("월/일을 앞 0 없이 표시한다", () => {
    expect(fmtDate(ISO)).toBe("7월 6일");
    expect(fmtDate("2026-12-25T00:00:00+09:00")).toBe("12월 25일");
  });

  it("UTC 오프셋 입력도 같은 KST 날짜로 표기한다", () => {
    expect(fmtDate(ISO_UTC)).toBe("7월 6일");
    // UTC 15:30 → 다음날 00:30 KST (날짜가 넘어감)
    expect(fmtDate("2026-07-06T15:30:00+00:00")).toBe("7월 7일");
    // Supabase 마이크로초·Z 표기도 정상 처리
    expect(fmtDate("2026-07-10T07:41:46.743948+00:00")).toBe("7월 10일");
    expect(fmtDate("2026-07-06T15:30:00Z")).toBe("7월 7일");
  });
});

describe("fmtTime", () => {
  it("HH:mm을 KST로 표기한다", () => {
    expect(fmtTime(ISO)).toBe("09:05");
    expect(fmtTime("2026-07-06T19:00:00+09:00")).toBe("19:00");
  });

  it("UTC 오프셋 입력도 KST 시각으로 변환한다", () => {
    // 동일 순간(+09:00 09:05 == +00:00 00:05) → 09:05
    expect(fmtTime(ISO_UTC)).toBe("09:05");
    // 자정 경계: UTC 15:30 → KST 00:30
    expect(fmtTime("2026-07-06T15:30:00+00:00")).toBe("00:30");
  });
});

describe("fmtDateTime", () => {
  it("날짜와 시각을 결합한다", () => {
    expect(fmtDateTime(ISO)).toBe("7월 6일 09:05");
  });

  it("UTC 오프셋 입력도 KST로 결합한다", () => {
    expect(fmtDateTime(ISO_UTC)).toBe("7월 6일 09:05");
    // 자정 경계 넘김
    expect(fmtDateTime("2026-07-06T15:30:00+00:00")).toBe("7월 7일 00:30");
  });
});

describe("kstYmd (버킷 키)", () => {
  it("KST 달력일 yyyy-MM-dd를 반환한다", () => {
    expect(kstYmd(ISO)).toBe("2026-07-06");
    expect(kstYmd(ISO_UTC)).toBe("2026-07-06");
  });

  it("00:00~09:00 KST 리포트를 전날로 버킷팅하지 않는다", () => {
    // UTC 22:00 (7/5) == KST 07:00 (7/6) → 7/6 버킷
    expect(kstYmd("2026-07-05T22:00:00+00:00")).toBe("2026-07-06");
    // UTC 15:30 (7/6) == KST 00:30 (7/7) → 7/7 버킷
    expect(kstYmd("2026-07-06T15:30:00+00:00")).toBe("2026-07-07");
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
