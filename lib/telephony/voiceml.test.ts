import { describe, it, expect } from "vitest";
import { buildVoiceML, escapeXml, type VoiceMLParams } from "./voiceml";

const nextAction: VoiceMLParams["nextAction"] = (params) =>
  "https://x.test/api/telephony/voiceml?session=s1&token=t1&" + new URLSearchParams(params).toString();

function base(over: Partial<VoiceMLParams>): VoiceMLParams {
  return { purpose: "SCHEDULE", step: "intro", nextAction, ...over };
}

describe("escapeXml", () => {
  it("XML 특수문자 5종 이스케이프", () => {
    expect(escapeXml(`<a & b > "c" 'd'`)).toBe("&lt;a &amp; b &gt; &quot;c&quot; &apos;d&apos;");
  });
});

describe("buildVoiceML — SCHEDULE", () => {
  it("intro: 인사+고지+음성 유도 Say + speech dtmf Gather + SYSTEM 턴", () => {
    const r = buildVoiceML(base({ step: "intro", scriptTemplate: "혈압약" }));
    expect(r.xml).toContain("<Response>");
    expect(r.xml).toContain("혈압약 확인 전화예요");
    expect(r.xml).toContain("자녀분께 전달"); // 녹음·전사 고지
    // 음성 우선: 버튼 안내 제거, 음성 답변 유도 멘트.
    expect(r.xml).toContain("말씀해 주세요");
    expect(r.xml).not.toContain("눌러 주세요");
    // Gather 는 speech+dtmf(silent fallback), 한국어 인식, 자동 발화 종료.
    expect(r.xml).toContain('<Gather input="speech dtmf" numDigits="1"');
    expect(r.xml).toContain('speechTimeout="auto"');
    expect(r.xml).toContain('language="ko-KR"');
    expect(r.xml).toContain("step=answer");
    expect(r.turns).toHaveLength(1);
    expect(r.turns[0]).toMatchObject({ role: "SYSTEM", input_kind: "VOICE" });
  });

  it("intro: script_template 의 XML 특수문자 이스케이프", () => {
    const r = buildVoiceML(base({ step: "intro", scriptTemplate: "약 <먹기> & 물" }));
    expect(r.xml).toContain("약 &lt;먹기&gt; &amp; 물");
    expect(r.xml).not.toContain("<먹기>");
  });

  it("answer + DTMF 1: 기분 질문 Pause + 종료 Hangup + DTMF/SYSTEM 턴", () => {
    const r = buildVoiceML(base({ step: "answer", digits: "1" }));
    expect(r.xml).toContain("기분은 좀 어떠세요");
    expect(r.xml).toContain("<Pause");
    expect(r.xml).toContain("<Hangup/>");
    expect(r.xml).not.toContain("<Gather"); // 종료 흐름 — 더 안 물음
    expect(r.turns[0]).toEqual({ role: "SENIOR", input_kind: "DTMF", text: "1" });
  });

  it("answer + DTMF 2/3 도 유효 처리(종료 흐름)", () => {
    for (const d of ["2", "3"]) {
      const r = buildVoiceML(base({ step: "answer", digits: d }));
      expect(r.turns[0]).toEqual({ role: "SENIOR", input_kind: "DTMF", text: d });
      expect(r.xml).toContain("<Hangup/>");
    }
  });

  it("answer + 음성 발화: SENIOR/VOICE 턴 저장 + 기분 질문 후 종료(이행 판정은 콜백)", () => {
    const r = buildVoiceML(base({ step: "answer", digits: "", speechResult: "네 아까 먹었어요" }));
    expect(r.xml).toContain("기분은 좀 어떠세요");
    expect(r.xml).toContain("<Hangup/>");
    expect(r.xml).not.toContain("<Gather"); // 발화 있으면 재질문 없음
    expect(r.turns[0]).toEqual({ role: "SENIOR", input_kind: "VOICE", text: "네 아까 먹었어요" });
    expect(r.turns.some((t) => t.input_kind === "DTMF")).toBe(false);
  });

  it("answer: DTMF 가 있으면 음성보다 우선(silent fallback)", () => {
    const r = buildVoiceML(base({ step: "answer", digits: "2", speechResult: "아무 말" }));
    expect(r.turns[0]).toEqual({ role: "SENIOR", input_kind: "DTMF", text: "2" });
    expect(r.turns.some((t) => t.input_kind === "VOICE" && t.role === "SENIOR")).toBe(false);
  });

  it("answer 무입력(첫 응답): 1회 재질문 speech Gather(reask=1), DTMF 턴 없음", () => {
    const r = buildVoiceML(base({ step: "answer", digits: "", reasked: false }));
    expect(r.xml).toContain('<Gather input="speech dtmf"');
    expect(r.xml).toContain("reask=1");
    expect(r.xml).toContain("말씀해 주세요"); // 재질문도 음성 유도
    expect(r.turns.every((t) => t.input_kind !== "DTMF")).toBe(true);
  });

  it("answer 무입력(재질문 후): UNCERTAIN 흐름 — 기분 후 종료, DTMF 턴 없음", () => {
    const r = buildVoiceML(base({ step: "answer", digits: "", reasked: true }));
    expect(r.xml).toContain("<Hangup/>");
    expect(r.xml).not.toContain("<Gather");
    expect(r.turns.some((t) => t.input_kind === "DTMF")).toBe(false);
  });

  it("answer 불명확 입력(9): 무입력과 동일하게 재질문", () => {
    const r = buildVoiceML(base({ step: "answer", digits: "9", reasked: false }));
    expect(r.xml).toContain("reask=1");
    expect(r.turns.some((t) => t.input_kind === "DTMF")).toBe(false);
  });
});

describe("buildVoiceML — CONSENT", () => {
  it("intro: 동의 안내+고지 Say + speech dtmf Gather + SYSTEM 턴(음성 유도)", () => {
    const r = buildVoiceML(base({ purpose: "CONSENT", step: "intro" }));
    expect(r.xml).toContain("안부 확인 서비스");
    expect(r.xml).toContain("동의합니다"); // 음성 유도 멘트
    expect(r.xml).toContain("괜찮습니다");
    expect(r.xml).not.toContain("눌러 주세요");
    expect(r.xml).toContain('<Gather input="speech dtmf"');
    expect(r.turns[0].role).toBe("SYSTEM");
  });

  it("answer 음성 동의: GRANTED → 동의 종료 + SENIOR/VOICE 턴", () => {
    const r = buildVoiceML(base({ purpose: "CONSENT", step: "answer", speechResult: "네 동의합니다" }));
    expect(r.xml).toContain("잘 챙겨드릴게요");
    expect(r.xml).toContain("<Hangup/>");
    expect(r.turns[0]).toEqual({ role: "SENIOR", input_kind: "VOICE", text: "네 동의합니다" });
  });

  it("answer 음성 거부: DENIED → 거부 종료 + SENIOR/VOICE 턴", () => {
    const r = buildVoiceML(base({ purpose: "CONSENT", step: "answer", speechResult: "아니요 괜찮습니다" }));
    expect(r.xml).toContain("언제든 자녀분께");
    expect(r.turns[0]).toEqual({ role: "SENIOR", input_kind: "VOICE", text: "아니요 괜찮습니다" });
  });

  it("answer 음성 애매(첫 응답): 재질문 Gather + 발화 턴 저장", () => {
    const r = buildVoiceML(base({ purpose: "CONSENT", step: "answer", speechResult: "어 뭐라고요", reasked: false }));
    expect(r.xml).toContain('<Gather input="speech dtmf"');
    expect(r.xml).toContain("reask=1");
    expect(r.turns[0]).toEqual({ role: "SENIOR", input_kind: "VOICE", text: "어 뭐라고요" });
  });

  it("answer 음성 애매(재질문 후): 미동의 종료(self_consent 미기록) + 발화 턴", () => {
    const r = buildVoiceML(base({ purpose: "CONSENT", step: "answer", speechResult: "음 글쎄요", reasked: true }));
    expect(r.xml).toContain("언제든 자녀분께");
    expect(r.xml).not.toContain("<Gather");
    expect(r.turns[0]).toEqual({ role: "SENIOR", input_kind: "VOICE", text: "음 글쎄요" });
  });

  it("answer DTMF 1: 동의 종료 멘트 + DTMF 턴", () => {
    const r = buildVoiceML(base({ purpose: "CONSENT", step: "answer", digits: "1" }));
    expect(r.xml).toContain("잘 챙겨드릴게요");
    expect(r.xml).toContain("<Hangup/>");
    expect(r.turns[0]).toEqual({ role: "SENIOR", input_kind: "DTMF", text: "1" });
  });

  it("answer DTMF 2: 거부 종료 멘트 + DTMF 턴", () => {
    const r = buildVoiceML(base({ purpose: "CONSENT", step: "answer", digits: "2" }));
    expect(r.xml).toContain("언제든 자녀분께");
    expect(r.turns[0]).toEqual({ role: "SENIOR", input_kind: "DTMF", text: "2" });
  });

  it("answer 무입력(첫): 재질문 Gather", () => {
    const r = buildVoiceML(base({ purpose: "CONSENT", step: "answer", digits: "", reasked: false }));
    expect(r.xml).toContain("<Gather");
    expect(r.xml).toContain("reask=1");
  });

  it("answer 무입력(재질문 후): 미동의 종료(self_consent 미기록), DTMF 턴 없음", () => {
    const r = buildVoiceML(base({ purpose: "CONSENT", step: "answer", digits: "", reasked: true }));
    expect(r.xml).toContain("<Hangup/>");
    expect(r.xml).not.toContain("<Gather");
    expect(r.turns.some((t) => t.input_kind === "DTMF")).toBe(false);
  });
});
