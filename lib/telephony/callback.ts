import { z } from "zod";

/**
 * 벤더 중립 콜백 계약 (CLAUDE.md `## 전화 발신`, 가드레일 4: 외부 서비스 인터페이스 추상화).
 *
 * 실벤더는 비동기다: 우리가 발신을 트리거하면 벤더가 통화를 진행하고, 종료 후 결과를
 * 콜백(웹훅)으로 우리 수신부(app/api/telephony/callback)로 보낸다. 벤더별 원시 페이로드
 * 형태는 제각각이므로, 이 파일이 **하나의 중립 계약**을 정의하고 벤더별 파서가 원시
 * 페이로드를 이 계약으로 정규화한다. 수신부/처리 로직은 오직 중립 계약만 의존한다.
 *
 * 지금은 `generic`(중립 계약 그대로 수신) 파서만 구현한다. CLOVA 등 실벤더 파서는
 * 스펙 확정 시 이 파일의 clovaCallbackParser TODO 자리에 채운다.
 *
 * 시간대(CLAUDE.md): 턴/통화 시각은 ISO 8601 instant(오프셋 포함). 처리 계층이
 * Asia/Seoul 명시로 다룬다. 암묵적 로컬/UTC 의존 금지.
 */

/** 콜백 이벤트 타입 — 벤더 중립. */
export const TELEPHONY_CALLBACK_EVENTS = [
  "ANSWERED", // 상대가 받아 통화 시작(중간 통지, 선택적)
  "NO_ANSWER", // 무응답 — 재시도 정책 대상
  "COMPLETED", // 통화 정상 종료 — 전사/원가 확정, 분류·리포트 대상
  "FAILED", // 통화 실패(회선/시스템) — NO_ANSWER 와 동일하게 재시도 정책 적용
] as const;
export type TelephonyCallbackEvent = (typeof TELEPHONY_CALLBACK_EVENTS)[number];

/** 콜백 전사 턴(중립) — domain.ts callTurn 과 정렬. 녹음 원본 미저장, 전사만. */
export const callbackTurnSchema = z.object({
  role: z.enum(["SYSTEM", "SENIOR"]),
  input_kind: z.enum(["VOICE", "DTMF"]),
  text: z.string(),
  /** 턴 발생 instant (ISO 8601, 오프셋 포함). */
  at: z.string().datetime({ offset: true }),
});
export type CallbackTurn = z.infer<typeof callbackTurnSchema>;

/**
 * 벤더 중립 콜백 이벤트 스키마 (zod). 수신부는 이 스키마로 4xx 검증한다.
 *   - session_id: 우리 call_sessions.id (벤더가 echo). 세션 매칭 키.
 *   - event: 상태 이벤트.
 *   - turns: COMPLETED 시 전사 배열(그 외 이벤트는 보통 빈 배열).
 *   - duration_sec/cost_krw: 원가 기록용(선택). cost_krw 는 벤더가 산정한 회선+STT+TTS
 *     원가(우리 LLM 비용은 처리 계층이 합산). 미제공 시 0 으로 기록.
 *   - provider_call_id/event_id: 로깅·멱등 보조(선택).
 */
export const telephonyCallbackEventSchema = z.object({
  session_id: z.string().uuid(),
  event: z.enum(TELEPHONY_CALLBACK_EVENTS),
  turns: z.array(callbackTurnSchema).default([]),
  /** 통화 시간(초). 있으면 로깅·검증용. */
  duration_sec: z.number().nonnegative().optional(),
  /** 벤더 산정 회선+STT+TTS 원가(KRW). 없으면 0. LLM 비용은 처리 계층이 더한다. */
  cost_krw: z.number().nonnegative().optional(),
  /** 벤더 통화 식별자(선택, 로깅용). */
  provider_call_id: z.string().optional(),
  /** 콜백 이벤트 식별자(선택). 멱등 처리 보조 — 없으면 세션 상태로 멱등 보장. */
  event_id: z.string().optional(),
});
export type TelephonyCallbackPayload = z.infer<typeof telephonyCallbackEventSchema>;

/**
 * 벤더별 파서 인터페이스: 원시 페이로드(unknown) → 중립 계약.
 * 검증 실패 시 zod 에러를 던진다(수신부가 4xx 로 변환).
 */
export type CallbackParser = (raw: unknown) => TelephonyCallbackPayload;

/** generic 파서 — 이미 중립 계약 형태로 들어온 페이로드를 zod 로 검증만 한다. */
export const genericCallbackParser: CallbackParser = (raw) =>
  telephonyCallbackEventSchema.parse(raw);

/**
 * CLOVA AiCall 파서 (TODO — 스펙 미확정).
 *
 * 확정 시 채울 내용:
 *   - CLOVA 콜백 원시 필드 → 중립 필드 매핑(세션키·상태코드·발화 리스트·통화시간·과금).
 *   - 전사 획득 경로 확인: 콜백에 전사가 포함되는지, 아니면 Object Storage 등에서 별도
 *     조회해야 하는지(docs/telephony-clova.md 질문 목록 참조).
 *   - 상태코드 → ANSWERED/NO_ANSWER/COMPLETED/FAILED 매핑 표.
 * 그 전까지 호출되면 명시적으로 실패시킨다(조용한 오작동 금지).
 */
export const clovaCallbackParser: CallbackParser = () => {
  throw new Error(
    "clovaCallbackParser 미구현: CLOVA 콜백 스펙 확정 후 원시→중립 매핑을 채우세요(docs/telephony-clova.md).",
  );
};

// ── ClawOps 파서 ─────────────────────────────────────────────────────────────
/**
 * 중간 상태(initiated/ringing 등) 콜백 — 상태 전이 대상이 아니므로 무시(200 noop).
 * parser 가 이 에러를 던지면 라우트는 아무 처리 없이 200 을 반환한다(벤더 재전송 방지).
 */
export class ClawopsIgnorableStatusError extends Error {
  constructor(public readonly callStatus: string) {
    super(`ignorable clawops status: ${callStatus}`);
    this.name = "ClawopsIgnorableStatusError";
  }
}

/**
 * ClawOps CallStatus/AnsweredBy → 중립 이벤트 매핑.
 *   - 기계 응답(AnsweredBy machine/fax) = 음성사서함 → 부재(NO_ANSWER)로 취급(MachineDetection Hangup).
 *   - 중간 상태(initiated/ringing/queued/in-progress)는 null(무시).
 * @returns 중립 이벤트 또는 null(무시 대상).
 */
export function mapClawopsCallStatus(
  callStatus: string,
  answeredBy?: string,
): TelephonyCallbackEvent | null {
  const s = (callStatus ?? "").trim().toLowerCase();
  const by = (answeredBy ?? "").trim().toLowerCase();
  const isMachine = by.includes("machine") || by.includes("fax");

  switch (s) {
    case "":
    case "initiated":
    case "queued":
    case "ringing":
    case "in-progress":
    case "in_progress":
      return null; // 중간 상태 — 전이 없음.
    case "answered":
      return isMachine ? "NO_ANSWER" : "ANSWERED";
    case "completed":
      return isMachine ? "NO_ANSWER" : "COMPLETED";
    case "busy":
    case "no-answer":
    case "no_answer":
    case "noanswer":
      return "NO_ANSWER";
    case "failed":
    case "canceled":
    case "cancelled":
      return "FAILED";
    default:
      // 미지의 종결 상태는 실패로 간주(재시도 정책에 태움 — 조용한 유실 방지).
      return "FAILED";
  }
}

/**
 * ClawOps 콜백 파서. raw 는 벤더 웹훅 바디에 session_id(라우트가 쿼리/역조회로 주입)를 합친 것.
 * 원시 필드 { CallId, CallStatus, AnsweredBy, CallDuration } → 중립 계약으로 매핑한다.
 *
 * - turns 는 빈 배열: 전사는 웹훅에 실려오지 않고 transcript API 로 별도 확보하므로,
 *   COMPLETED 시 라우트가 DTMF(이미 저장됨)+전사를 조합한다.
 * - cost_krw 는 여기서 산정하지 않는다(단가 env 는 라우트/어댑터가 보유 — 라우트가 주입).
 * - 중간 상태는 ClawopsIgnorableStatusError 를 던진다(라우트 200 noop).
 */
export const clawopsCallbackParser: CallbackParser = (raw) => {
  const r = (raw ?? {}) as Record<string, unknown>;
  const event = mapClawopsCallStatus(String(r.CallStatus ?? ""), String(r.AnsweredBy ?? ""));
  if (event == null) throw new ClawopsIgnorableStatusError(String(r.CallStatus ?? ""));

  const durationRaw = Number(r.CallDuration);
  const payload = {
    session_id: r.session_id,
    event,
    turns: [],
    ...(Number.isFinite(durationRaw) && durationRaw >= 0 ? { duration_sec: durationRaw } : {}),
    ...(typeof r.CallId === "string" ? { provider_call_id: r.CallId } : {}),
  };
  return telephonyCallbackEventSchema.parse(payload);
};

/** provider 이름 → 파서 선택. 기본 generic. */
export function getCallbackParser(provider: string): CallbackParser {
  switch (provider) {
    case "clova":
      return clovaCallbackParser;
    case "clawops":
      return clawopsCallbackParser;
    case "mock":
    case "generic":
    default:
      return genericCallbackParser;
  }
}
