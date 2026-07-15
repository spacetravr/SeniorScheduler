/**
 * TelephonyAdapter — 전화 발신 벤더 추상화 (CLAUDE.md `## 전화 발신`).
 *
 * Twilio 폐기, 국내 CPaaS vs CLOVA AiCall 미확정. 확정 전까지 이 인터페이스 +
 * MockAdapter 로만 파이프라인을 완성한다. 대화 두뇌(분류/리포트)는 벤더에 위임하지
 * 않고 lib/ai/ 자체 코드로 유지 → 어댑터는 "발신하고 턴(전사)을 수집"하는 역할만.
 *
 * 설계: 실제 벤더는 웹훅으로 상태/DTMF/전사를 비동기 전달하지만, Mock 단계에서는
 * "대화 스크립트 실행" 콜백 규약(runScript)으로 흐름을 시뮬레이션한다. 벤더 도입 시
 * 이 인터페이스 구현체가 웹훅 이벤트를 동일한 CollectedTurn 스트림으로 정규화한다.
 */

/** 통화 한 턴 (전사만 — 녹음 원본 미저장). domain.ts callTurn 과 정렬. */
export type CollectedTurn = {
  role: "SYSTEM" | "SENIOR";
  input_kind: "VOICE" | "DTMF";
  text: string;
  /** 턴 발생 instant (ISO, UTC). 흐름 엔진이 주입한 clock 기준. */
  at: string;
};

/**
 * 대화 실행 컨텍스트 — 어댑터가 흐름 엔진(lib/calls)에 제공.
 * 엔진은 say/collect 를 호출해 ARS+ 흐름을 구동하고, 응답에 따라 재질문을 결정한다.
 */
export type ScriptIO = {
  /** 안내 멘트 재생 → 기록용 SYSTEM 턴 반환. */
  say: (text: string) => Promise<CollectedTurn>;
  /** 응답 수집 → SENIOR 턴 반환(무응답이면 null). */
  collect: (prompt: string) => Promise<CollectedTurn | null>;
};

export type InitiateCallParams = {
  sessionId: string;
  seniorId: string;
  /** 국내 로컬 포맷(domain.ts phone). 벤더 어댑터가 E.164 등으로 정규화. */
  to: string;
  purpose: "SCHEDULE" | "CONSENT";
  /**
   * 대화 흐름 콜백. 어댑터가 통화를 연결하면 이 함수를 호출하고, 엔진은 io 로
   * 멘트/응답을 주고받는다. 무응답(NO_ANSWER)이면 호출되지 않는다.
   * 실벤더에서는 웹훅 왕복이 io 구현을 대신한다.
   */
  runScript: (io: ScriptIO) => Promise<void>;
};

export type CallOutcome =
  /** 상대가 받아 대화가 진행됨(분류/리포트 대상). */
  | "ANSWERED"
  /** 무응답 — 재시도 소진 시 MISSED. */
  | "NO_ANSWER";

export type CallResult = {
  sessionId: string;
  outcome: CallOutcome;
  /** 수집된 전 턴(SYSTEM+SENIOR, 시간순). */
  turns: CollectedTurn[];
  /** 통화 시작/종료 instant (ISO, UTC). NO_ANSWER 면 둘 다 null. */
  startedAt: string | null;
  endedAt: string | null;
  /** 이 어댑터가 청구한 실원가(회선+STT+LLM+TTS). 엔진이 cost_krw 로 기록. */
  costKrw: number;
};

/** 주입 가능한 시계 — 테스트 재현성(Date.now 직접 호출 금지). */
export type Clock = () => Date;

/**
 * 실벤더 비동기 발신 트리거 파라미터 (mock 의 동기 runScript 모델과 별개).
 *
 * 실벤더는 "발신만 요청 → 벤더가 통화 진행 → 결과를 콜백으로 통지" 하는 비동기 모델이다.
 * 따라서 대화 스크립트(runScript)를 주입하지 않고, 발신 대상·세션 식별자만 넘긴다.
 * 벤더는 통화 종료 후 sessionId 를 그대로 되돌려 주는 콜백을 우리 수신부로 보낸다.
 */
export type TriggerCallParams = {
  /** 우리 call_sessions.id — 벤더 콜백이 이 값을 그대로 echo 해야 세션 매칭 가능. */
  sessionId: string;
  seniorId: string;
  /** 국내 로컬 포맷(domain.ts phone). 어댑터가 벤더 규격으로 정규화. */
  to: string;
  purpose: "SCHEDULE" | "CONSENT";
};

/** 발신 트리거 결과 — 즉시 반환(통화 결과 아님, 결과는 콜백). */
export type TriggerCallResult = {
  /** 벤더가 부여한 통화 식별자(있으면). 콜백 매칭 보조·로깅용. */
  providerCallId: string | null;
};

/**
 * 텔레포니 설정 미비/미구현 오류.
 *
 * 실벤더 모드인데 필수 설정이 없거나(설정 검증은 provider.ts 가 선처리), 어댑터가 아직
 * 실제 HTTP 연동을 구현하지 않았을 때 던진다. 디스패치 라우트는 이 오류를 잡아
 * **조용한 mock 폴백 없이** 해당 세션을 skip 한다(실환경에서 가짜 통화 기록 금지).
 */
export class TelephonyNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TelephonyNotConfiguredError";
  }
}

export interface TelephonyAdapter {
  /**
   * 발신 1회 시도(동기 대화-드라이버 모델 — MockAdapter 전용).
   * 응답 시 ANSWERED + 턴, 무응답 시 NO_ANSWER.
   * 재시도(1분/10분) 스케줄은 흐름 엔진 책임 — 어댑터는 단일 시도만 담당.
   * 실벤더 어댑터는 이 동기 모델을 지원하지 않으므로 TelephonyNotConfiguredError 를 던진다.
   */
  initiateCall(params: InitiateCallParams, clock: Clock): Promise<CallResult>;

  /**
   * 비동기 발신 트리거(실벤더 모델). 발신만 요청하고 즉시 반환 — 통화 결과는 콜백으로.
   * MockAdapter 는 동기 모델을 쓰므로 구현하지 않는다(선택적).
   */
  triggerCall?(params: TriggerCallParams): Promise<TriggerCallResult>;
}
