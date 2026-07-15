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
 * ── 대화 두뇌 위임 금지(가드레일 4) ──
 * 분기 판정(동의/이행 분류)은 여기서 하지 않는다. VoiceML 은 "멘트 재생 + DTMF 수집"
 * 최소 역할만. 실제 분류는 lib/ai/classifier(DTMF 우선)가 콜백 완료 시 담당한다.
 *
 * ── ARS+ 원칙(CLAUDE.md) ──
 * 무입력/불명확 시 1회 재질문 후 UNCERTAIN 흐름. 억지 판정 금지. 시니어 친화 존댓말·단문.
 *
 * ── 녹음 정책 ──
 * 우리는 전사(transcript)만 저장하고 녹음 파일은 다운로드·저장하지 않는다. 자유 발화(기분
 * 답변)는 <Pause> 동안 통화가 이어지며, 전사는 콜백 완료 시 ClawOps transcript API 로만
 * 수집한다(원본 오디오 미보관). ClawOps 측 자동 녹음 비활성화 옵션은 미확인 — docs 확인 항목.
 */

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
 * <Gather> DTMF 1자리 수집 → action(다음 스텝 URL)으로 되돌아옴.
 * 안내 멘트는 Gather 내부에 두어 입력 대기 중에도 재생되게 한다(TwiML 관례).
 */
function gatherDtmf(actionUrl: string, prompt: string, timeoutSec = 8): string {
  return (
    `<Gather input="dtmf" numDigits="1" timeout="${timeoutSec}" ` +
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
    "하셨으면 1번, 안 하셨으면 2번, 나중에 하실 거면 3번을 눌러 주세요."
  );
}
const SCHEDULE_REASK = "죄송해요, 잘 못 들었어요. 하셨으면 1번, 안 하셨으면 2번, 나중이면 3번을 눌러 주세요.";
const SCHEDULE_MOOD = "네, 알겠습니다. 오늘 기분은 좀 어떠세요? 편하게 말씀해 주세요.";
const SCHEDULE_CLOSING = "말씀 감사해요. 오늘도 건강하세요.";

const CONSENT_INTRO =
  "안녕하세요. 자녀분이 신청하신 안부 확인 서비스예요. " +
  "앞으로 정해진 시간에 안내 전화를 드리고, " +
  RECORDING_NOTICE +
  " 동의하시면 1번, 원치 않으시면 2번을 눌러 주세요.";
const CONSENT_REASK = "죄송해요, 잘 못 들었어요. 동의하시면 1번, 원치 않으시면 2번을 눌러 주세요.";
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

/**
 * VoiceML 생성 — step/purpose 에 따라 XML + 기록 턴 반환.
 *
 * 흐름(SCHEDULE):
 *   intro  → Say(인사+고지+안내) + Gather(→answer)
 *   answer → [유효 DTMF] 턴 기록 + 기분질문(Say+Pause) + 종료(Hangup)
 *          → [무입력·불명확 & 첫 응답] 재질문 Gather(→answer&reask=1)
 *          → [무입력·불명확 & 재질문 후] 기분질문 + 종료(UNCERTAIN — 판정은 콜백이)
 *
 * 흐름(CONSENT):
 *   intro  → Say(안내+고지) + Gather(→answer)
 *   answer → [1] 턴 기록 + 동의 종료 / [2] 턴 기록 + 거부 종료
 *          → [무입력 & 첫 응답] 재질문 / [무입력 & 재질문 후] 거부 종료
 *   (실제 self_consent 성사 판정은 콜백 완료 시 저장된 DTMF 로 evaluateConsentGranted 가 수행)
 */
export function buildVoiceML(params: VoiceMLParams): VoiceMLResult {
  return params.purpose === "CONSENT" ? buildConsent(params) : buildSchedule(params);
}

function buildSchedule(params: VoiceMLParams): VoiceMLResult {
  const { step, digits, reasked, nextAction } = params;
  const scriptTemplate = params.scriptTemplate ?? "일정";

  if (step === "intro") {
    const xml = wrap(
      say(scheduleIntro(scriptTemplate)) +
        gatherDtmf(nextAction({ step: "answer" }), "어떠세요?"),
    );
    // 안내 멘트를 SYSTEM 턴으로 기록(전사 대신 우리가 낸 멘트는 확정 텍스트).
    return { xml, turns: [{ role: "SYSTEM", input_kind: "VOICE", text: scheduleIntro(scriptTemplate) }] };
  }

  // step === "answer"
  if (isValidScheduleDigit(digits)) {
    // DTMF 확정 → 기분 1턴(전사) 후 종료.
    const xml = wrap(say(SCHEDULE_MOOD) + pause(5) + say(SCHEDULE_CLOSING) + `<Hangup/>`);
    return {
      xml,
      turns: [
        { role: "SENIOR", input_kind: "DTMF", text: digits as string },
        { role: "SYSTEM", input_kind: "VOICE", text: SCHEDULE_MOOD },
      ],
    };
  }

  // 무입력/불명확.
  if (!reasked) {
    // 1회 재질문(ARS+).
    const xml = wrap(gatherDtmf(nextAction({ step: "answer", reask: "1" }), SCHEDULE_REASK));
    return { xml, turns: [{ role: "SYSTEM", input_kind: "VOICE", text: SCHEDULE_REASK }] };
  }

  // 재질문 후에도 무입력/불명확 → 억지 판정 금지(UNCERTAIN). 기분 1턴 후 종료.
  const xml = wrap(say(SCHEDULE_MOOD) + pause(5) + say(SCHEDULE_CLOSING) + `<Hangup/>`);
  return { xml, turns: [{ role: "SYSTEM", input_kind: "VOICE", text: SCHEDULE_MOOD }] };
}

function buildConsent(params: VoiceMLParams): VoiceMLResult {
  const { step, digits, reasked, nextAction } = params;

  if (step === "intro") {
    const xml = wrap(
      say(CONSENT_INTRO) + gatherDtmf(nextAction({ step: "answer" }), "동의하시나요?"),
    );
    return { xml, turns: [{ role: "SYSTEM", input_kind: "VOICE", text: CONSENT_INTRO }] };
  }

  // step === "answer"
  if (isValidConsentDigit(digits)) {
    const granted = digits === "1";
    const closing = granted ? CONSENT_GRANTED_CLOSING : CONSENT_DENIED_CLOSING;
    const xml = wrap(say(closing) + `<Hangup/>`);
    return {
      xml,
      turns: [
        { role: "SENIOR", input_kind: "DTMF", text: digits as string },
        { role: "SYSTEM", input_kind: "VOICE", text: closing },
      ],
    };
  }

  if (!reasked) {
    const xml = wrap(gatherDtmf(nextAction({ step: "answer", reask: "1" }), CONSENT_REASK));
    return { xml, turns: [{ role: "SYSTEM", input_kind: "VOICE", text: CONSENT_REASK }] };
  }

  // 재질문 후에도 무입력 → 미동의로 종료(self_consent 미기록). 억지 동의 금지.
  const xml = wrap(say(CONSENT_DENIED_CLOSING) + `<Hangup/>`);
  return { xml, turns: [{ role: "SYSTEM", input_kind: "VOICE", text: CONSENT_DENIED_CLOSING }] };
}
