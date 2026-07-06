import { describe, it, expect } from "vitest";
import {
  parseRule,
  occursOnKstDate,
  instanceOnKstDate,
  nextOccurrence,
  kstDateOf,
  InvalidRruleError,
} from "./occurrences";

// 참고(KST 요일): 2026-07-06 월, 07 화, 08 수, 10 금, 11 토, 12 일.
// KST HH:mm → UTC 변환 예: 09:00 KST = 00:00Z, 00:10 KST = 전날 15:10Z, 23:50 KST = 당일 14:50Z.

describe("parseRule", () => {
  it("FREQ=DAILY → DAILY, 요일 없음", () => {
    expect(parseRule("FREQ=DAILY")).toEqual({ freq: "DAILY", weekdaysIso: [] });
  });

  it("FREQ=WEEKLY;BYDAY 복수 요일 → ISO 요일 정렬", () => {
    expect(parseRule("FREQ=WEEKLY;BYDAY=MO,WE,FR")).toEqual({
      freq: "WEEKLY",
      weekdaysIso: [1, 3, 5],
    });
    // 입력 순서와 무관하게 정렬되고 중복 제거된다.
    expect(parseRule("FREQ=WEEKLY;BYDAY=SU,SA")).toEqual({
      freq: "WEEKLY",
      weekdaysIso: [6, 7],
    });
  });

  it("잘못된/미지원 규칙은 InvalidRruleError", () => {
    expect(() => parseRule("")).toThrow(InvalidRruleError);
    expect(() => parseRule("   ")).toThrow(InvalidRruleError);
    expect(() => parseRule("나쁜입력")).toThrow(InvalidRruleError);
    expect(() => parseRule("FREQ=MONTHLY")).toThrow(InvalidRruleError);
    expect(() => parseRule("FREQ=WEEKLY")).toThrow(InvalidRruleError); // BYDAY 필수
    expect(() => parseRule("FREQ=WEEKLY;BYDAY=XX")).toThrow(InvalidRruleError);
  });
});

describe("occursOnKstDate", () => {
  it("DAILY 은 항상 발생", () => {
    expect(occursOnKstDate("FREQ=DAILY", "2026-07-06")).toBe(true);
    expect(occursOnKstDate("FREQ=DAILY", "2026-07-12")).toBe(true);
  });

  it("WEEKLY;BYDAY=MO,WE,FR — 요일에 따라 발생/미발생", () => {
    const r = "FREQ=WEEKLY;BYDAY=MO,WE,FR";
    expect(occursOnKstDate(r, "2026-07-06")).toBe(true); // 월
    expect(occursOnKstDate(r, "2026-07-07")).toBe(false); // 화
    expect(occursOnKstDate(r, "2026-07-08")).toBe(true); // 수
    expect(occursOnKstDate(r, "2026-07-10")).toBe(true); // 금
    expect(occursOnKstDate(r, "2026-07-11")).toBe(false); // 토
  });

  it("instant 를 넣어도 KST 날짜 기준으로 판정", () => {
    // 2026-07-11T23:00+09:00 = 토요일 밤 (UTC 로는 07-11T14:00Z, 여전히 KST 토요일)
    const sat = new Date("2026-07-11T23:00:00+09:00");
    expect(occursOnKstDate("FREQ=WEEKLY;BYDAY=SA", sat)).toBe(true);
  });
});

describe("instanceOnKstDate — Asia/Seoul 명시 instant", () => {
  it("09:00 KST → 같은 날 00:00Z", () => {
    const inst = instanceOnKstDate("FREQ=DAILY", "09:00", "2026-07-06");
    expect(inst?.toISOString()).toBe("2026-07-06T00:00:00.000Z");
  });

  it("자정 경계 23:50 → 당일 14:50Z", () => {
    const inst = instanceOnKstDate("FREQ=DAILY", "23:50", "2026-07-06");
    expect(inst?.toISOString()).toBe("2026-07-06T14:50:00.000Z");
  });

  it("자정 경계 00:10 → 전날 15:10Z", () => {
    const inst = instanceOnKstDate("FREQ=DAILY", "00:10", "2026-07-06");
    expect(inst?.toISOString()).toBe("2026-07-05T15:10:00.000Z");
  });

  it("발생하지 않는 요일이면 null", () => {
    // 2026-07-07 화요일에 월요일 규칙 → null
    expect(instanceOnKstDate("FREQ=WEEKLY;BYDAY=MO", "09:00", "2026-07-07")).toBeNull();
  });
});

describe("nextOccurrence — from 이후(포함) 다음 발신", () => {
  it("DAILY: call_time 아직 안 지남 → 오늘", () => {
    const from = new Date("2026-07-06T08:00:00+09:00");
    expect(nextOccurrence("FREQ=DAILY", "09:00", from).toISOString()).toBe(
      "2026-07-06T00:00:00.000Z",
    );
  });

  it("DAILY: call_time 이미 지남 → 내일", () => {
    const from = new Date("2026-07-06T10:00:00+09:00");
    expect(nextOccurrence("FREQ=DAILY", "09:00", from).toISOString()).toBe(
      "2026-07-07T00:00:00.000Z",
    );
  });

  it("경계 포함: from 이 call_time 과 정확히 같으면 그 시각", () => {
    const from = new Date("2026-07-06T09:00:00+09:00");
    expect(nextOccurrence("FREQ=DAILY", "09:00", from).toISOString()).toBe(
      "2026-07-06T00:00:00.000Z",
    );
  });

  it("WEEKLY MO,WE,FR: 월요일 오전(시각 지남) → 수요일", () => {
    const from = new Date("2026-07-06T10:00:00+09:00"); // 월 09:00 지남
    expect(
      nextOccurrence("FREQ=WEEKLY;BYDAY=MO,WE,FR", "09:00", from).toISOString(),
    ).toBe("2026-07-08T00:00:00.000Z"); // 수 09:00 KST
  });

  it("WEEKLY SU: 주 후반으로 wrap (월 → 일요일)", () => {
    const from = new Date("2026-07-06T00:00:00+09:00"); // 월 자정
    expect(nextOccurrence("FREQ=WEEKLY;BYDAY=SU", "10:00", from).toISOString()).toBe(
      "2026-07-12T01:00:00.000Z", // 일 10:00 KST
    );
  });

  it("자정 직전 지남 → 다음 날 같은 시각(23:50 경계)", () => {
    const from = new Date("2026-07-06T23:55:00+09:00");
    expect(nextOccurrence("FREQ=DAILY", "23:50", from).toISOString()).toBe(
      "2026-07-07T14:50:00.000Z",
    );
  });

  it("잘못된 rrule 은 InvalidRruleError", () => {
    expect(() => nextOccurrence("FREQ=MONTHLY", "09:00", new Date())).toThrow(InvalidRruleError);
  });
});

describe("kstDateOf", () => {
  it("instant 의 KST 달력 날짜", () => {
    // 2026-07-06T00:10+09:00 = 07-05T15:10Z 이지만 KST 날짜는 07-06
    expect(kstDateOf(new Date("2026-07-05T15:10:00.000Z"))).toBe("2026-07-06");
  });
});
