import { describe, it, expect } from "vitest";
import {
  maskEmail,
  pct,
  fmtKstDateTime,
  kstDateKey,
  recentKstDateKeys,
  computeMetrics,
  type CtaEvent,
  type WaitlistRow,
} from "./lib";

describe("maskEmail", () => {
  it("앞 2자 + *** + @도메인만 남긴다", () => {
    expect(maskEmail("abcdef@gmail.com")).toBe("ab***@gmail.com");
    expect(maskEmail("hong@naver.com")).toBe("ho***@naver.com");
  });
  it("로컬 파트가 짧아도 깨지지 않는다", () => {
    expect(maskEmail("a@x.com")).toBe("a***@x.com");
    expect(maskEmail("notanemail")).toBe("***");
  });
});

describe("pct", () => {
  it("분모 0이면 대시", () => {
    expect(pct(3, 0)).toBe("-");
  });
  it("반올림 퍼센트", () => {
    expect(pct(1, 3)).toBe("33%");
    expect(pct(1, 2)).toBe("50%");
  });
});

describe("KST 변환", () => {
  it("UTC 자정 직후도 KST 날짜로 묶는다", () => {
    // 2026-07-05T20:00:00Z = 2026-07-06 05:00 KST
    expect(kstDateKey("2026-07-05T20:00:00Z")).toBe("2026-07-06");
  });
  it("시각을 KST M/d HH:mm으로 표기", () => {
    expect(fmtKstDateTime("2026-07-06T11:15:00Z")).toBe("7/6 20:15");
  });
  it("최근 7일 키는 7개이고 오름차순", () => {
    const now = new Date("2026-07-06T12:00:00+09:00");
    const keys = recentKstDateKeys(7, now);
    expect(keys).toHaveLength(7);
    expect(keys[6]).toBe("2026-07-06");
    expect(keys[0]).toBe("2026-06-30");
  });
});

describe("computeMetrics", () => {
  const now = new Date("2026-07-06T12:00:00+09:00");
  const events: CtaEvent[] = [
    { type: "VIEW", session_uuid: "s1", utm_source: "kakao", created_at: "2026-07-06T01:00:00Z" },
    { type: "CLICK_SUBSCRIBE", session_uuid: "s1", utm_source: "kakao", created_at: "2026-07-06T01:01:00Z" },
    { type: "VIEW", session_uuid: "s2", utm_source: null, created_at: "2026-07-06T02:00:00Z" },
    { type: "CLICK_TRY", session_uuid: "s2", utm_source: null, created_at: "2026-07-06T02:01:00Z" },
    { type: "WAITLIST_SUBMIT", session_uuid: "s2", utm_source: null, created_at: "2026-07-06T02:02:00Z" },
    // test 유입은 집계 제외
    { type: "VIEW", session_uuid: "s3", utm_source: "test", created_at: "2026-07-06T03:00:00Z" },
  ];
  const waitlist: WaitlistRow[] = [
    { email: "abcdef@gmail.com", utm_source: null, created_at: "2026-07-06T02:02:00Z" },
    { email: "test@test.com", utm_source: "test", created_at: "2026-07-06T03:02:00Z" },
  ];

  const m = computeMetrics(events, waitlist, now);

  it("고유 방문자는 test 제외 distinct session", () => {
    expect(m.summary.visitors).toBe(2);
  });
  it("클릭 분리 집계", () => {
    expect(m.summary.clickSubscribe).toBe(1);
    expect(m.summary.clickTry).toBe(1);
  });
  it("대기자는 test 제외", () => {
    expect(m.summary.waitlist).toBe(1);
    expect(m.waitlistTotal).toBe(1);
  });
  it("채널 행에 test 미포함, testChannel 별도", () => {
    expect(m.channels.some((c) => c.source === "test")).toBe(false);
    expect(m.channels.some((c) => c.source === "(직접)")).toBe(true);
    expect(m.testChannel?.view).toBe(1);
  });
  it("일별 추이는 7일, 당일 방문 2건", () => {
    expect(m.days).toHaveLength(7);
    const today = m.days[6];
    expect(today.dateKey).toBe("2026-07-06");
    expect(today.view).toBe(2);
    expect(today.submit).toBe(1);
  });
  it("대기자 최근 목록 이메일 마스킹", () => {
    expect(m.waitlistRecent[0].email).toBe("ab***@gmail.com");
  });
});
