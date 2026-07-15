import type { Senior } from "@/lib/contracts/domain";

/**
 * 통화 세션 상태 기계 — 순수 함수 (CLAUDE.md `## 전화 발신` ARS+ 설계).
 *
 * SCHEDULED → DIALING → IN_PROGRESS → COMPLETED
 * 무응답 시 재시도(1분·10분 각 1회) 후 소진되면 MISSED. attempt 로 시도 횟수 추적.
 * 시각·부수효과 없음 — 테스트로 전이를 고정한다.
 */

export type CallStatus = "SCHEDULED" | "DIALING" | "IN_PROGRESS" | "COMPLETED" | "MISSED";

export type CallState = { status: CallStatus; attempt: number };

export type CallEvent =
  | { type: "DIAL_START" } // 발신 시작
  | { type: "ANSWERED" } // 상대 응답 → 대화
  | { type: "COMPLETE" } // 대화 정상 종료
  | { type: "NO_ANSWER" }; // 무응답 → 재시도 판단

/** 최대 시도 횟수(원본 + 1분/10분 재시도 각 1회). */
export const MAX_ATTEMPTS = 3;

/**
 * attempt N(무응답)에서 attempt N+1 로 넘어갈 때의 대기(ms).
 * attempt 1→2: 1분, attempt 2→3: 10분. (CLAUDE.md: 재시도 1분/10분 각 1회)
 */
export const RETRY_DELAYS_MS = [60_000, 600_000] as const;

/** 무응답 후 재시도 여지가 남았는가? */
export function canRetry(attempt: number): boolean {
  return attempt < MAX_ATTEMPTS;
}

/** attempt(현재) 무응답 → 다음 시도까지 대기(ms). 재시도 불가면 null. */
export function retryDelayMs(attempt: number): number | null {
  if (!canRetry(attempt)) return null;
  return RETRY_DELAYS_MS[attempt - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
}

/** 순수 전이 함수. 잘못된 전이는 현재 상태를 그대로 반환(방어적). */
export function transition(state: CallState, event: CallEvent): CallState {
  switch (event.type) {
    case "DIAL_START":
      if (state.status === "SCHEDULED") return { ...state, status: "DIALING" };
      return state;

    case "ANSWERED":
      if (state.status === "DIALING") return { ...state, status: "IN_PROGRESS" };
      return state;

    case "COMPLETE":
      if (state.status === "IN_PROGRESS") return { ...state, status: "COMPLETED" };
      return state;

    case "NO_ANSWER":
      if (state.status !== "DIALING") return state;
      // 재시도 여지 있으면 SCHEDULED 로 되돌리고 attempt 증가, 없으면 MISSED.
      if (canRetry(state.attempt)) {
        return { status: "SCHEDULED", attempt: state.attempt + 1 };
      }
      return { ...state, status: "MISSED" };

    default:
      return state;
  }
}

export type TerminalStatus = "COMPLETED" | "MISSED";
export function isTerminal(status: CallStatus): status is TerminalStatus {
  return status === "COMPLETED" || status === "MISSED";
}

/**
 * 실발신 가드 (가드레일 5). SCHEDULE 콜은 대리동의(consent_at)와 본인동의
 * (self_consent_at)가 **둘 다** 있어야 발신 가능. CONSENT 콜은 본인동의를 받으러
 * 가는 콜이므로 이 가드를 적용하지 않는다(대리동의만 있으면 발신, 아래 별도 함수).
 */
export function canDispatchScheduleCall(senior: Pick<Senior, "consent_at" | "self_consent_at">): boolean {
  return senior.consent_at != null && senior.self_consent_at != null;
}

/** CONSENT 콜 발신 가드: 대리동의(consent_at)는 있고 본인동의는 아직 없을 때만. */
export function canDispatchConsentCall(
  senior: Pick<Senior, "consent_at" | "self_consent_at">,
): boolean {
  return senior.consent_at != null && senior.self_consent_at == null;
}
