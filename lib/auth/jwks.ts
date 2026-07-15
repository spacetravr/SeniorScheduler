import "server-only";

/**
 * Supabase 프로젝트의 JWT 서명키(JWKS) 를 프로세스 메모리에 캐시한다.
 *
 * 배경: supabase-js 의 `auth.getClaims()` 는 JWKS 를 클라이언트 인스턴스 단위로 캐시하는데,
 * 미들웨어는 매 요청마다 새 클라이언트를 만들므로 그대로 두면 요청마다 JWKS 를 원격 fetch 한다.
 * → 여기서 **모듈 스코프(워ム 인스턴스 간 유지)** 로 키를 캐시하고 `getClaims(token, { keys })`
 *   로 주입하면, fetchJwk 이 주입된 키에서 즉시 찾아 네트워크 없이 로컬 검증한다.
 *
 * 이 프로젝트 JWKS 는 비대칭키(ES256, kid 보유)로 확인됨 → 로컬 서명검증이 성립한다.
 * (curl .../auth/v1/.well-known/jwks.json → kty:EC, crv:P-256, alg:ES256)
 */

/** JWKS 의 개별 키 (getClaims options.keys 로 그대로 전달). */
export type Jwk = Record<string, unknown> & { kid?: string; alg?: string };

const JWKS_TTL_MS = 10 * 60 * 1000; // auth-js 내부 JWKS_TTL 과 동일(10분).

let cachedKeys: Jwk[] | null = null;
let cachedAt = 0;
let inFlight: Promise<Jwk[]> | null = null;

function jwksUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base.replace(/\/$/, "")}/auth/v1/.well-known/jwks.json`;
}

/**
 * JWKS 키 배열을 반환한다. TTL 내면 캐시, 아니면 1회 fetch(동시요청 합류).
 * 실패하면 null — 호출측(미들웨어)은 로컬검증을 포기하고 원격 getUser 로 폴백한다.
 */
export async function getCachedJwks(now: number = Date.now()): Promise<Jwk[] | null> {
  if (cachedKeys && now - cachedAt < JWKS_TTL_MS) return cachedKeys;
  if (inFlight) return inFlight;

  const url = jwksUrl();
  if (!url) return null;

  inFlight = (async () => {
    try {
      const res = await fetch(url, { headers: { accept: "application/json" } });
      if (!res.ok) throw new Error(`JWKS fetch ${res.status}`);
      const body = (await res.json()) as { keys?: Jwk[] };
      const keys = Array.isArray(body.keys) ? body.keys : [];
      if (keys.length === 0) throw new Error("JWKS empty");
      cachedKeys = keys;
      cachedAt = now;
      return keys;
    } finally {
      inFlight = null;
    }
  })();

  try {
    return await inFlight;
  } catch {
    // 네트워크/파싱 실패: 캐시가 있으면 (만료됐어도) 재사용, 없으면 null.
    return cachedKeys;
  }
}
