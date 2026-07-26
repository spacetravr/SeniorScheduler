import { z } from "zod";

/**
 * 알림 설정 계약 — contract-first 단일 소스 (오케스트레이터 승인 없이 변경 금지).
 * DB: guardians 테이블 3개 boolean 컬럼(0008 마이그레이션)과 1:1.
 * data: lib/actions/settings.ts 가 이 스키마로 검증·저장. ui 는 다음 웨이브에서 이 타입으로 렌더.
 * CLAUDE.md `## 데이터 모델` 및 globals 규칙과 동기화 유지.
 */
export const notifySettingsSchema = z.object({
  /** 통화 결과(리포트) 알림 수신 */
  notify_call_result: z.boolean(),
  /** 불발(MISSED) 알림 수신 */
  notify_missed: z.boolean(),
  /** 주간 요약 메일 수신 (기본 OFF) — 주간 리포트 cron 발송 대상 필터 */
  notify_weekly_summary: z.boolean(),
});
export type NotifySettings = z.infer<typeof notifySettingsSchema>;

/** 신규 보호자/누락 행 기본값 — DB 컬럼 default 와 일치. */
export const DEFAULT_NOTIFY_SETTINGS: NotifySettings = {
  notify_call_result: true,
  notify_missed: true,
  notify_weekly_summary: false,
};
