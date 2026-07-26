/**
 * 3연속 불발(MISSED) 판정 — 순수 함수 (대시보드 경고 배너용).
 * 규칙: 피보호자의 SCHEDULE 목적 call_sessions 중 최신순 3건이 모두 MISSED 면 true.
 *  - CONSENT(동의) 콜은 제외.
 *  - SCHEDULE 세션이 3건 미만이면 항상 false.
 *  - scheduled_at(ISO) 내림차순으로 정렬해 최신 3건을 본다(입력 정렬에 의존하지 않음).
 * KST 등 시각대 변환은 불필요 — 같은 순간 비교는 오프셋과 무관하므로 ISO 문자열 정렬로 충분.
 */

/** 판정에 필요한 최소 세션 형태 (contracts/domain CallSession 의 부분집합). */
export type MissedStreakSession = {
  purpose: string;
  status: string;
  scheduled_at: string;
};

/** 최근 SCHEDULE 세션 3건이 모두 MISSED 인지. */
export function hasThreeConsecutiveMissed(sessions: MissedStreakSession[]): boolean {
  const schedule = sessions
    .filter((s) => s.purpose === "SCHEDULE")
    .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at));
  if (schedule.length < 3) return false;
  return schedule.slice(0, 3).every((s) => s.status === "MISSED");
}
