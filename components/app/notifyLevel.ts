/**
 * 알림 레벨 ↔ 기존 boolean 3종 매핑 (순수 함수).
 *
 * docs/report-spec.md §3: 레벨(ALL/EXCEPTION/WEEKLY_ONLY)이 상위 개념이고, DB 의 기존
 * boolean 3종(0008)은 유지된다. 화면은 레벨 하나만 보여 주고, 저장은 서버 액션
 * updateNotifyLevel 이 담당한다. 여기서는 **초기 표시값을 기존 boolean 에서 유도**하는
 * 용도로만 쓴다(서버가 notify_level 컬럼을 직접 내려주면 그 값이 우선).
 *
 * 매핑(스펙 §3):
 *   notify_call_result=true                        → ALL
 *   notify_call_result=false, notify_missed=true   → EXCEPTION
 *   둘 다 false                                     → WEEKLY_ONLY
 */
import type { NotifyLevel } from "@/lib/contracts/notify";
import type { NotifySettings } from "@/lib/contracts/settings";

export function toNotifyLevel(s: NotifySettings): NotifyLevel {
  if (s.notify_call_result) return "ALL";
  if (s.notify_missed) return "EXCEPTION";
  return "WEEKLY_ONLY";
}

/**
 * 역매핑 — 레벨을 기존 boolean 3종으로 환원.
 * 주간 요약은 모든 레벨에서 켠다("주간 요약만" 레벨과의 모순 제거: 상위 레벨은 주간 요약을
 * 포함한다). toNotifyLevel 과 왕복(round-trip) 일치.
 */
export function toNotifySettings(level: NotifyLevel): NotifySettings {
  return {
    notify_call_result: level === "ALL",
    notify_missed: level === "ALL" || level === "EXCEPTION",
    notify_weekly_summary: true,
  };
}
