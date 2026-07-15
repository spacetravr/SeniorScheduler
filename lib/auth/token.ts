/**
 * 미들웨어 인증 게이트의 순수 판정 로직.
 *
 * 목적: 매 요청마다 시드니 인증 서버로 원격 `getUser()` 호출(~0.3s)을 하지 않도록,
 * access token 의 만료(exp)를 로컬에서 계산해 "로컬 서명검증만으로 통과시킬지"
 * "원격 갱신 경로로 폴백할지"를 결정한다.
 *
 * 이 파일은 네트워크·전역상태에 의존하지 않는 순수 함수만 둔다 (유닛 테스트 대상 — token.test.ts).
 * 실제 서명검증(JWKS/ES256)과 세션 갱신은 middleware.ts 가 이 판정 결과에 따라 수행한다.
 *
 * 시간대 주의: JWT `exp` 는 UTC epoch(초) 로 시간대 무관 절대시각이다. 여기서는 만료까지의
 * "잔여 수명(ms)" 만 계산하므로 KST 변환이 불필요하다(경과시간 산술은 타임존 독립).
 */

/** JWT payload 중 우리가 쓰는 필드만. */
export interface DecodedJwtPayload {
  /** 만료 시각 — UTC epoch seconds. */
  exp?: number;
  /** 발급 subject(user id). 존재 여부만 참고. */
  sub?: string;
  [key: string]: unknown;
}

/**
 * JWT 를 **서명검증 없이** 디코드해 payload 를 반환한다 (base64url).
 * 서명검증은 호출측(getClaims, JWKS)이 담당 — 여기서는 exp 만 읽기 위한 디코드다.
 * 형식이 깨졌으면 null.
 */
export function decodeJwtPayload(token: string): DecodedJwtPayload | null {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const payloadPart = parts[1];
    // base64url → base64
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    // Edge/Node 공통으로 존재하는 atob 사용 (미들웨어는 Edge 런타임).
    const json =
      typeof atob === "function"
        ? decodeURIComponent(
            Array.prototype.map
              .call(atob(padded), (c: string) => `%${`00${c.charCodeAt(0).toString(16)}`.slice(-2)}`)
              .join(""),
          )
        : Buffer.from(padded, "base64").toString("utf-8");
    const parsed = JSON.parse(json) as unknown;
    if (parsed && typeof parsed === "object") return parsed as DecodedJwtPayload;
    return null;
  } catch {
    return null;
  }
}

/**
 * access token 의 만료 시각을 ms(UTC epoch)로 반환. exp 없거나 디코드 실패 시 null.
 */
export function getTokenExpiryMs(token: string): number | null {
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) {
    return null;
  }
  return payload.exp * 1000;
}

/** 미들웨어가 취할 동작. */
export type TokenAction =
  /** 세션 쿠키 자체가 없음 → 미인증. 보호경로면 /login 리다이렉트. */
  | "no-session"
  /** 토큰이 충분히 살아있음 → 로컬 서명검증(JWKS)만으로 통과. 원격 호출 없음. */
  | "verify-local"
  /** 만료 임박/만료/판독불가 → 기존 원격 경로(getUser)로 폴백해 검증·갱신. */
  | "remote-refresh";

/** 만료 임박 판정 기본 임계값: 잔여 수명 5분. (auth-js 내장 갱신 마진 90s 보다 넉넉히 앞선다) */
export const DEFAULT_REFRESH_SKEW_MS = 5 * 60 * 1000;

/**
 * 세션/토큰 상태로부터 미들웨어 동작을 결정하는 순수 함수.
 *
 * @param input.hasSession 쿠키에 세션이 존재하는가
 * @param input.accessToken 세션의 access token (있으면)
 * @param nowMs 현재 시각(ms). 테스트 주입용.
 * @param refreshSkewMs 이 잔여 수명 이하이면 원격 갱신으로 폴백.
 */
export function decideTokenAction(
  input: { hasSession: boolean; accessToken?: string | null },
  nowMs: number,
  refreshSkewMs: number = DEFAULT_REFRESH_SKEW_MS,
): TokenAction {
  if (!input.hasSession || !input.accessToken) return "no-session";

  const expiryMs = getTokenExpiryMs(input.accessToken);
  // exp 를 못 읽으면 안전하게 원격 검증으로.
  if (expiryMs === null) return "remote-refresh";

  const remainingMs = expiryMs - nowMs;
  if (remainingMs <= refreshSkewMs) return "remote-refresh";

  return "verify-local";
}
