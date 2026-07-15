import { describe, it, expect } from "vitest";
import {
  transition,
  canRetry,
  retryDelayMs,
  isTerminal,
  canDispatchScheduleCall,
  canDispatchConsentCall,
  MAX_ATTEMPTS,
  type CallState,
} from "./state-machine";

const S = (status: CallState["status"], attempt = 1): CallState => ({ status, attempt });

describe("transition — 정상 흐름", () => {
  it("SCHEDULED→DIALING→IN_PROGRESS→COMPLETED", () => {
    let st = S("SCHEDULED");
    st = transition(st, { type: "DIAL_START" });
    expect(st).toEqual(S("DIALING"));
    st = transition(st, { type: "ANSWERED" });
    expect(st).toEqual(S("IN_PROGRESS"));
    st = transition(st, { type: "COMPLETE" });
    expect(st).toEqual(S("COMPLETED"));
  });
});

describe("transition — 무응답 재시도", () => {
  it("attempt 1 무응답 → SCHEDULED attempt 2", () => {
    const st = transition(S("DIALING", 1), { type: "NO_ANSWER" });
    expect(st).toEqual(S("SCHEDULED", 2));
  });
  it("attempt 2 무응답 → SCHEDULED attempt 3", () => {
    const st = transition(S("DIALING", 2), { type: "NO_ANSWER" });
    expect(st).toEqual(S("SCHEDULED", 3));
  });
  it("attempt 3(마지막) 무응답 → MISSED", () => {
    const st = transition(S("DIALING", MAX_ATTEMPTS), { type: "NO_ANSWER" });
    expect(st).toEqual(S("MISSED", MAX_ATTEMPTS));
  });
});

describe("transition — 잘못된 전이는 무시", () => {
  it("SCHEDULED 에서 COMPLETE 이벤트는 무시", () => {
    expect(transition(S("SCHEDULED"), { type: "COMPLETE" })).toEqual(S("SCHEDULED"));
  });
  it("COMPLETED 에서 NO_ANSWER 무시", () => {
    expect(transition(S("COMPLETED"), { type: "NO_ANSWER" })).toEqual(S("COMPLETED"));
  });
});

describe("재시도 지연", () => {
  it("canRetry 는 MAX 미만에서 true", () => {
    expect(canRetry(1)).toBe(true);
    expect(canRetry(2)).toBe(true);
    expect(canRetry(3)).toBe(false);
  });
  it("retryDelayMs: 1→2 는 1분, 2→3 은 10분, 3 은 null", () => {
    expect(retryDelayMs(1)).toBe(60_000);
    expect(retryDelayMs(2)).toBe(600_000);
    expect(retryDelayMs(3)).toBeNull();
  });
});

describe("isTerminal", () => {
  it("COMPLETED/MISSED 만 종료", () => {
    expect(isTerminal("COMPLETED")).toBe(true);
    expect(isTerminal("MISSED")).toBe(true);
    expect(isTerminal("DIALING")).toBe(false);
    expect(isTerminal("SCHEDULED")).toBe(false);
  });
});

describe("실발신 가드 (가드레일 5)", () => {
  const both = { consent_at: "2026-07-01T00:00:00+09:00", self_consent_at: "2026-07-02T00:00:00+09:00" };
  const proxyOnly = { consent_at: "2026-07-01T00:00:00+09:00", self_consent_at: null };
  const none = { consent_at: null, self_consent_at: null };

  it("SCHEDULE 콜은 대리+본인 동의 둘 다 필요", () => {
    expect(canDispatchScheduleCall(both)).toBe(true);
    expect(canDispatchScheduleCall(proxyOnly)).toBe(false);
    expect(canDispatchScheduleCall(none)).toBe(false);
  });
  it("CONSENT 콜은 대리동의만 있고 본인동의 없을 때만", () => {
    expect(canDispatchConsentCall(proxyOnly)).toBe(true);
    expect(canDispatchConsentCall(both)).toBe(false); // 이미 본인동의 → 불필요
    expect(canDispatchConsentCall(none)).toBe(false); // 대리동의도 없음
  });
});
