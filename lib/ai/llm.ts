/**
 * LLM 클라이언트 추상화 (CLAUDE.md `## 가드레일`, `## 기술 스택`).
 *
 * 백엔드 선택(우선순위):
 *   ① ANTHROPIC_API_KEY 있으면 Anthropic Messages API (기존 경로 유지).
 *   ② 없고 GEMINI_API_KEY 있으면 Google Gemini generateContent (신규, 현재 기본 사용).
 *   ③ 둘 다 없으면 complete() 가 항상 null 을 반환하는 **스텁 경로** →
 *      분류는 룰만으로, 요약은 템플릿만으로 진행(결정적).
 *
 * - 어느 백엔드든 SDK 미설치, fetch 직접 호출.
 * - 통화당 LLM 호출 최대 2회(가드레일 3) — 세션 단위 클라이언트가 카운터로 강제.
 * - 의료 조언 생성 금지 시스템 프롬프트(가드레일 1). PII(이름/전화)·API 키 미로깅.
 * - API 오류·파싱 실패·타임아웃 시 반드시 null 로 강등 → 호출자가 룰/템플릿 fallback.
 *   절대 throw 로 통화 파이프라인을 죽이지 않는다.
 */

/** 분류·요약 프롬프트 버전 — call_reports.prompt_version 에 기록. */
export const PROMPT_VERSION = "ars-v1-2026-07-15";

/** 통화당 LLM 호출 상한 (가드레일 3). */
export const MAX_LLM_CALLS_PER_SESSION = 2;

/** LLM 호출 타임아웃(ms) — 통화 후 배치라 여유롭게. 초과 시 abort → null 강등. */
const LLM_TIMEOUT_MS = 8000;

// ── Anthropic (백엔드 ①) ──────────────────────────────────────────────────────
/** haiku 계열 — 통화 후 배치 전용(스트리밍/실시간 금지). */
const ANTHROPIC_MODEL = "claude-3-5-haiku-latest";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

// ── Gemini (백엔드 ②) ─────────────────────────────────────────────────────────
/**
 * 기본 모델. GEMINI_MODEL 로 오버라이드 가능 — 계정/시점에 따라 사용 가능한
 * 모델이 다르므로(구형 모델은 무료 쿼터 0일 수 있음) 429/404 시 모델명을 먼저 확인.
 */
const GEMINI_DEFAULT_MODEL = "gemini-2.5-flash";
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/** 의료 조언 금지 공통 가드 — 모든 시스템 프롬프트 앞에 부착. */
export const MEDICAL_GUARD_PROMPT =
  "당신은 시니어 통화 응답을 분류·요약하는 보조자입니다. " +
  "의료적 진단·조언·처방을 절대 생성하지 마십시오. " +
  "통화에서 관찰된 사실만 다루고, 추측하지 마십시오.";

export type LlmClient = {
  /**
   * system+user 프롬프트로 1회 완성 요청.
   * 반환 null = 키 없음(스텁) / 호출 budget 초과 / 네트워크·파싱 오류.
   * 호출자는 null 을 "LLM 사용 불가"로 간주해 룰/템플릿 fallback 해야 한다.
   */
  complete: (system: string, user: string) => Promise<string | null>;
  /** 지금까지 소비한 LLM 호출 수(가드레일 3 관측용). */
  callsUsed: () => number;
};

/** 백엔드 1회 호출 시그니처 — 성공 시 텍스트, 실패/빈 응답 시 null(throw 금지). */
type Backend = (system: string, user: string) => Promise<string | null>;

// ── 응답 파싱 (순수 함수 — 유닛 테스트 대상) ──────────────────────────────────
/** Anthropic Messages 응답에서 첫 text 블록 추출. 없으면 null. */
export function parseAnthropicText(json: unknown): string | null {
  const content = (json as { content?: Array<{ type?: string; text?: string }> })?.content;
  if (!Array.isArray(content)) return null;
  const text = content.find((c) => c?.type === "text")?.text?.trim();
  return text && text.length > 0 ? text : null;
}

/**
 * Gemini generateContent 응답에서 텍스트 추출 (방어적).
 * candidates[0].content.parts[].text 를 이어붙인다. 빈 candidates·구조 이상·
 * safety 차단(parts 없음) 등 모든 이상 케이스는 null 로 강등.
 */
export function parseGeminiText(json: unknown): string | null {
  const candidates = (json as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  })?.candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  const parts = candidates[0]?.content?.parts;
  if (!Array.isArray(parts) || parts.length === 0) return null;
  const text = parts
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .join("")
    .trim();
  return text.length > 0 ? text : null;
}

// ── 백엔드 구현 ───────────────────────────────────────────────────────────────
function anthropicBackend(apiKey: string): Backend {
  return async (system, user) => {
    try {
      const res = await fetchWithTimeout(ANTHROPIC_URL, {
        method: "POST",
        cache: "no-store",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": ANTHROPIC_VERSION,
        },
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 256,
          system: `${MEDICAL_GUARD_PROMPT}\n\n${system}`,
          messages: [{ role: "user", content: user }],
        }),
      });
      if (!res.ok) {
        // 상태 코드만 로깅 — 프롬프트(PII 가능) 원문은 로깅하지 않는다.
        console.error("[llm] anthropic non-ok:", res.status);
        return null;
      }
      return parseAnthropicText(await res.json());
    } catch (err) {
      console.error("[llm] anthropic fetch failed:", err instanceof Error ? err.name : "error");
      return null;
    }
  };
}

function geminiBackend(apiKey: string, model: string): Backend {
  return async (system, user) => {
    // 키는 쿼리스트링으로 전달되므로 URL 자체를 절대 로깅하지 않는다.
    const url = `${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    try {
      const res = await fetchWithTimeout(url, {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          // Gemini 는 별도 system role 대신 systemInstruction 사용.
          systemInstruction: { parts: [{ text: `${MEDICAL_GUARD_PROMPT}\n\n${system}` }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          // maxOutputTokens 상향(2026-07-16 실콜 요약 잘림 수정): Gemini 2.5 계열은 응답 토큰
          // 예산을 내부 "thinking" 에 먼저 소비한다. 256 이면 thinking 이 예산을 거의 다 써
          // 실제 출력이 잘리거나(finishReason=MAX_TOKENS) 비게 된다("어르신께 저녁 약 복"에서 잘림
          // 관찰). thinkingConfig.thinkingBudget=0 으로 thinking 을 끄고(분류·요약 배치엔 불필요)
          // 출력 상한을 넉넉히 둔다 → 3줄 요약이 온전히 반환된다.
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0,
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });
      if (!res.ok) {
        // 상태 코드만 로깅 — URL(키 포함)·프롬프트(PII 가능) 원문 미로깅.
        console.error("[llm] gemini non-ok:", res.status);
        return null;
      }
      return parseGeminiText(await res.json());
    } catch (err) {
      console.error("[llm] gemini fetch failed:", err instanceof Error ? err.name : "error");
      return null;
    }
  };
}

/** AbortController 기반 타임아웃 래퍼. 초과 시 fetch 가 throw → 백엔드에서 null 강등. */
async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 백엔드 선택 (우선순위: Anthropic 키 > Gemini 키 > 스텁).
 * @param anthropicKey ANTHROPIC_API_KEY (명시 전달 가능).
 * @returns 호출 가능한 Backend, 또는 키가 전혀 없으면 null(스텁).
 */
export function selectBackend(
  anthropicKey: string | undefined,
  geminiKey: string | undefined = process.env.GEMINI_API_KEY,
  geminiModel: string | undefined = process.env.GEMINI_MODEL,
): Backend | null {
  if (anthropicKey) return anthropicBackend(anthropicKey);
  if (geminiKey) return geminiBackend(geminiKey, geminiModel || GEMINI_DEFAULT_MODEL);
  return null; // 스텁
}

/**
 * 세션 단위 LLM 클라이언트 생성. 통화 1건마다 하나씩 만들어 호출 budget 을 격리한다.
 * @param apiKey ANTHROPIC_API_KEY (미지정 시 env). 없으면 GEMINI_API_KEY(env)로 Gemini,
 *               그마저 없으면 스텁(null 반환).
 */
export function createLlmClient(
  apiKey: string | undefined = process.env.ANTHROPIC_API_KEY,
  /**
   * 이 클라이언트가 허용할 최대 LLM 호출 수. 기본 상한(2). 전사 백필 재분류처럼 세션이 이미
   * 일부 호출을 소비한 경우, 남은 예산(2 - 기소비)만큼만 허용해 통화당 총 2회 상한을 지킨다.
   * 0 이면 항상 null(룰/템플릿만).
   */
  maxCalls: number = MAX_LLM_CALLS_PER_SESSION,
): LlmClient {
  let used = 0;
  const budget = Math.max(0, Math.min(maxCalls, MAX_LLM_CALLS_PER_SESSION));
  const backend = selectBackend(apiKey);

  return {
    callsUsed: () => used,
    complete: async (system: string, user: string): Promise<string | null> => {
      if (!backend) return null; // 스텁 경로(키 없음)
      if (used >= budget) return null; // 가드레일 3(세션 예산)
      used += 1;
      return backend(system, user); // 백엔드가 모든 오류를 null 로 강등(throw 없음)
    },
  };
}
