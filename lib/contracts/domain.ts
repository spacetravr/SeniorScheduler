import { z } from "zod";

/**
 * 도메인 계약 — contract-first 단일 소스 (오케스트레이터 승인 없이 변경 금지).
 * Phase 1: ui가 이 타입으로 lib/mock/** 데이터를 만들어 렌더.
 * Phase 2+: data가 이 스키마 기준으로 DB/API를 구현하고 mock을 교체.
 * CLAUDE.md `## 데이터 모델` 섹션과 동기화 유지.
 */

// ── 피보호자 (부모님) ──
export const seniorSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(50),
  phone: z.string().regex(/^0\d{1,2}-?\d{3,4}-?\d{4}$/, "유효한 전화번호가 아닙니다"),
  relationship: z.enum(["모", "부", "조모", "조부", "기타"]),
  birth_year: z.number().int().min(1920).max(2000).nullable(),
  /** 통화 녹취·전사 저장 보호자 대리동의 시각 — null이면 실발신 금지 (가드레일 5) */
  consent_at: z.string().datetime({ offset: true }).nullable(),
  consent_by: z.string().uuid().nullable(),
  created_at: z.string().datetime({ offset: true }),
});
export type Senior = z.infer<typeof seniorSchema>;

// ── 일정 ──
export const SCHEDULE_TYPES = ["MEDICATION", "HOSPITAL", "MEAL", "ETC"] as const;
export const scheduleTypeLabel: Record<(typeof SCHEDULE_TYPES)[number], string> = {
  MEDICATION: "복약",
  HOSPITAL: "병원",
  MEAL: "식사",
  ETC: "기타",
};

export const scheduleSchema = z.object({
  id: z.string().uuid(),
  senior_id: z.string().uuid(),
  type: z.enum(SCHEDULE_TYPES),
  title: z.string().min(1).max(100),
  /** 통화 안내 문구 템플릿 (예: "혈압약 드실 시간이에요") */
  script_template: z.string().min(1).max(300),
  /** 발신 시각 "HH:mm" (KST) */
  call_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  /** RFC 5545 RRULE (예: "FREQ=DAILY" / "FREQ=WEEKLY;BYDAY=MO,WE,FR") */
  rrule: z.string().min(1),
  /** 발신 ON/OFF */
  active: z.boolean(),
  created_at: z.string().datetime({ offset: true }),
});
export type Schedule = z.infer<typeof scheduleSchema>;

// ── 통화 세션 (상태 기계) ──
export const CALL_SESSION_STATUSES = [
  "SCHEDULED", // 예정
  "DIALING", // 발신 중
  "IN_PROGRESS", // 통화 중
  "COMPLETED", // 통화 완료 (리포트 생성 대상)
  "MISSED", // 재시도(1분/10분) 소진 후 불발
] as const;
export const callSessionStatusLabel: Record<(typeof CALL_SESSION_STATUSES)[number], string> = {
  SCHEDULED: "예정",
  DIALING: "발신 중",
  IN_PROGRESS: "통화 중",
  COMPLETED: "통화 완료",
  MISSED: "불발",
};

export const callSessionSchema = z.object({
  id: z.string().uuid(),
  schedule_id: z.string().uuid(),
  senior_id: z.string().uuid(),
  status: z.enum(CALL_SESSION_STATUSES),
  attempt: z.number().int().min(1).max(3),
  /** KST 기준 발신 예정 시각 */
  scheduled_at: z.string().datetime({ offset: true }),
  started_at: z.string().datetime({ offset: true }).nullable(),
  ended_at: z.string().datetime({ offset: true }).nullable(),
  /** 통화당 실원가 (회선+STT+LLM+TTS 합산, 벤더 무관 필수) */
  cost_krw: z.number().nonnegative().nullable(),
});
export type CallSession = z.infer<typeof callSessionSchema>;

// ── 통화 턴 (전사) ──
export const callTurnSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  role: z.enum(["SYSTEM", "SENIOR"]),
  text: z.string(),
  created_at: z.string().datetime({ offset: true }),
});
export type CallTurn = z.infer<typeof callTurnSchema>;

// ── 통화 리포트 ──
export const ADHERENCE_STATUSES = [
  "DONE", // 완료
  "NOT_DONE", // 미이행
  "POSTPONED", // 연기
  "UNCERTAIN", // 확인필요 (억지 판정 금지 — 불확실하면 항상 이것)
  "MISSED", // 불발 (통화 자체가 안 됨)
] as const;
export const adherenceStatusLabel: Record<(typeof ADHERENCE_STATUSES)[number], string> = {
  DONE: "완료",
  NOT_DONE: "미이행",
  POSTPONED: "연기",
  UNCERTAIN: "확인필요",
  MISSED: "불발",
};

export const callReportSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  adherence_status: z.enum(ADHERENCE_STATUSES),
  /** 3줄 이내 요약 (의료 조언 금지) */
  summary: z.string().max(500),
  mood_flag: z.boolean(),
  health_flag: z.boolean(),
  prompt_version: z.string(),
  created_at: z.string().datetime({ offset: true }),
});
export type CallReport = z.infer<typeof callReportSchema>;

/** 리포트 하단 고정 고지 문구 (가드레일 1) */
export const MEDICAL_DISCLAIMER =
  "본 리포트는 통화 내용을 요약한 것으로, 의료적 판단이나 조언이 아닙니다. 건강 이상이 의심되면 의료진과 상담하세요.";
