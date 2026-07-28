import { z } from "zod";

/**
 * 알림 채널 계약 — contract-first 단일 소스 (오케스트레이터 승인 없이 변경 금지).
 *
 * 확장 지점: 리포트를 "어디로" 보낼지는 이 어댑터 뒤에 숨긴다.
 * 지금 가동: EMAIL(Resend). 준비만: ALIMTALK(카카오 채널·템플릿 심사 후 env 만 채우면 활성).
 * 카톡 "공유"(자녀가 가족에게 직접 보내기)는 발송이 아니라 클라이언트 액션이라 어댑터 대상이 아니다
 * (renderShareText 결과를 Web Share / 카카오 공유 링크에 실어 보낸다).
 */

// ── 알림 레벨 (THIRD-PLAN P0-3 — 예외 기반 기본값) ──
export const NOTIFY_LEVELS = ["ALL", "EXCEPTION", "WEEKLY_ONLY"] as const;
export type NotifyLevel = (typeof NOTIFY_LEVELS)[number];

export const notifyLevelLabel: Record<NotifyLevel, string> = {
  ALL: "모든 통화 결과",
  EXCEPTION: "이상 신호만 (권장)",
  WEEKLY_ONLY: "주간 요약만",
};

export const notifyLevelHint: Record<NotifyLevel, string> = {
  ALL: "통화가 끝날 때마다 알려드려요. 알림이 잦을 수 있어요.",
  EXCEPTION: "평소에는 조용히, 확인이 필요한 일이 있을 때만 알려드려요.",
  WEEKLY_ONLY: "매주 화요일 오전, 한 주를 정리한 요약만 받아보세요.",
};

/** 기본값 — 오경보 관리가 곧 제품(리서치): 예외 기반이 기본. */
export const DEFAULT_NOTIFY_LEVEL: NotifyLevel = "EXCEPTION";

// ── 채널 ──
export const NOTIFY_CHANNELS = ["EMAIL", "ALIMTALK"] as const;
export type NotifyChannel = (typeof NOTIFY_CHANNELS)[number];

// ── 발송 종류 ──
export const NOTIFY_KINDS = ["EXCEPTION_ALERT", "WEEKLY_DIGEST"] as const;
export type NotifyKind = (typeof NOTIFY_KINDS)[number];

export const notifyResultSchema = z.object({
  channel: z.enum(NOTIFY_CHANNELS),
  /** sent: 실발송 / skipped: 설정·키 미비로 조용히 통과(정상) / failed: 시도했으나 실패 */
  status: z.enum(["sent", "skipped", "failed"]),
  /** skipped·failed 사유 (PII 금지 — 이메일 주소·전화번호 기재 금지) */
  reason: z.string().optional(),
});
export type NotifyResult = z.infer<typeof notifyResultSchema>;

/**
 * 발송 어댑터. 구현체는 lib/notify/ 하위.
 * 규약: **절대 throw 하지 않는다.** 실패는 status:"failed" 로 강등해 크론·콜백을 죽이지 않는다
 * (lib/ai/llm.ts 의 null 강등 원칙과 동일).
 */
export interface NotifyAdapter {
  readonly channel: NotifyChannel;
  /** 어댑터가 지금 실제로 보낼 수 있는 상태인지(키·설정 존재). false 면 라우터가 skip 처리. */
  isEnabled(): boolean;
  send(input: NotifySendInput): Promise<NotifyResult>;
}

export type NotifySendInput = {
  kind: NotifyKind;
  /** 수신자 식별 — 채널별 의미가 다르다(EMAIL: 주소, ALIMTALK: 수신 번호) */
  to: string;
  subject: string;
  /** 플레인 텍스트 본문 (모든 채널 공통 폴백) */
  text: string;
  /** HTML 본문 (EMAIL 전용, 없으면 text 로 발송) */
  html?: string;
  /** 알림톡 템플릿 변수 맵 (ALIMTALK 전용, 템플릿 승인 후 사용) */
  templateVars?: Record<string, string>;
  /** 리포트 딥링크 (버튼 대상) */
  linkUrl?: string;
};
