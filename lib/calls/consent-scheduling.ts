import { canDispatchConsentCall } from "./state-machine";

/**
 * CONSENT(본인 동의) 콜 예약·선별 순수 로직 (CLAUDE.md `## 데이터 모델`, 가드레일 5).
 *
 * "언제 새 동의 콜을 예약하는가 / 어떤 세션이 발신 대상(due)인가" 판정만 담당한다.
 * 부수효과(DB)·시각 생성 없음 — 시각은 호출자가 주입(now). 유닛 테스트로 고정.
 */

/** 아직 종결되지 않은(열린) 통화 상태 — 중복 CONSENT 예약 방지 기준. */
export const OPEN_CALL_STATUSES = ["SCHEDULED", "DIALING", "IN_PROGRESS"] as const;
export type OpenCallStatus = (typeof OPEN_CALL_STATUSES)[number];

/** 주어진 상태가 열린(미종결) 상태인가. */
export function isOpenStatus(status: string): boolean {
  return (OPEN_CALL_STATUSES as readonly string[]).includes(status);
}

/** senior 의 기존 CONSENT 세션 중 열린 것이 하나라도 있는가. */
export function hasOpenConsentSession(sessions: readonly { status: string }[]): boolean {
  return sessions.some((s) => isOpenStatus(s.status));
}

/**
 * senior 에 대해 새 CONSENT 세션을 예약해야 하는가.
 * 조건: 대리동의 있음 && 본인동의 없음(canDispatchConsentCall) && 열린 CONSENT 세션 없음.
 * (existingConsentSessions 는 해당 senior 의 purpose=CONSENT 세션들만 넘겨야 한다.)
 */
export function shouldScheduleConsentCall(
  senior: { consent_at: string | null; self_consent_at: string | null },
  existingConsentSessions: readonly { status: string }[],
): boolean {
  return canDispatchConsentCall(senior) && !hasOpenConsentSession(existingConsentSessions);
}

/**
 * CONSENT 세션이 디스패치(발신) 대상인가.
 * SCHEDULED 이고 예정 시각(scheduled_at)이 현재(now) 이하로 도래했을 때만 true.
 * scheduled_at 은 timestamptz(ISO instant) — 타임존 무관 절대 시각 비교.
 */
export function isConsentSessionDue(
  session: { status: string; scheduled_at: string },
  now: Date,
): boolean {
  return session.status === "SCHEDULED" && Date.parse(session.scheduled_at) <= now.getTime();
}
