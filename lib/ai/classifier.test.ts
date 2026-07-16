import { describe, it, expect } from "vitest";
import {
  classify,
  classifyByRules,
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

describe("classify — 음성(VOICE) 폴백 (DTMF 없이 실시간 SpeechResult/전사)", () => {
  it("DTMF 턴 없이 VOICE 발화만으로 룰 판정(가속 경로)", async () => {
    // 음성 우선 전환: 실시간 SpeechResult 가 SENIOR/VOICE 턴으로 저장돼 룰 분류로 흐른다.
    const r = await classify([{ text: "네 아까 다 먹었어요", input_kind: "VOICE" }]);
    expect(r.status).toBe("DONE");
    expect(r.method).toBe("KEYWORD");
  });

  it("VOICE 부정 발화 → NOT_DONE", async () => {
    const r = await classify([{ text: "아직 안 먹었어", input_kind: "VOICE" }]);
    expect(r.status).toBe("NOT_DONE");
    expect(r.method).toBe("KEYWORD");
  });

  it("VOICE 모호 발화 + LLM 없음 → UNCERTAIN(억지 판정 금지)", async () => {
    const r = await classify([{ text: "어 그, 뭐더라", input_kind: "VOICE" }]);
    expect(r.status).toBe("UNCERTAIN");
    expect(r.method).toBe("NONE");
  });

  it("classifyByRules: VOICE 는 키워드, 애매하면 null(→ LLM/UNCERTAIN)", () => {
    expect(classifyByRules({ text: "네 먹었어요", input_kind: "VOICE" })).toEqual({ status: "DONE", method: "KEYWORD" });
    expect(classifyByRules({ text: "음 글쎄", input_kind: "VOICE" })).toBeNull();
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
    expect(classifyConsent({ text: "동의합니다", input_kind: "VOICE" })).toBe("GRANTED");
  });
  it("음성 우선 멘트 유도 거부 문구 '괜찮습니다' → DENIED", () => {
    // CONSENT 안내가 거부를 "괜찮습니다"로 유도하므로 이 문맥에서 '괜찮'은 거부.
    expect(classifyConsent({ text: "괜찮습니다", input_kind: "VOICE" })).toBe("DENIED");
    expect(classifyConsent({ text: "아니요 됐어요", input_kind: "VOICE" })).toBe("DENIED");
  });
  it("거부가 긍정 토큰보다 우선", () => {
    // "아니 그래" — 거부 우선.
    expect(classifyConsent({ text: "아니 그래도 싫어", input_kind: "VOICE" })).toBe("DENIED");
  });
  it("애매 → UNCERTAIN(미기록)", () => {
    expect(classifyConsent({ text: "어어 뭐라고", input_kind: "VOICE" })).toBe("UNCERTAIN");
  });
});
