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
 * ── 단일 문서 흐름(2026-07-16 실콜 확정) ──
 * ClawOps 실콜에서 **Gather 의 speech 입력이 action 콜백을 트리거하지 않음**을 실측했다
 * (사용자 7회 발화에도 voiceml 라우트는 intro 1회만 호출 — step 진행 전무). 따라서 실시간
 * 음성 기반 step 전환(intro→answer→mood→…)은 이 벤더에서 불가하다. 대응으로 SCHEDULE 흐름을
 * **하나의 자기완결형 VoiceML 문서**로 재구성한다:
 *   Say(인사+고지+일정 확인 질문) → Gather(input="dtmf speech", 짧은 timeout, action=answer)
 *   → 같은 문서에서 이어지는  기분 Say + Pause → 일상1 Say + Pause → 일상2 Say + Pause
 *   → 마무리 Say + Hangup.
 * Twilio 의미론상 Gather 는 입력이 없으면 다음 verb 로 진행하므로 action 이 안 와도 전체 따뜻한
 * 흐름이 재생된다. DTMF 가 오면 answer step 이 남은 흐름(응답 인지 멘트+기분부터)을 이어서
 * 재생한다(이미 재생된 intro/Gather 부분과 중복되지 않는다 — answer 는 기분부터 시작).
 * 시니어 발화는 전부 통화 후 전사로 수집한다(라우트/콜백/디스패치 백필).
 *
 * ── 대화 두뇌 위임 금지(가드레일 4) ──
 * SCHEDULE 이행 판정은 여기서 하지 않는다(멘트 재생 + 응답 수집만). 실제 이행 분류는
 * lib/ai/classifier 가 콜백 완료 시 담당한다. CONSENT 만은 종료 멘트를 실시간으로 갈라야
 * 하므로(동의/거부 멘트), 판정 룰은 lib/ai 의 classifyConsent 를 그대로 호출한다(로직을
 * VoiceML 에 복제하지 않는다). 최종 self_consent 성사 판정도 콜백 시 동일 함수로 재확인된다.
 *
 * ── ARS+ 원칙(CLAUDE.md) ──
 * 억지 판정 금지. 시니어 친화 존댓말·단문. DTMF 무입력 시 재질문은 단일 문서에서 무의미하므로
 * (action 이 안 오면 재질문도 못 함) SCHEDULE 에서는 재질문을 생략한다 — 무입력이면 그대로
 * 따뜻한 흐름이 이어지고 최종 분류는 콜백 전사가 담당(UNCERTAIN 폴백).
 *
 * ── 녹음 정책 ──
 * 우리는 전사(transcript)만 저장하고 녹음 파일은 다운로드·저장하지 않는다. 통화 중 확보한
 * DTMF 는 즉시 SENIOR/DTMF 턴으로 저장하고, 콜백/백필이 보강하는 ClawOps 전사는 중복 삽입을
 * 피한다(dedupeTranscriptTurns). 원본 오디오 미보관.
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

/**
 * <Pause length> — 자유 발화(기분·일상) 고정 듣기.
 *
 * 정해진 초만큼 통화를 열어두고 다음 verb 로 진행한다. 적응형 종료 감지(speech Gather)는
 * ClawOps 가 미지원하므로(파일 상단 주석) 고정 대기로 회귀했다. 시니어 발화는 통화 후 전사로
 * 수집한다. length 는 정수 초.
 */
function pause(sec: number): string {
  return `<Pause length="${Math.max(1, Math.floor(sec))}"/>`;
}

/**
 * <Gather> DTMF 우선 + speech(있으면) 수집 → action(answer step URL)으로 되돌아옴.
 *
 * `input="dtmf speech"`: 버튼(DTMF 1자리)을 우선 수용하되 음성도 인식 대상으로 남긴다(벤더가
 * speech 를 지원하면 가속 경로). `language="ko-KR"`, `speechTimeout="auto"`, 짧은 `timeout`.
 * 안내 멘트는 Gather 내부에 두어 입력 대기 중에도 재생되게 한다(TwiML 관례).
 *
 * **실콜 확정**: ClawOps 는 speech 입력으로 action 을 트리거하지 않으므로 실질적으로 DTMF 만
 * action 을 부른다. DTMF 가 없으면 Gather 는 timeout 후 **같은 문서의 다음 verb(기분 질문)로
 * 진행**한다(단일 문서 흐름). 즉 action 이 안 와도 따뜻한 흐름 전체가 재생된다.
 */
function gatherDtmf(actionUrl: string, prompt: string, timeoutSec = 6): string {
  return (
    `<Gather input="dtmf speech" numDigits="1" timeout="${timeoutSec}" ` +
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
// 일정 확인 이후 재생하는 기분/일상 대화 멘트는 lib/calls/warm-talk 에서 단일 소스로 관리한다
// (MOOD_LEAD/MOOD_QUESTION/CHAT_TURNS/WARM_CLOSING/*_PAUSE_SEC). 여기서는 재생 XML·기록 턴만 구성.

const CONSENT_INTRO =
  "안녕하세요. 자녀분이 신청하신 안부 확인 서비스예요. " +
  "앞으로 정해진 시간에 안내 전화를 드리고, " +
  RECORDING_NOTICE +
  " 동의하시면 '동의합니다', 원치 않으시면 '괜찮습니다'라고 말씀해 주세요.";
const CONSENT_REASK = "죄송해요, 잘 못 들었어요. 동의하시면 '동의합니다', 원치 않으시면 '괜찮습니다'라고 말씀해 주세요.";
const CONSENT_GRANTED_CLOSING = "감사합니다. 앞으로 잘 챙겨드릴게요.";
const CONSENT_DENIED_CLOSING = "네, 알겠습니다. 이용을 원하시면 언제든 자녀분께 말씀해 주세요.";

/**
 * 스텝 종류(쿼리 step 값).
 *
 * SCHEDULE 흐름(단일 문서):
 *   - intro:  인사+고지+일정 확인 질문 Gather(input="dtmf speech", action=answer) →
 *             **같은 문서에서** 기분 Say + Pause → 일상1 Say + Pause → 일상2 Say + Pause →
 *             마무리 Say + Hangup. action 이 안 와도(speech 미트리거·무입력) 전체 재생.
 *   - answer: DTMF 가 와서 action 이 호출된 경우에만 진입. DTMF 턴 저장 + 응답 인지 멘트 +
 *             기분부터 이어지는 따뜻한 흐름(Pause 포함) + 마무리 + Hangup.
 * CONSENT 흐름: intro → answer(동의/거부/재질문) — 따뜻한 대화 확장 없음.
 *
 * (과거 mood/chat1/chat2 스텝은 적응형 speech Gather 전환 시 도입했으나, ClawOps 가 speech
 *  action 을 미트리거해 무의미 → 단일 문서로 통합하며 제거.)
 */
export type VoiceMLStep = "intro" | "answer";

export type VoiceMLParams = {
  purpose: "SCHEDULE" | "CONSENT";
  step: VoiceMLStep;
  /** SCHEDULE 콜 안내에 넣을 일정 문구(schedule.script_template). CONSENT 는 무시. */
  scriptTemplate?: string;
  /** step=answer 에서 수집된 DTMF(빈 문자열/미입력이면 무입력 처리). */
  digits?: string;
  /**
   * 직전 Gather 의 음성 인식 결과(SpeechResult). ClawOps 는 speech 로 action 을 트리거하지
   * 않으므로 SCHEDULE 에서는 실질 미사용(방어적 처리만). CONSENT step=answer 에서는 벤더가
   * speech action 을 지원할 경우에 한해 실시간 동의/거부 분기에 쓰인다.
   */
  speechResult?: string;
  /** step=answer 가 재질문 후의 응답인가(CONSENT 재질문 소진 판단용). SCHEDULE 은 미사용. */
  reasked?: boolean;
  /**
   * 다음 스텝 action URL 빌더(라우트가 session/token 을 담아 주입). 예:
   *   nextAction({ step: "answer" }) → ".../voiceml?session=..&token=..&step=answer"
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
 * 흐름(SCHEDULE — 단일 자기완결 문서):
 *   intro  → Say(인사+고지+일정 확인 질문) + Gather(dtmf speech, action=answer)
 *            + 기분 Say + Pause + 일상1 Say + Pause + 일상2 Say + Pause + 마무리 Say + Hangup
 *          (Gather 에 DTMF 가 오면 action=answer 로 분기, 없으면 같은 문서의 다음 verb 로 진행)
 *   answer → SENIOR/DTMF 턴 저장 + 응답 인지 멘트 + 기분부터 이어지는 따뜻한 흐름 + 마무리 + Hangup
 *
 * 경계 마커: intro/answer 모두 기분·일상 질문 SYSTEM 턴(MOOD_QUESTION·CHAT_TURNS 포함)을 남긴다.
 * 콜백/백필이 전사 SENIOR 발화를 이 경계 뒤(free-form)와 앞(adherence)으로 위치시켜 분류한다
 * (positionTranscriptTurns + splitAtFreeForm). 이행 판정은 VoiceML 이 아니라 콜백 두뇌가 수행.
 *
 * 흐름(CONSENT — 음성 우선):
 *   intro  → Say(안내+고지+음성 유도) + Gather(dtmf speech →answer)
 *   answer → [유효 DTMF 1/2] SENIOR/DTMF 턴 + 동의/거부 종료
 *          → [음성 GRANTED/DENIED] SENIOR/VOICE 턴 + 동의/거부 종료
 *          → [음성 UNCERTAIN·무입력] 첫 응답 재질문 / 재질문 후 미동의 종료
 *   (실시간 종료 멘트 분기는 speech action 을 지원하는 벤더에서만 의미. 미지원 시 Gather 무입력
 *    으로 문서 종단 → 최종 self_consent 성사 판정은 콜백 완료 시 전사로 evaluateConsentGranted 가 재확인.)
 */
export function buildVoiceML(params: VoiceMLParams): VoiceMLResult {
  return params.purpose === "CONSENT" ? buildConsent(params) : buildSchedule(params);
}

/**
 * 따뜻한 종결부(기분 → 일상1 → 일상2 → 마무리)를 단일 문서에 이어 붙인다.
 *
 * 각 질문 Say 뒤에 고정 <Pause>(듣기 상한)를 두고, 마지막에 WARM_CLOSING + Hangup 으로 종료한다.
 * 반환 turns 는 기분·일상 질문 SYSTEM 마커(경계). closing 은 SYSTEM 턴으로 남기지 않는다(관례).
 *
 * @param withAck true 면 기분 질문 앞에 응답 인지 멘트(MOOD_LEAD)를 붙인다(answer step — DTMF 응답
 *   직후). intro 문서에서는 응답을 아직 못 받았으므로 false(기분 질문만).
 */
function warmTail(withAck: boolean): VoiceMLResult {
  const moodSay = withAck ? `${MOOD_LEAD} ${MOOD_QUESTION}` : MOOD_QUESTION;
  const chat1 = `${CHAT_TURNS[0].ack} ${CHAT_TURNS[0].question}`;
  const chat2 = `${CHAT_TURNS[1].ack} ${CHAT_TURNS[1].question}`;
  const xml =
    say(moodSay) +
    pause(MOOD_PAUSE_SEC) +
    say(chat1) +
    pause(CHAT_PAUSE_SEC) +
    say(chat2) +
    pause(CHAT_PAUSE_SEC) +
    say(WARM_CLOSING) +
    `<Hangup/>`;
  const turns: VoiceMLTurn[] = [
    { role: "SYSTEM", input_kind: "VOICE", text: moodSay },
    { role: "SYSTEM", input_kind: "VOICE", text: chat1 },
    { role: "SYSTEM", input_kind: "VOICE", text: chat2 },
  ];
  return { xml, turns };
}

function buildSchedule(params: VoiceMLParams): VoiceMLResult {
  const { step, digits, speechResult, nextAction } = params;
  const scriptTemplate = params.scriptTemplate ?? "일정";

  if (step === "intro") {
    // 단일 문서: 인사·고지·질문 Gather + (같은 문서에서) 따뜻한 종결부.
    // DTMF 가 오면 action=answer 로 분기하고, 없으면 Gather 다음 verb(warmTail)가 그대로 재생된다.
    const tail = warmTail(false);
    const xml = wrap(
      say(scheduleIntro(scriptTemplate)) +
        gatherDtmf(nextAction({ step: "answer" }), "하셨으면 1번, 아직이면 2번을 눌러주셔도 돼요.") +
        tail.xml,
    );
    // 안내 멘트 + 종결부 질문 마커를 SYSTEM 턴으로 기록(경계 마커 포함).
    return {
      xml,
      turns: [{ role: "SYSTEM", input_kind: "VOICE", text: scheduleIntro(scriptTemplate) }, ...tail.turns],
    };
  }

  // step === "answer" — DTMF 로 action 이 호출된 경우에만 진입(ClawOps 는 speech 로 action 을
  // 트리거하지 않음). 응답 인지 멘트(withAck) 뒤 기분부터 따뜻한 흐름을 이어 재생한다.
  const tail = warmTail(true);
  let seniorTurns: VoiceMLTurn[] = [];
  if (isValidScheduleDigit(digits)) {
    seniorTurns = [{ role: "SENIOR", input_kind: "DTMF", text: digits as string }];
  } else if (hasSpeech(speechResult)) {
    // 벤더가 speech action 을 지원하는 예외적 경우 — 발화도 SENIOR/VOICE 턴으로 저장.
    seniorTurns = [{ role: "SENIOR", input_kind: "VOICE", text: (speechResult as string).trim() }];
  }
  // 불명확/무입력(예: DTMF 9)이면 SENIOR 턴 없이 따뜻한 흐름만 재생(UNCERTAIN — 콜백 전사가 판정).
  return { xml: wrap(tail.xml), turns: [...seniorTurns, ...tail.turns] };
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
      say(CONSENT_INTRO) + gatherDtmf(nextAction({ step: "answer" }), "동의하시나요?"),
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
      const xml = wrap(gatherDtmf(nextAction({ step: "answer", reask: "1" }), CONSENT_REASK));
      return {
        xml,
        turns: [seniorTurn, { role: "SYSTEM", input_kind: "VOICE", text: CONSENT_REASK }],
      };
    }
    return consentClose(false, seniorTurn);
  }

  // 무입력.
  if (!reasked) {
    const xml = wrap(gatherDtmf(nextAction({ step: "answer", reask: "1" }), CONSENT_REASK));
    return { xml, turns: [{ role: "SYSTEM", input_kind: "VOICE", text: CONSENT_REASK }] };
  }

  // 재질문 후에도 무입력 → 미동의로 종료(self_consent 미기록). 억지 동의 금지.
  return consentClose(false);
}
