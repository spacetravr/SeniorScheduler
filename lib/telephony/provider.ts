import type { TelephonyAdapter } from "./types";
import { MockAdapter } from "./mock-adapter";
import { ClovaAdapter, type ClovaConfig, CLOVA_ENV_KEYS } from "./clova-adapter";

/**
 * 텔레포니 어댑터 선택 계층 (CLAUDE.md 가드레일 4).
 *
 * env `TELEPHONY_PROVIDER` = `mock`(기본) | `clova` 로 어댑터와 실행 모드를 결정한다.
 *   - mock  → 동기(sync) 대화-드라이버 모델. 디스패치 라우트가 한 통화를 인라인 완주.
 *   - clova → 비동기(async) 트리거 모델. 디스패치는 발신만 트리거, 완료는 콜백이 담당.
 *
 * clova 선택 시 필수 설정(CLOVA_* env)을 검증한다. 미비하면 **발신을 시도하지 않고**
 * 명확한 skip 결과를 돌려준다(조용한 mock 폴백 금지 — 실환경에서 가짜 통화가 진짜처럼
 * 기록되면 안 됨).
 */

export type TelephonyProviderName = "mock" | "clova";
export type TelephonyMode = "sync" | "async";

/** env 에서 provider 이름을 읽는다. 미설정/미지원 값은 mock 으로 취급(안전 기본). */
export function getConfiguredProvider(
  raw: string | undefined = process.env.TELEPHONY_PROVIDER,
): TelephonyProviderName {
  const v = (raw ?? "").trim().toLowerCase();
  return v === "clova" ? "clova" : "mock";
}

/** CLOVA 필수 설정을 env 에서 읽어 검증. 누락 키 목록을 함께 돌려준다. */
export function resolveClovaConfig(
  env: Record<string, string | undefined> = process.env,
): { ok: true; config: ClovaConfig } | { ok: false; missing: string[] } {
  const missing = CLOVA_ENV_KEYS.filter((k) => {
    const val = env[k];
    return val == null || val.trim() === "";
  });
  if (missing.length > 0) return { ok: false, missing };
  return {
    ok: true,
    config: {
      apiKeyId: env.CLOVA_API_KEY_ID as string,
      apiKey: env.CLOVA_API_KEY as string,
      contactCenterId: env.CLOVA_CONTACT_CENTER_ID as string,
      agentId: env.CLOVA_AGENT_ID as string,
      callerNumber: env.CLOVA_CALLER_NUMBER as string,
      apiBaseUrl: env.CLOVA_API_BASE_URL?.trim() || undefined,
    },
  };
}

export type TelephonySelection =
  | { ok: true; provider: "mock"; mode: "sync"; adapter: TelephonyAdapter }
  | { ok: true; provider: "clova"; mode: "async"; adapter: TelephonyAdapter }
  | { ok: false; provider: "clova"; reason: "missing_config"; missing: string[] };

/**
 * 실행 컨텍스트용 어댑터 선택.
 *   - mock: 항상 ok(sync).
 *   - clova: 설정 검증 통과 시 ok(async), 미비 시 ok:false(missing_config) → 호출자는
 *     발신을 시도하지 말고 로그 후 skip 해야 한다.
 */
export function selectTelephony(
  env: Record<string, string | undefined> = process.env,
): TelephonySelection {
  const provider = getConfiguredProvider(env.TELEPHONY_PROVIDER);
  if (provider === "mock") {
    return { ok: true, provider: "mock", mode: "sync", adapter: new MockAdapter() };
  }
  const cfg = resolveClovaConfig(env);
  if (!cfg.ok) {
    return { ok: false, provider: "clova", reason: "missing_config", missing: cfg.missing };
  }
  return { ok: true, provider: "clova", mode: "async", adapter: new ClovaAdapter(cfg.config) };
}
