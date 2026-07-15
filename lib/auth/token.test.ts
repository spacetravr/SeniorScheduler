import { describe, it, expect } from "vitest";
import {
  decodeJwtPayload,
  getTokenExpiryMs,
  decideTokenAction,
  DEFAULT_REFRESH_SKEW_MS,
} from "./token";

/** 테스트용 JWT 생성기 — 서명은 검증하지 않으므로 payload 만 유효하면 된다. */
function makeJwt(payload: Record<string, unknown>): string {
  const b64url = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${b64url({ alg: "ES256", typ: "JWT", kid: "k1" })}.${b64url(payload)}.SIG`;
}

describe("decodeJwtPayload", () => {
  it("정상 JWT 의 payload 를 디코드한다", () => {
    const token = makeJwt({ sub: "user-1", exp: 1_800_000_000 });
    expect(decodeJwtPayload(token)).toMatchObject({ sub: "user-1", exp: 1_800_000_000 });
  });

  it("점(.) 개수가 3이 아니면 null", () => {
    expect(decodeJwtPayload("a.b")).toBeNull();
    expect(decodeJwtPayload("a.b.c.d")).toBeNull();
  });

  it("payload 가 유효한 base64 JSON 이 아니면 null", () => {
    expect(decodeJwtPayload("h.@@@notbase64@@@.s")).toBeNull();
  });

  it("빈 문자열/비문자열은 null", () => {
    expect(decodeJwtPayload("")).toBeNull();
    // @ts-expect-error 런타임 방어 확인
    expect(decodeJwtPayload(undefined)).toBeNull();
  });
});

describe("getTokenExpiryMs", () => {
  it("exp(초) 를 ms 로 변환한다", () => {
    const token = makeJwt({ exp: 1_800_000_000 });
    expect(getTokenExpiryMs(token)).toBe(1_800_000_000_000);
  });

  it("exp 가 없으면 null", () => {
    expect(getTokenExpiryMs(makeJwt({ sub: "u" }))).toBeNull();
  });

  it("exp 가 숫자가 아니면 null", () => {
    expect(getTokenExpiryMs(makeJwt({ exp: "soon" }))).toBeNull();
  });
});

describe("decideTokenAction", () => {
  const now = 1_000_000_000_000; // 고정 기준 시각(ms)

  it("세션 없으면 no-session", () => {
    expect(decideTokenAction({ hasSession: false }, now)).toBe("no-session");
    expect(decideTokenAction({ hasSession: true, accessToken: null }, now)).toBe("no-session");
  });

  it("충분히 살아있는 토큰(>5분)은 verify-local", () => {
    const exp = Math.floor((now + 30 * 60 * 1000) / 1000); // 30분 후
    const token = makeJwt({ exp });
    expect(decideTokenAction({ hasSession: true, accessToken: token }, now)).toBe("verify-local");
  });

  it("잔여 수명이 임계값 이하면 remote-refresh (기본 5분)", () => {
    const exp = Math.floor((now + 4 * 60 * 1000) / 1000); // 4분 후 → 5분 이하
    const token = makeJwt({ exp });
    expect(decideTokenAction({ hasSession: true, accessToken: token }, now)).toBe("remote-refresh");
  });

  it("이미 만료된 토큰은 remote-refresh", () => {
    const exp = Math.floor((now - 60 * 1000) / 1000); // 1분 전 만료
    const token = makeJwt({ exp });
    expect(decideTokenAction({ hasSession: true, accessToken: token }, now)).toBe("remote-refresh");
  });

  it("exp 를 못 읽는 토큰은 안전하게 remote-refresh", () => {
    expect(decideTokenAction({ hasSession: true, accessToken: "garbage" }, now)).toBe(
      "remote-refresh",
    );
    expect(
      decideTokenAction({ hasSession: true, accessToken: makeJwt({ sub: "u" }) }, now),
    ).toBe("remote-refresh");
  });

  it("경계값: 잔여 = 임계값 정확히 일치하면 remote-refresh (<= 비교)", () => {
    const exp = Math.floor((now + DEFAULT_REFRESH_SKEW_MS) / 1000);
    const token = makeJwt({ exp });
    expect(decideTokenAction({ hasSession: true, accessToken: token }, now)).toBe("remote-refresh");
  });

  it("커스텀 skew 를 존중한다", () => {
    const exp = Math.floor((now + 2 * 60 * 1000) / 1000); // 2분 후
    const token = makeJwt({ exp });
    // skew 1분 → 2분 남았으니 verify-local
    expect(decideTokenAction({ hasSession: true, accessToken: token }, now, 60 * 1000)).toBe(
      "verify-local",
    );
    // skew 3분 → 2분 남았으니 remote-refresh
    expect(decideTokenAction({ hasSession: true, accessToken: token }, now, 3 * 60 * 1000)).toBe(
      "remote-refresh",
    );
  });
});
