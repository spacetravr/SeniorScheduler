import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  parseGeminiText,
  parseAnthropicText,
  selectBackend,
  createLlmClient,
  MAX_LLM_CALLS_PER_SESSION,
} from "./llm";

// ── 응답 파싱: Gemini ─────────────────────────────────────────────────────────
describe("parseGeminiText", () => {
  it("정상 응답: candidates[0].content.parts[].text 를 이어붙인다", () => {
    const json = {
      candidates: [{ content: { parts: [{ text: "DONE" }] } }],
    };
    expect(parseGeminiText(json)).toBe("DONE");
  });

  it("여러 parts 를 연결하고 trim 한다", () => {
    const json = {
      candidates: [{ content: { parts: [{ text: "  안녕" }, { text: "하세요  " }] } }],
    };
    expect(parseGeminiText(json)).toBe("안녕하세요");
  });

  it("빈 candidates → null (억지 판정 금지)", () => {
    expect(parseGeminiText({ candidates: [] })).toBeNull();
  });

  it("candidates 자체가 없음(safety 차단 등) → null", () => {
    expect(parseGeminiText({ promptFeedback: { blockReason: "SAFETY" } })).toBeNull();
  });

  it("parts 없음(빈 content) → null", () => {
    expect(parseGeminiText({ candidates: [{ content: {} }] })).toBeNull();
  });

  it("JSON 구조 깨짐/타입 이상 → null (throw 금지)", () => {
    expect(parseGeminiText(null)).toBeNull();
    expect(parseGeminiText("not-json")).toBeNull();
    expect(parseGeminiText(42)).toBeNull();
    expect(parseGeminiText({ candidates: "wrong" })).toBeNull();
  });

  it("빈 문자열 parts → null", () => {
    const json = { candidates: [{ content: { parts: [{ text: "   " }] } }] };
    expect(parseGeminiText(json)).toBeNull();
  });
});

// ── 응답 파싱: Anthropic (회귀) ───────────────────────────────────────────────
describe("parseAnthropicText", () => {
  it("첫 text 블록 추출", () => {
    expect(parseAnthropicText({ content: [{ type: "text", text: "NOT_DONE" }] })).toBe("NOT_DONE");
  });
  it("text 블록 없음 → null", () => {
    expect(parseAnthropicText({ content: [{ type: "tool_use" }] })).toBeNull();
  });
  it("구조 이상 → null", () => {
    expect(parseAnthropicText(null)).toBeNull();
    expect(parseAnthropicText({})).toBeNull();
  });
});

// ── 백엔드 선택 우선순위 ──────────────────────────────────────────────────────
describe("selectBackend — 우선순위", () => {
  it("Anthropic 키 있으면 백엔드 반환(Anthropic 우선)", () => {
    expect(selectBackend("anthropic-key", "gemini-key")).not.toBeNull();
  });
  it("Anthropic 없고 Gemini 있으면 백엔드 반환", () => {
    expect(selectBackend(undefined, "gemini-key")).not.toBeNull();
  });
  it("둘 다 없으면 null(스텁)", () => {
    expect(selectBackend(undefined, undefined)).toBeNull();
  });
});

// ── fetch 모킹: Gemini 경로 & 폴백 강등 ───────────────────────────────────────
describe("createLlmClient — Gemini 백엔드 (fetch 모킹)", () => {
  const originalFetch = global.fetch;
  const originalAnthropic = process.env.ANTHROPIC_API_KEY;
  const originalGemini = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY; // Gemini 경로 강제
    process.env.GEMINI_API_KEY = "test-gemini-key";
  });
  afterEach(() => {
    global.fetch = originalFetch;
    if (originalAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalAnthropic;
    if (originalGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGemini;
    vi.restoreAllMocks();
  });

  it("200 정상 응답 → 텍스트 반환, generativelanguage 엔드포인트 호출", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "DONE" }] } }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const llm = createLlmClient(); // env: Gemini only
    const out = await llm.complete("system", "user");
    expect(out).toBe("DONE");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("generativelanguage.googleapis.com");
    expect(calledUrl).toContain(":generateContent");
  });

  it("GEMINI_MODEL 오버라이드가 URL 에 반영", async () => {
    process.env.GEMINI_MODEL = "gemini-2.5-flash-lite";
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const llm = createLlmClient();
    await llm.complete("s", "u");
    expect(fetchMock.mock.calls[0][0] as string).toContain("gemini-2.5-flash-lite");
    delete process.env.GEMINI_MODEL;
  });

  it("비200(예: 429) → null 로 강등, throw 안 함", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 }) as unknown as typeof fetch;
    const llm = createLlmClient();
    await expect(llm.complete("s", "u")).resolves.toBeNull();
    errSpy.mockRestore();
  });

  it("빈 candidates 응답 → null 강등", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [] }),
    }) as unknown as typeof fetch;
    const llm = createLlmClient();
    await expect(llm.complete("s", "u")).resolves.toBeNull();
  });

  it("JSON 파싱 예외 → null 강등, throw 안 함", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error("broken json");
      },
    }) as unknown as typeof fetch;
    const llm = createLlmClient();
    await expect(llm.complete("s", "u")).resolves.toBeNull();
    errSpy.mockRestore();
  });

  it("네트워크 예외(fetch reject) → null 강등, throw 안 함", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNRESET")) as unknown as typeof fetch;
    const llm = createLlmClient();
    await expect(llm.complete("s", "u")).resolves.toBeNull();
    errSpy.mockRestore();
  });

  it("통화당 호출 상한(가드레일 3) 초과 시 null, fetch 미호출", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    const llm = createLlmClient();
    for (let i = 0; i < MAX_LLM_CALLS_PER_SESSION; i++) await llm.complete("s", "u");
    const over = await llm.complete("s", "u");
    expect(over).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(MAX_LLM_CALLS_PER_SESSION);
    expect(llm.callsUsed()).toBe(MAX_LLM_CALLS_PER_SESSION);
  });
});

// ── 스텁 경로 (키 전무) ───────────────────────────────────────────────────────
describe("createLlmClient — 스텁 경로", () => {
  const originalAnthropic = process.env.ANTHROPIC_API_KEY;
  const originalGemini = process.env.GEMINI_API_KEY;
  afterEach(() => {
    if (originalAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalAnthropic;
    if (originalGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = originalGemini;
  });

  it("키가 전혀 없으면 complete() 는 항상 null (네트워크 미접촉)", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    const fetchSpy = vi.spyOn(global, "fetch");
    const llm = createLlmClient();
    await expect(llm.complete("s", "u")).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
