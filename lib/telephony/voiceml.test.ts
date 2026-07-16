import { describe, it, expect } from "vitest";
import { buildVoiceML, escapeXml, type VoiceMLParams } from "./voiceml";
import {
  MOOD_QUESTION,
  CHAT_TURNS,
  WARM_CLOSING,
  WARM_GATHER_TIMEOUT_SEC,
} from "@/lib/calls/warm-talk";

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

  it("answer + DTMF 1: 기분 질문 speech Gather(→mood) + DTMF/SYSTEM 마커 턴(종료 아님)", () => {
    const r = buildVoiceML(base({ step: "answer", digits: "1" }));
    expect(r.xml).toContain("기분은 좀 어떠세요");
    // 적응형 듣기: 고정 Pause 가 아니라 speech Gather 로 다음 스텝(mood)을 가리킴.
    expect(r.xml).toContain('<Gather input="speech"');
    expect(r.xml).not.toContain("<Pause");
    expect(r.xml).toContain("step=mood");
    expect(r.xml).not.toContain("<Hangup/>"); // 아직 종료 아님 — 대화 이어짐
    expect(r.turns[0]).toEqual({ role: "SENIOR", input_kind: "DTMF", text: "1" });
    // 기분 질문 SYSTEM 마커(경계) 기록.
    expect(r.turns.some((t) => t.role === "SYSTEM" && t.text.includes(MOOD_QUESTION))).toBe(true);
  });

  it("answer + DTMF 2/3 도 유효 처리(기분 질문으로 진입)", () => {
    for (const d of ["2", "3"]) {
      const r = buildVoiceML(base({ step: "answer", digits: d }));
      expect(r.turns[0]).toEqual({ role: "SENIOR", input_kind: "DTMF", text: d });
      expect(r.xml).toContain("step=mood");
      expect(r.xml).toContain(MOOD_QUESTION);
    }
  });

  it("answer + 음성 발화: SENIOR/VOICE 턴 저장 + 기분 질문 Gather(→mood)", () => {
    const r = buildVoiceML(base({ step: "answer", digits: "", speechResult: "네 아까 먹었어요" }));
    expect(r.xml).toContain("기분은 좀 어떠세요");
    expect(r.xml).toContain('<Gather input="speech"');
    expect(r.xml).toContain("step=mood");
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

  it("answer 무입력(재질문 후): UNCERTAIN 흐름 — SENIOR 턴 없이 기분 질문(→mood) 진입", () => {
    const r = buildVoiceML(base({ step: "answer", digits: "", reasked: true }));
    expect(r.xml).toContain("step=mood");
    expect(r.xml).toContain(MOOD_QUESTION);
    // 억지 판정 금지: 무입력이므로 SENIOR 응답 턴은 남기지 않는다.
    expect(r.turns.some((t) => t.role === "SENIOR")).toBe(false);
  });

  it("answer 불명확 입력(9): 무입력과 동일하게 재질문", () => {
    const r = buildVoiceML(base({ step: "answer", digits: "9", reasked: false }));
    expect(r.xml).toContain("reask=1");
    expect(r.turns.some((t) => t.input_kind === "DTMF")).toBe(false);
  });
});

describe("buildVoiceML — SCHEDULE 따뜻한 대화(적응형 Gather 스텝)", () => {
  // 공통: 자유 발화 Gather 는 speech-only + auto 종료 감지 + timeout 상한 + 다음 스텝 action.
  function expectSpeechGather(xml: string, nextStep: string) {
    expect(xml).toContain('<Gather input="speech"');
    expect(xml).toContain('speechTimeout="auto"');
    expect(xml).toContain('language="ko-KR"');
    expect(xml).toContain(`timeout="${WARM_GATHER_TIMEOUT_SEC}"`);
    expect(xml).toContain(`step=${nextStep}`);
    // 자유 발화 턴은 DTMF/numDigits 를 유도하지 않는다(판정 대상 아님).
    expect(xml).not.toContain("numDigits");
    expect(xml).not.toContain("input=\"speech dtmf\"");
  }

  // 세 answer 브랜치(DTMF·음성·재질문 후 무입력) 모두 동일하게 기분 질문(→mood)으로 진입.
  const answerBranches: Array<[string, Partial<VoiceMLParams>]> = [
    ["DTMF", { step: "answer", digits: "1" }],
    ["음성", { step: "answer", digits: "", speechResult: "네 먹었어요" }],
    ["재질문 후 무입력", { step: "answer", digits: "", reasked: true }],
  ];

  for (const [label, over] of answerBranches) {
    it(`answer(${label}) → 기분 질문 speech Gather(→mood) + 경계 마커 SYSTEM 턴`, () => {
      const r = buildVoiceML(base(over));
      expect(r.xml).toContain(MOOD_QUESTION);
      expectSpeechGather(r.xml, "mood");
      expect(r.xml).not.toContain("<Hangup/>"); // 아직 대화 진행
      // 기분 SYSTEM 마커(경계) 기록.
      const sys = r.turns.filter((t) => t.role === "SYSTEM");
      expect(sys).toHaveLength(1);
      expect(sys[0].text).toContain(MOOD_QUESTION);
    });
  }

  it("스텝 라우팅: answer→mood→chat1→chat2→closing 순서로 질문·action 연결", () => {
    // answer → 기분 질문, action=mood
    const a = buildVoiceML(base({ step: "answer", digits: "1" }));
    expect(a.xml).toContain(MOOD_QUESTION);
    expect(a.xml).toContain("step=mood");

    // mood → 일상 질문1, action=chat1 (기분 답 SpeechResult 저장)
    const m = buildVoiceML(base({ step: "mood", speechResult: "그냥 그래요" }));
    expect(m.xml).toContain(CHAT_TURNS[0].question);
    expect(m.xml).toContain(CHAT_TURNS[0].ack);
    expect(m.xml).toContain("step=chat1");
    expect(m.turns[0]).toEqual({ role: "SENIOR", input_kind: "VOICE", text: "그냥 그래요" });
    expect(m.turns.some((t) => t.role === "SYSTEM" && t.text.includes(CHAT_TURNS[0].question))).toBe(true);

    // chat1 → 일상 질문2, action=chat2
    const c1 = buildVoiceML(base({ step: "chat1", speechResult: "밥 먹었어요" }));
    expect(c1.xml).toContain(CHAT_TURNS[1].question);
    expect(c1.xml).toContain("step=chat2");
    expect(c1.turns[0]).toEqual({ role: "SENIOR", input_kind: "VOICE", text: "밥 먹었어요" });

    // chat2 → 따뜻한 마무리 + Hangup (종료 — 더 안 물음)
    const c2 = buildVoiceML(base({ step: "chat2", speechResult: "산책했어요" }));
    expect(c2.xml).toContain(WARM_CLOSING);
    expect(c2.xml).toContain("<Hangup/>");
    expect(c2.xml).not.toContain("<Gather");
    expect(c2.turns[0]).toEqual({ role: "SENIOR", input_kind: "VOICE", text: "산책했어요" });
    // closing 멘트는 SYSTEM 턴으로 남기지 않음(기존 관례).
    expect(c2.turns.some((t) => t.role === "SYSTEM")).toBe(false);
  });

  it("무발화(SpeechResult 없음)여도 각 스텝이 그냥 다음 질문/종결로 진행 — SENIOR 턴 없음", () => {
    // mood 무발화 → chat1 질문으로 진행, SENIOR 턴 없음.
    const m = buildVoiceML(base({ step: "mood", speechResult: "" }));
    expect(m.xml).toContain(CHAT_TURNS[0].question);
    expect(m.xml).toContain("step=chat1");
    expect(m.turns.some((t) => t.role === "SENIOR")).toBe(false);

    // chat1 무발화 → chat2 질문으로 진행.
    const c1 = buildVoiceML(base({ step: "chat1" }));
    expect(c1.xml).toContain(CHAT_TURNS[1].question);
    expect(c1.xml).toContain("step=chat2");
    expect(c1.turns.some((t) => t.role === "SENIOR")).toBe(false);

    // chat2 무발화 → 마무리 후 종료.
    const c2 = buildVoiceML(base({ step: "chat2" }));
    expect(c2.xml).toContain(WARM_CLOSING);
    expect(c2.xml).toContain("<Hangup/>");
    expect(c2.turns).toHaveLength(0);
  });

  it("자유 발화 SpeechResult 는 공백 트림 후 SENIOR/VOICE 턴으로 저장", () => {
    const r = buildVoiceML(base({ step: "chat1", speechResult: "  천천히 걸었어요  " }));
    expect(r.turns[0]).toEqual({ role: "SENIOR", input_kind: "VOICE", text: "천천히 걸었어요" });
  });

  it("따뜻한 대화에는 의료 조언/버튼 안내 문구가 없다(가드레일)", () => {
    for (const step of ["answer", "mood", "chat1", "chat2"] as const) {
      const r = buildVoiceML(base({ step, digits: step === "answer" ? "1" : "" }));
      expect(r.xml).not.toContain("눌러 주세요");
      expect(r.xml).not.toMatch(/병원.*가세요|약.*드세요|진료/);
    }
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

  it("CONSENT 는 따뜻한 대화(기분/일상) 확장 대상이 아니다 — 종결부 없음", () => {
    for (const over of [
      { step: "answer" as const, digits: "1" },
      { step: "answer" as const, speechResult: "네 동의합니다" },
      { step: "answer" as const, speechResult: "아니요 괜찮습니다" },
    ]) {
      const r = buildVoiceML(base({ purpose: "CONSENT", ...over }));
      expect(r.xml).not.toContain(MOOD_QUESTION);
      expect(r.xml).not.toContain(CHAT_TURNS[0].question);
      expect(r.xml).not.toContain(WARM_CLOSING);
    }
  });
});
