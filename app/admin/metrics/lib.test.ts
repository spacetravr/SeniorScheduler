import { describe, it, expect } from "vitest";
import {
  maskEmail,
  pct,
  fmtKstDateTime,
  kstDateKey,
  recentKstDateKeys,
  computeMetrics,
  isCountedType,
  eventKo,
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

describe("computeMetrics — 새 2페이지 퍼널(방문 → 사전등록 클릭 → 이메일 제출)", () => {
  const now = new Date("2026-07-06T12:00:00+09:00");
  const events: CtaEvent[] = [
    { type: "VIEW", session_uuid: "s1", utm_source: "kakao", created_at: "2026-07-06T01:00:00Z" },
    { type: "CLICK_TRY", session_uuid: "s1", utm_source: "kakao", created_at: "2026-07-06T01:01:00Z" },
    { type: "VIEW", session_uuid: "s2", utm_source: null, created_at: "2026-07-06T02:00:00Z" },
    { type: "CLICK_TRY", session_uuid: "s2", utm_source: null, created_at: "2026-07-06T02:01:00Z" },
    { type: "WAITLIST_SUBMIT", session_uuid: "s2", utm_source: null, created_at: "2026-07-06T02:02:00Z" },
    // 과거 잔존 데이터: CLICK_SUBSCRIBE는 이제 발생하지 않으며 집계에서 무시되어야 함
    { type: "CLICK_SUBSCRIBE", session_uuid: "s1", utm_source: "kakao", created_at: "2026-07-06T01:02:00Z" },
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
  it("사전등록 클릭(CLICK_TRY)만 집계, CLICK_SUBSCRIBE 잔존 데이터는 무시", () => {
    expect(m.summary.clickTry).toBe(2);
    // 요약 타입에 clickSubscribe 필드가 존재하지 않는다(제거됨).
    expect("clickSubscribe" in m.summary).toBe(false);
  });
  it("대기자는 test 제외", () => {
    expect(m.summary.waitlist).toBe(1);
    expect(m.waitlistTotal).toBe(1);
  });
  it("채널 행에 test 미포함, testChannel 별도, CLICK_SUBSCRIBE 무시", () => {
    expect(m.channels.some((c) => c.source === "test")).toBe(false);
    expect(m.channels.some((c) => c.source === "(직접)")).toBe(true);
    const kakao = m.channels.find((c) => c.source === "kakao");
    expect(kakao?.clickTry).toBe(1);
    // 채널 행에 clickSubscribe 필드가 존재하지 않는다.
    expect(kakao && "clickSubscribe" in kakao).toBe(false);
    expect(m.testChannel?.view).toBe(1);
  });
  it("일별 추이는 7일, 당일 방문 2건·사전등록 클릭 2건(CLICK_SUBSCRIBE 미포함)", () => {
    expect(m.days).toHaveLength(7);
    const today = m.days[6];
    expect(today.dateKey).toBe("2026-07-06");
    expect(today.view).toBe(2);
    expect(today.click).toBe(2);
    expect(today.submit).toBe(1);
  });
  it("최근 활동에 CLICK_SUBSCRIBE 잔존 데이터는 노출되지 않는다", () => {
    expect(m.recent.some((r) => r.type === "CLICK_SUBSCRIBE")).toBe(false);
  });
  it("대기자 최근 목록 이메일 마스킹", () => {
    expect(m.waitlistRecent[0].email).toBe("ab***@gmail.com");
  });
});

describe("isCountedType", () => {
  it("현재 퍼널 3종만 통과", () => {
    expect(isCountedType("VIEW")).toBe(true);
    expect(isCountedType("CLICK_TRY")).toBe(true);
    expect(isCountedType("WAITLIST_SUBMIT")).toBe(true);
  });
  it("CLICK_SUBSCRIBE·미상 타입은 배제", () => {
    expect(isCountedType("CLICK_SUBSCRIBE")).toBe(false);
    expect(isCountedType("SOMETHING_NEW")).toBe(false);
  });
});

describe("eventKo", () => {
  it("집계 대상은 한국어 라벨, 그 외는 기타", () => {
    expect(eventKo("VIEW")).toBe("방문");
    expect(eventKo("CLICK_TRY")).toBe("사전등록 클릭");
    expect(eventKo("WAITLIST_SUBMIT")).toBe("이메일 제출");
    expect(eventKo("CLICK_SUBSCRIBE")).toBe("기타");
  });
});
