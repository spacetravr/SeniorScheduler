/**
 * VoiceML(TwiML 호환) 시나리오 빌더 — ClawOps 통화 연결 시 재생할 XML 생성.
 *
 * ── 호환 가정(주의) ──
 * ClawOps VoiceML 은 Twilio TwiML 호환으로 가정한다(`<Response>`, `<Say>`, `<Gather>`,
 * `<Pause>`, `<Hangup>`; `<Connect><Stream>` 존재 확인됨). **이 호환 가정은 실콜 E2E 에서
 * 검증 예정** — 태그/속성 이름이 다르면 이 파일만 조정한다(라우트·핸들러 로직 불변).
 *
 * ── 순수성(테스트) ──
 * 이 모듈은 순수하다: DB·네트워크·시계에 의존하지 않는다. 입력(step/digits/컨텍스트) →
 * XML 문자열 + 기록할 턴 목록만 반환한다. 라우트가 인증·DB·타임스탬프를 담당한다.
 *
 * ── 음성 우선(2026-07-16 결정) ──
 * 시니어가 키패드를 어려워하므로 응답을 **음성 우선**으로 유도한다. Gather 는
 * `input="speech dtmf"`(음성 우선 + DTMF silent fallback). 멘트는 버튼 안내를 빼고
 * 음성 답변("네, 먹었어요"·"아직이요")을 유도한다. 버튼을 눌러도 여전히 인식된다.
 *  - 벤더가 speech 를 미지원해도 파이프라인은 성립한다: SpeechResult 가 한 번도 안 와도
 *    통화는 재질문→기분→종료로 자연스럽게 완주하고, 최종 분류는 콜백 시 전사(transcript)
 *    기반으로 동작한다(speech Gather 는 있으면 좋은 가속 경로, 없어도 무방).
 *
 * ── 대화 두뇌 위임 금지(가드레일 4) ──
 * SCHEDULE 이행 판정은 여기서 하지 않는다(멘트 재생 + 응답 수집만). 실제 이행 분류는
 * lib/ai/classifier 가 콜백 완료 시 담당한다. CONSENT 만은 종료 멘트를 실시간으로 갈라야
 * 하므로(동의/거부 멘트), 판정 룰은 lib/ai 의 classifyConsent 를 그대로 호출한다(로직을
 * VoiceML 에 복제하지 않는다). 최종 self_consent 성사 판정도 콜백 시 동일 함수로 재확인된다.
 *
 * ── ARS+ 원칙(CLAUDE.md) ──
 * 무입력/불명확 시 1회 재질문 후 UNCERTAIN 흐름. 억지 판정 금지. 시니어 친화 존댓말·단문.
 *
 * ── 녹음 정책 ──
 * 우리는 전사(transcript)만 저장하고 녹음 파일은 다운로드·저장하지 않는다. 자유 발화(기분
 * 답변)는 <Pause> 동안 통화가 이어지며, 전사는 콜백 완료 시 ClawOps transcript API 로만
 * 수집한다(원본 오디오 미보관). ClawOps 측 자동 녹음 비활성화 옵션은 미확인 — docs 확인 항목.
 */

import { classifyConsent } from "@/lib/ai/classifier";
import {
  MOOD_LEAD,
  MOOD_QUESTION,
  CHAT_TURNS,
  WARM_CLOSING,
  MOOD_PAUSE_SEC,
  CHAT_PAUSE_SEC,
} from "@/lib/calls/warm-talk";

/** XML 특수문자 이스케이프(멘트·PII 삽입 대비 — script_template/이름 등). */
export function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const KO = 'language="ko-KR"';

/** <Say> 한국어 멘트. 텍스트는 이스케이프. */
function say(text: string): string {
  return `<Say ${KO}>${escapeXml(text)}</Say>`;
}

/** <Pause length=초> — 자유 발화(전사) 수집 시간 확보. */
function pause(seconds: number): string {
  return `<Pause length="${Math.max(1, Math.floor(seconds))}"/>`;
}

/**
 * <Gather> 음성 우선 + DTMF silent fallback 수집 → action(다음 스텝 URL)으로 되돌아옴.
 *
 * `input="speech dtmf"`: 음성 답변을 우선 인식하되, 버튼(DTMF 1자리)을 눌러도 즉시 수용한다.
 * `language="ko-KR"`(음성 인식 언어), `speechTimeout="auto"`(발화 종료 자동 감지).
 * 안내 멘트는 Gather 내부에 두어 입력 대기 중에도 재생되게 한다(TwiML 관례).
 *
 * 벤더가 speech 를 미지원하면 이 Gather 는 DTMF 만 수집하게 될 수 있으나, 그래도 무입력→
 * 재질문→기분/종료 흐름으로 완주하며 최종 분류는 콜백 시 전사 기반으로 성립한다.
 */
function gatherSpeechDtmf(actionUrl: string, prompt: string, timeoutSec = 8): string {
  return (
    `<Gather input="speech dtmf" numDigits="1" timeout="${timeoutSec}" ` +
    `speechTimeout="auto" ${KO} ` +
    `action="${escapeXml(actionUrl)}" method="POST">` +
    say(prompt) +
    `</Gather>`
  );
}

function wrap(inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`;
}

/** 기록할 턴(라우트가 session_id·타임스탬프를 주입해 call_turns 로 저장). */
export type VoiceMLTurn = {
  role: "SYSTEM" | "SENIOR";
  input_kind: "VOICE" | "DTMF";
  text: string;
};

export type VoiceMLResult = {
  xml: string;
  /** 이 스텝에서 call_turns 에 기록할 턴(순서 유지). 없으면 빈 배열. */
  turns: VoiceMLTurn[];
};

/** 녹음·전사 고지(첫 멘트에 포함) — 시니어 친화 단문. */
const RECORDING_NOTICE =
  "통화 내용은 요약을 위해 기록되며 자녀분께 전달돼요.";

// ── 멘트(존댓말·단문) ─────────────────────────────────────────────────────────
// scripts.ts(scheduleScript/CONSENT_SCRIPT)의 문구와 정합. 여기서는 VoiceML 스텝
// 구성에 맞춰 재사용/재배치한다.

function scheduleIntro(scriptTemplate: string): string {
  return (
    `안녕하세요. ${scriptTemplate} 확인 전화예요. ${RECORDING_NOTICE} ` +
    "하셨으면 '네, 했어요', 아직이면 '아직이요'처럼 말씀해 주세요."
  );
}
const SCHEDULE_REASK = "죄송해요, 잘 못 들었어요. 하셨으면 '네', 아직이면 '아직이요'라고 말씀해 주세요.";
// 일정 확인 이후 재생하는 기분/일상 대화 멘트는 lib/calls/warm-talk 에서 단일 소스로 관리한다
// (MOOD_LEAD/MOOD_QUESTION/CHAT_TURNS/WARM_CLOSING). 여기서는 재생 XML·기록 턴만 구성한다.

const CONSENT_INTRO =
  "안녕하세요. 자녀분이 신청하신 안부 확인 서비스예요. " +
  "앞으로 정해진 시간에 안내 전화를 드리고, " +
  RECORDING_NOTICE +
  " 동의하시면 '동의합니다', 원치 않으시면 '괜찮습니다'라고 말씀해 주세요.";
const CONSENT_REASK = "죄송해요, 잘 못 들었어요. 동의하시면 '동의합니다', 원치 않으시면 '괜찮습니다'라고 말씀해 주세요.";
const CONSENT_GRANTED_CLOSING = "감사합니다. 앞으로 잘 챙겨드릴게요.";
const CONSENT_DENIED_CLOSING = "네, 알겠습니다. 이용을 원하시면 언제든 자녀분께 말씀해 주세요.";

/** 스텝 종류(쿼리 step 값). */
export type VoiceMLStep = "intro" | "answer";

export type VoiceMLParams = {
  purpose: "SCHEDULE" | "CONSENT";
  step: VoiceMLStep;
  /** SCHEDULE 콜 안내에 넣을 일정 문구(schedule.script_template). CONSENT 는 무시. */
  scriptTemplate?: string;
  /** step=answer 에서 수집된 DTMF(빈 문자열/미입력이면 무입력 처리). */
  digits?: string;
  /**
   * step=answer 에서 수집된 음성 인식 결과(Gather SpeechResult). 벤더 미지원/무발화면 빈 문자열.
   * DTMF 가 있으면 DTMF 를 우선한다(silent fallback). 음성만 있으면 SENIOR/VOICE 턴으로 저장.
   */
  speechResult?: string;
  /** step=answer 가 재질문 후의 응답인가(true 면 재질문 소진 — 더 묻지 않음). */
  reasked?: boolean;
  /**
   * 다음 스텝 action URL 빌더(라우트가 session/token 을 담아 주입). 예:
   *   nextAction({ step: "answer", reask: "1" }) → ".../voiceml?session=..&token=..&step=answer&reask=1"
   */
  nextAction: (params: Record<string, string>) => string;
};

/** 유효 DTMF(1/2/3) 여부 — SCHEDULE. */
function isValidScheduleDigit(d: string | undefined): boolean {
  return d === "1" || d === "2" || d === "3";
}
/** 유효 DTMF(1/2) 여부 — CONSENT. */
function isValidConsentDigit(d: string | undefined): boolean {
  return d === "1" || d === "2";
}

/** 음성 인식 결과가 의미 있는 발화인가(공백 제거 후 비어있지 않음). */
function hasSpeech(speech: string | undefined): boolean {
  return (speech ?? "").trim() !== "";
}

/**
 * VoiceML 생성 — step/purpose 에 따라 XML + 기록 턴 반환.
 *
 * 흐름(SCHEDULE — 음성 우선 + 따뜻한 대화 확장):
 *   intro  → Say(인사+고지+음성 유도) + Gather(speech dtmf →answer)
 *   answer → [유효 DTMF] SENIOR/DTMF 턴 + 따뜻한 종결부(기분+일상 2턴+마무리)
 *          → [음성 발화] SENIOR/VOICE 턴 + 따뜻한 종결부 (이행 판정은 콜백 분류가)
 *          → [무입력 & 첫 응답] 재질문 Gather(→answer&reask=1)
 *          → [무입력 & 재질문 후] 따뜻한 종결부(UNCERTAIN — 판정은 콜백이)
 *
 * 따뜻한 종결부(scheduleWarmClose): 응답 인지(MOOD_LEAD)+기분 질문 → 긴 Pause → 일상 질문
 * 2턴(각 맞장구+질문+Pause) → 따뜻한 마무리 → Hangup. 자유 발화는 Pause 동안 이어지며 판정
 * 대상이 아니다(콜백 전사로 저장만). 재생 멘트는 SYSTEM 턴으로 기록 — 첫 SYSTEM(기분) 턴이
 * 콜백 분류의 자유-발화 경계 마커가 된다(run-call.ts splitAtFreeForm 참조).
 *
 * 흐름(CONSENT — 음성 우선):
 *   intro  → Say(안내+고지+음성 유도) + Gather(speech dtmf →answer)
 *   answer → [유효 DTMF 1/2] SENIOR/DTMF 턴 + 동의/거부 종료
 *          → [음성 GRANTED] SENIOR/VOICE 턴 + 동의 종료
 *          → [음성 DENIED]  SENIOR/VOICE 턴 + 거부 종료
 *          → [음성 UNCERTAIN & 첫 응답] SENIOR/VOICE 턴 + 재질문
 *          → [음성 UNCERTAIN & 재질문 후] SENIOR/VOICE 턴 + 거부 종료(미동의)
 *          → [무입력 & 첫 응답] 재질문 / [무입력 & 재질문 후] 거부 종료
 *   (종료 멘트 분기는 실시간 편의 — 최종 self_consent 성사 판정은 콜백 완료 시 저장된 턴으로
 *    evaluateConsentGranted(classifyConsent)가 재확인한다.)
 */
export function buildVoiceML(params: VoiceMLParams): VoiceMLResult {
  return params.purpose === "CONSENT" ? buildConsent(params) : buildSchedule(params);
}

/**
 * 따뜻한 종결부(SCHEDULE 공통) — 기분 질문 + 일상 대화 2턴 + 마무리 → Hangup.
 *
 * 각 자유 발화 질문 뒤에 긴 <Pause>(MOOD_PAUSE_SEC/CHAT_PAUSE_SEC)를 두어 시니어가 충분히
 * 말할 시간을 준다. 재생한 멘트는 SYSTEM 턴으로 기록한다(closing 멘트는 기록 생략 — 기존 관례).
 * 첫 SYSTEM 턴(기분)은 MOOD_QUESTION 을 포함하므로 콜백 분류의 자유-발화 경계 마커가 된다.
 *
 * @returns xml 과 기록할 SYSTEM 턴들(호출 브랜치가 앞에 SENIOR 턴을 덧붙인다).
 */
function scheduleWarmClose(): { xml: string; systemTurns: VoiceMLTurn[] } {
  const moodSay = `${MOOD_LEAD} ${MOOD_QUESTION}`;
  const parts: string[] = [say(moodSay), pause(MOOD_PAUSE_SEC)];
  const systemTurns: VoiceMLTurn[] = [{ role: "SYSTEM", input_kind: "VOICE", text: moodSay }];

  for (const c of CHAT_TURNS) {
    const chatSay = `${c.ack} ${c.question}`;
    parts.push(say(chatSay), pause(CHAT_PAUSE_SEC));
    systemTurns.push({ role: "SYSTEM", input_kind: "VOICE", text: chatSay });
  }

  parts.push(say(WARM_CLOSING), `<Hangup/>`);
  return { xml: wrap(parts.join("")), systemTurns };
}

function buildSchedule(params: VoiceMLParams): VoiceMLResult {
  const { step, digits, speechResult, reasked, nextAction } = params;
  const scriptTemplate = params.scriptTemplate ?? "일정";

  if (step === "intro") {
    const xml = wrap(
      say(scheduleIntro(scriptTemplate)) +
        gatherSpeechDtmf(nextAction({ step: "answer" }), "어떠세요?"),
    );
    // 안내 멘트를 SYSTEM 턴으로 기록(전사 대신 우리가 낸 멘트는 확정 텍스트).
    return { xml, turns: [{ role: "SYSTEM", input_kind: "VOICE", text: scheduleIntro(scriptTemplate) }] };
  }

  // step === "answer" — DTMF 우선(silent fallback) → 음성 → 무입력.
  if (isValidScheduleDigit(digits)) {
    // DTMF 확정 → 따뜻한 종결부(기분+일상 대화, 전사 저장만) 후 종료.
    const close = scheduleWarmClose();
    return {
      xml: close.xml,
      turns: [{ role: "SENIOR", input_kind: "DTMF", text: digits as string }, ...close.systemTurns],
    };
  }

  if (hasSpeech(speechResult)) {
    // 음성 발화 → SENIOR/VOICE 턴 저장 후 따뜻한 종결부로 진행(이행 판정은 콜백 분류가).
    const close = scheduleWarmClose();
    return {
      xml: close.xml,
      turns: [
        { role: "SENIOR", input_kind: "VOICE", text: (speechResult as string).trim() },
        ...close.systemTurns,
      ],
    };
  }

  // 무입력.
  if (!reasked) {
    // 1회 재질문(ARS+, 음성 유도).
    const xml = wrap(gatherSpeechDtmf(nextAction({ step: "answer", reask: "1" }), SCHEDULE_REASK));
    return { xml, turns: [{ role: "SYSTEM", input_kind: "VOICE", text: SCHEDULE_REASK }] };
  }

  // 재질문 후에도 무입력 → 억지 판정 금지(UNCERTAIN). 따뜻한 종결부 후 종료.
  const close = scheduleWarmClose();
  return { xml: close.xml, turns: close.systemTurns };
}

/** 동의/거부 종료 멘트 + 턴(SENIOR 턴 선행) 구성 헬퍼. */
function consentClose(granted: boolean, seniorTurn?: VoiceMLTurn): VoiceMLResult {
  const closing = granted ? CONSENT_GRANTED_CLOSING : CONSENT_DENIED_CLOSING;
  const xml = wrap(say(closing) + `<Hangup/>`);
  const turns: VoiceMLTurn[] = [];
  if (seniorTurn) turns.push(seniorTurn);
  turns.push({ role: "SYSTEM", input_kind: "VOICE", text: closing });
  return { xml, turns };
}

function buildConsent(params: VoiceMLParams): VoiceMLResult {
  const { step, digits, speechResult, reasked, nextAction } = params;

  if (step === "intro") {
    const xml = wrap(
      say(CONSENT_INTRO) + gatherSpeechDtmf(nextAction({ step: "answer" }), "동의하시나요?"),
    );
    return { xml, turns: [{ role: "SYSTEM", input_kind: "VOICE", text: CONSENT_INTRO }] };
  }

  // step === "answer" — DTMF 우선(silent fallback).
  if (isValidConsentDigit(digits)) {
    return consentClose(digits === "1", { role: "SENIOR", input_kind: "DTMF", text: digits as string });
  }

  // 음성 발화 → classifyConsent 로 실시간 종료 멘트 분기(판정 룰은 lib/ai 재사용).
  if (hasSpeech(speechResult)) {
    const text = (speechResult as string).trim();
    const seniorTurn: VoiceMLTurn = { role: "SENIOR", input_kind: "VOICE", text };
    const decision = classifyConsent({ text, input_kind: "VOICE" });
    if (decision === "GRANTED") return consentClose(true, seniorTurn);
    if (decision === "DENIED") return consentClose(false, seniorTurn);
    // UNCERTAIN: 첫 응답이면 1회 재질문(발화는 턴으로 저장), 재질문 후면 미동의 종료.
    if (!reasked) {
      const xml = wrap(gatherSpeechDtmf(nextAction({ step: "answer", reask: "1" }), CONSENT_REASK));
      return {
        xml,
        turns: [seniorTurn, { role: "SYSTEM", input_kind: "VOICE", text: CONSENT_REASK }],
      };
    }
    return consentClose(false, seniorTurn);
  }

  // 무입력.
  if (!reasked) {
    const xml = wrap(gatherSpeechDtmf(nextAction({ step: "answer", reask: "1" }), CONSENT_REASK));
    return { xml, turns: [{ role: "SYSTEM", input_kind: "VOICE", text: CONSENT_REASK }] };
  }

  // 재질문 후에도 무입력 → 미동의로 종료(self_consent 미기록). 억지 동의 금지.
  return consentClose(false);
}
