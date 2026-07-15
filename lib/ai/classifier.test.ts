import { describe, it, expect } from "vitest";
import {
  classify,
  classifyDtmf,
  classifyKeywords,
  classifyConsent,
} from "./classifier";
import { ADHERENCE_CASES } from "./eval/cases";

describe("classify — 회귀 케이스셋 (LLM 없이 룰만, 결정적)", () => {
  it("케이스가 20개 이상이고 UNCERTAIN 정답이 다수 포함", () => {
    expect(ADHERENCE_CASES.length).toBeGreaterThanOrEqual(20);
    const uncertain = ADHERENCE_CASES.filter((c) => c.expect === "UNCERTAIN");
    expect(uncertain.length).toBeGreaterThanOrEqual(4);
  });

  for (const c of ADHERENCE_CASES) {
    it(c.name, async () => {
      const result = await classify(c.responses); // llm 미지정 → 스텁 경로
      expect(result.status).toBe(c.expect);
    });
  }
});

describe("classifyDtmf", () => {
  it("1/2/3 매핑, 그 외 null", () => {
    expect(classifyDtmf("1")).toBe("DONE");
    expect(classifyDtmf("2")).toBe("NOT_DONE");
    expect(classifyDtmf("3")).toBe("POSTPONED");
    expect(classifyDtmf("0")).toBeNull();
    expect(classifyDtmf("")).toBeNull();
  });
});

describe("classifyKeywords — 우선순위(부정>연기>긍정)", () => {
  it("부정이 긍정 토큰보다 우선", () => {
    expect(classifyKeywords("안 먹었어")).toBe("NOT_DONE");
  });
  it("부정이 연기보다 우선", () => {
    expect(classifyKeywords("아직 안 먹었어 이따 먹을게")).toBe("NOT_DONE");
  });
  it("모호 → null", () => {
    expect(classifyKeywords("그래 그래")).toBeNull();
  });
});

describe("classifyConsent — 동의 콜 판정", () => {
  it("DTMF 1=GRANTED, 2=DENIED", () => {
    expect(classifyConsent({ text: "1", input_kind: "DTMF" })).toBe("GRANTED");
    expect(classifyConsent({ text: "2", input_kind: "DTMF" })).toBe("DENIED");
  });
  it("음성 동의/거부", () => {
    expect(classifyConsent({ text: "네 좋아요", input_kind: "VOICE" })).toBe("GRANTED");
    expect(classifyConsent({ text: "아니 싫어요", input_kind: "VOICE" })).toBe("DENIED");
  });
  it("거부가 긍정 토큰보다 우선", () => {
    // "아니 그래" — 거부 우선.
    expect(classifyConsent({ text: "아니 그래도 싫어", input_kind: "VOICE" })).toBe("DENIED");
  });
  it("애매 → UNCERTAIN(미기록)", () => {
    expect(classifyConsent({ text: "어어 뭐라고", input_kind: "VOICE" })).toBe("UNCERTAIN");
  });
});
