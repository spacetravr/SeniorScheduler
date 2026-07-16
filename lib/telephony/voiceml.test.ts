import { describe, it, expect } from "vitest";
import { buildVoiceML, escapeXml, type VoiceMLParams } from "./voiceml";
import {
  MOOD_LEAD,
  MOOD_QUESTION,
  CHAT_TURNS,
  WARM_CLOSING,
  MOOD_PAUSE_SEC,
  CHAT_PAUSE_SEC,
} from "@/lib/calls/warm-talk";

const nextAction: VoiceMLParams["nextAction"] = (params) =>
  "https://x.test/api/telephony/voiceml?session=s1&token=t1&" + new URLSearchParams(params).toString();

function base(over: Partial<VoiceMLParams>): VoiceMLParams {
  return { purpose: "SCHEDULE", step: "intro", nextAction, ...over };
}

/** 따뜻한 종결부(기분→일상1→일상2→마무리+Hangup)가 단일 문서에 이어졌는지 검증. */
function expectWarmTail(xml: string) {
  expect(xml).toContain(MOOD_QUESTION);
  expect(xml).toContain(CHAT_TURNS[0].question);
  expect(xml).toContain(CHAT_TURNS[1].question);
  expect(xml).toContain(WARM_CLOSING);
  // 적응형 Gather 가 아니라 고정 Pause(듣기 상한)로 회귀.
  expect(xml).toContain(`<Pause length="${MOOD_PAUSE_SEC}"/>`);
  expect(xml).toContain(`<Pause length="${CHAT_PAUSE_SEC}"/>`);
  expect(xml).toContain("<Hangup/>");
  // 종결부 안에는 추가 Gather(다음 스텝 콜백)가 없다 — 단일 문서 완주.
  expect(xml).not.toContain("step=mood");
  expect(xml).not.toContain("step=chat");
}

describe("escapeXml", () => {
  it("XML 특수문자 5종 이스케이프", () => {
    expect(escapeXml(`<a & b > "c" 'd'`)).toBe("&lt;a &amp; b &gt; &quot;c&quot; &apos;d&apos;");
  });
});

describe("buildVoiceML — SCHEDULE 단일 문서", () => {
  it("intro: 인사+고지+질문 Gather(dtmf speech) + 같은 문서의 따뜻한 종결부", () => {
    const r = buildVoiceML(base({ step: "intro", scriptTemplate: "혈압약" }));
    expect(r.xml).toContain("<Response>");
    expect(r.xml).toContain("혈압약 확인 전화예요");
    expect(r.xml).toContain("자녀분께 전달"); // 녹음·전사 고지
    expect(r.xml).toContain("말씀해 주세요"); // 음성 유도(전사 수집)
    // DTMF 우선 Gather — action=answer 로 분기(speech 는 벤더가 action 미트리거).
    expect(r.xml).toContain('<Gather input="dtmf speech" numDigits="1"');
    expect(r.xml).toContain('language="ko-KR"');
    expect(r.xml).toContain("step=answer");
    // 같은 문서에서 따뜻한 종결부가 이어진다(action 이 안 와도 전체 재생).
    expectWarmTail(r.xml);
    // intro 는 응답 인지 멘트(MOOD_LEAD) 없이 기분 질문만.
    expect(r.xml).not.toContain(`${MOOD_LEAD} ${MOOD_QUESTION}`);
    // 턴: SYSTEM intro + 기분/일상1/일상2 경계 마커 3개.
    expect(r.turns).toHaveLength(4);
    expect(r.turns[0]).toMatchObject({ role: "SYSTEM", input_kind: "VOICE" });
    expect(r.turns.some((t) => t.role === "SYSTEM" && t.text.includes(MOOD_QUESTION))).toBe(true);
    expect(r.turns.some((t) => t.role === "SYSTEM" && t.text.includes(CHAT_TURNS[0].question))).toBe(true);
    expect(r.turns.some((t) => t.role === "SYSTEM" && t.text.includes(CHAT_TURNS[1].question))).toBe(true);
    // 시니어 발화 턴은 통화 후 전사로 수집 — intro 문서에는 SENIOR 턴 없음.
    expect(r.turns.some((t) => t.role === "SENIOR")).toBe(false);
  });

  it("intro: script_template 의 XML 특수문자 이스케이프", () => {
    const r = buildVoiceML(base({ step: "intro", scriptTemplate: "약 <먹기> & 물" }));
    expect(r.xml).toContain("약 &lt;먹기&gt; &amp; 물");
    expect(r.xml).not.toContain("<먹기>");
  });

  it("answer + DTMF 1: SENIOR/DTMF 턴 + 응답 인지 멘트 + 이어지는 따뜻한 종결부", () => {
    const r = buildVoiceML(base({ step: "answer", digits: "1" }));
    // 응답 인지(MOOD_LEAD) 후 기분부터 이어짐 — intro 와 중복되지 않게 기분부터 시작.
    expect(r.xml).toContain(`${MOOD_LEAD} ${MOOD_QUESTION}`);
    expect(r.xml).not.toContain("확인 전화예요"); // intro 멘트는 재생하지 않음(중복 방지)
    expectWarmTail(r.xml);
    expect(r.turns[0]).toEqual({ role: "SENIOR", input_kind: "DTMF", text: "1" });
    // 경계 마커 3개(기분/일상1/일상2).
    expect(r.turns.filter((t) => t.role === "SYSTEM")).toHaveLength(3);
  });

  it("answer + DTMF 2/3 도 유효 처리(따뜻한 종결부 진입)", () => {
    for (const d of ["2", "3"]) {
      const r = buildVoiceML(base({ step: "answer", digits: d }));
      expect(r.turns[0]).toEqual({ role: "SENIOR", input_kind: "DTMF", text: d });
      expectWarmTail(r.xml);
    }
  });

  it("answer + 음성 발화(벤더 speech action 지원 예외): SENIOR/VOICE 턴 저장 + 종결부", () => {
    const r = buildVoiceML(base({ step: "answer", digits: "", speechResult: "네 아까 먹었어요" }));
    expect(r.turns[0]).toEqual({ role: "SENIOR", input_kind: "VOICE", text: "네 아까 먹었어요" });
    expectWarmTail(r.xml);
    expect(r.turns.some((t) => t.input_kind === "DTMF")).toBe(false);
  });

  it("answer: DTMF 가 있으면 음성보다 우선(silent fallback)", () => {
    const r = buildVoiceML(base({ step: "answer", digits: "2", speechResult: "아무 말" }));
    expect(r.turns[0]).toEqual({ role: "SENIOR", input_kind: "DTMF", text: "2" });
    expect(r.turns.some((t) => t.input_kind === "VOICE" && t.role === "SENIOR")).toBe(false);
  });

  it("answer 무입력/불명확(예: DTMF 9): SENIOR 턴 없이 따뜻한 종결부만(UNCERTAIN — 콜백이 판정)", () => {
    for (const digits of ["", "9"]) {
      const r = buildVoiceML(base({ step: "answer", digits }));
      expect(r.turns.some((t) => t.role === "SENIOR")).toBe(false);
      expectWarmTail(r.xml);
      // 경계 마커 3개만.
      expect(r.turns.filter((t) => t.role === "SYSTEM")).toHaveLength(3);
    }
  });

  it("종결부 어디에도 의료 조언/재질문 콜백이 없다(가드레일)", () => {
    for (const over of [
      { step: "intro" as const, scriptTemplate: "혈압약" },
      { step: "answer" as const, digits: "1" },
    ]) {
      const r = buildVoiceML(base(over));
      expect(r.xml).not.toMatch(/병원.*가세요|약.*드세요|진료/);
    }
  });
});

describe("buildVoiceML — CONSENT", () => {
  it("intro: 동의 안내+고지 Say + dtmf speech Gather + SYSTEM 턴(음성 유도)", () => {
    const r = buildVoiceML(base({ purpose: "CONSENT", step: "intro" }));
    expect(r.xml).toContain("안부 확인 서비스");
    expect(r.xml).toContain("동의합니다"); // 음성 유도 멘트
    expect(r.xml).toContain("괜찮습니다");
    expect(r.xml).toContain('<Gather input="dtmf speech"');
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
    expect(r.xml).toContain('<Gather input="dtmf speech"');
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
