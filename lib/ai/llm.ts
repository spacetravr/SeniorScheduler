/**
 * LLM 클라이언트 추상화 (CLAUDE.md `## 가드레일`, `## 기술 스택`).
 *
 * - ANTHROPIC_API_KEY 없으면 complete() 가 항상 null 을 반환하는 **스텁 경로**가
 *   기본 동작(현재 키 없음). 이때 분류는 룰만으로, 요약은 템플릿만으로 진행된다.
 * - 키가 있으면 Anthropic Messages API 를 fetch 로 직접 호출(SDK 미설치).
 * - 통화당 LLM 호출 최대 2회(가드레일 3) — 세션 단위 클라이언트가 카운터로 강제.
 * - 의료 조언 생성 금지 시스템 프롬프트(가드레일 1). PII(이름/전화) 미로깅.
 */

/** 분류·요약 프롬프트 버전 — call_reports.prompt_version 에 기록. */
export const PROMPT_VERSION = "ars-v1-2026-07-15";

/** 통화당 LLM 호출 상한 (가드레일 3). */
export const MAX_LLM_CALLS_PER_SESSION = 2;

/** haiku 계열 — 통화 후 배치 전용(스트리밍/실시간 금지). */
const ANTHROPIC_MODEL = "claude-3-5-haiku-latest";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

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

/**
 * 세션 단위 LLM 클라이언트 생성. 통화 1건마다 하나씩 만들어 호출 budget 을 격리한다.
 * @param apiKey 미지정 시 process.env.ANTHROPIC_API_KEY(없으면 스텁).
 */
export function createLlmClient(apiKey: string | undefined = process.env.ANTHROPIC_API_KEY): LlmClient {
  let used = 0;

  return {
    callsUsed: () => used,
    complete: async (system: string, user: string): Promise<string | null> => {
      if (!apiKey) return null; // 스텁 경로(기본)
      if (used >= MAX_LLM_CALLS_PER_SESSION) return null; // 가드레일 3
      used += 1;

      try {
        const res = await fetch(ANTHROPIC_URL, {
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

        const json = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
        const text = json.content?.find((c) => c.type === "text")?.text?.trim();
        return text && text.length > 0 ? text : null;
      } catch (err) {
        console.error("[llm] anthropic fetch failed:", err instanceof Error ? err.name : "error");
        return null;
      }
    },
  };
}
