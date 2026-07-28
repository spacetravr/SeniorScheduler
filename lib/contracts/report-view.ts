import { z } from "zod";
import { ADHERENCE_STATUSES } from "@/lib/contracts/domain";

/**
 * 리포트 표시 계약 (ReportDigest) — contract-first 단일 소스 (오케스트레이터 승인 없이 변경 금지).
 *
 * 설계 원칙 (docs/report-spec.md 가 상세):
 *  - **채널 무관 ViewModel**. 웹·이메일·카톡 공유·(향후) 알림톡·PDF 가 전부 이 한 구조를 렌더한다.
 *    새 채널을 붙일 때 집계 로직을 다시 짜지 않는다 = 확장 지점.
 *  - **3계층**: headline(한 줄 판정) → items(일정별 한 줄) → detail(접힘 상세).
 *    자녀는 headline 만 보고 닫을 수 있어야 하고, 필요할 때만 아래로 내려간다.
 *  - **예외 우선**: 이상 신호(NOT_DONE/UNCERTAIN/MISSED)가 항상 정상보다 위. 정상은 조용히.
 *  - 억지 판정 금지 원칙(CLAUDE.md)이 표시 레이어까지 관통 — UNCERTAIN 은 "확인 필요"로
 *    그대로 노출하며 DONE 으로 반올림하지 않는다.
 */

// ── 톤 (headline 색·아이콘 결정) ──
export const DIGEST_TONES = ["CALM", "ATTENTION", "ALERT"] as const;
export type DigestTone = (typeof DIGEST_TONES)[number];

/**
 * CALM      이상 신호 0건 — 무음 대상(알림 레벨 EXCEPTION 이면 발송하지 않음)
 * ATTENTION 이상 신호 1건 — 리포트/대시보드에 표시, 단발 알림은 보류
 * ALERT     이상 신호 2건+ 또는 연속 MISSED — 에스컬레이션 대상(tel: 원버튼 동반)
 */
export const toneLabel: Record<DigestTone, string> = {
  CALM: "이상 없음",
  ATTENTION: "확인 권장",
  ALERT: "확인 필요",
};

// ── 기간 ──
export const DIGEST_PERIODS = ["DAY", "WEEK", "MONTH"] as const;
export type DigestPeriod = (typeof DIGEST_PERIODS)[number];

export const digestPeriodSchema = z.object({
  kind: z.enum(DIGEST_PERIODS),
  /** 사람이 읽는 기간 표기 — 예: "7월 28일 (월)" / "7월 21일 ~ 7월 27일" */
  label: z.string(),
  /** KST 달력 경계 "YYYY-MM-DD" (양 끝 포함) */
  startYmd: z.string(),
  endYmd: z.string(),
});

// ── 개별 항목 (일정 1건 = 통화 1건) ──
export const digestItemSchema = z.object({
  reportId: z.string(),
  sessionId: z.string().nullable(),
  /** KST "HH:mm" — 통화(리포트 생성) 시각 */
  time: z.string(),
  /** KST "YYYY-MM-DD" — 주/월 뷰에서 날짜별 묶음에 사용 */
  ymd: z.string(),
  /** 일정 제목 (예: "아침 혈압약") */
  title: z.string(),
  status: z.enum(ADHERENCE_STATUSES),
  statusLabel: z.string(),
  /** 이 항목이 이상 신호인지 — 정렬·카운트의 단일 기준 */
  isException: z.boolean(),
  /** 통화 요약 1~3문장 (L2 상세에서만 노출) */
  summary: z.string(),
  moodFlag: z.boolean(),
  healthFlag: z.boolean(),
});
export type DigestItem = z.infer<typeof digestItemSchema>;

// ── 피보호자별 묶음 ──
export const digestSeniorSchema = z.object({
  seniorId: z.string(),
  name: z.string(),
  /** 피보호자 구분색 인덱스 (0|1|2 — --color-senior-{1,2,3} 에 대응) */
  colorIndex: z.number().int().min(0).max(2),
  exceptionCount: z.number().int().nonnegative(),
  /** 예외 우선 → 시간 오름차순으로 이미 정렬된 상태로 전달된다 */
  items: z.array(digestItemSchema),
});
export type DigestSenior = z.infer<typeof digestSeniorSchema>;

// ── 집계 ──
export const digestStatsSchema = z.object({
  total: z.number().int().nonnegative(),
  done: z.number().int().nonnegative(),
  notDone: z.number().int().nonnegative(),
  postponed: z.number().int().nonnegative(),
  uncertain: z.number().int().nonnegative(),
  missed: z.number().int().nonnegative(),
  exception: z.number().int().nonnegative(),
  /**
   * 이행률 0~100 (반올림). 분모는 MISSED 를 제외한 "통화가 성사된 건" —
   * 부재는 이행 실패가 아니므로 이행률을 깎지 않는다(억지 판정 금지의 집계판).
   * 분모 0이면 null.
   */
  adherenceRate: z.number().int().min(0).max(100).nullable(),
});
export type DigestStats = z.infer<typeof digestStatsSchema>;

// ── 최상위 ──
export const reportDigestSchema = z.object({
  period: digestPeriodSchema,
  tone: z.enum(DIGEST_TONES),
  /** 한 줄 판정 — 예: "오늘은 이상 신호가 없었어요" / "확인이 필요한 일이 2건 있어요" */
  headline: z.string(),
  /** headline 아래 한 줄 보조 설명 (수치 요약). 없으면 빈 문자열 */
  subline: z.string(),
  stats: digestStatsSchema,
  seniors: z.array(digestSeniorSchema),
  /** 최근 추이 스파크라인용 (오래된→최신). 각 원소는 해당 일자 이행률 0~100 또는 null(통화 없음) */
  trend: z.array(z.number().int().min(0).max(100).nullable()),
});
export type ReportDigest = z.infer<typeof reportDigestSchema>;

/**
 * 리포트 하단 고정 고지 — 긴급구조 대체 아님 (THIRD-PLAN P0-7).
 * MEDICAL_DISCLAIMER(도메인) 과 **항상 함께** 렌더한다. 웹·이메일·공유 텍스트 공통.
 */
export const EMERGENCY_DISCLAIMER =
  "본 서비스는 응급 상황을 감지하거나 긴급 구조를 대행하지 않습니다. 위급하다고 판단되시면 119에 연락해 주세요.";
