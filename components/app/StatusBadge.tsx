/**
 * 통합 상태 뱃지 — 통화 세션 상태 / 이행 상태를 한국어 라벨 + 토큰 색상으로 표시.
 * 색은 디자인 토큰(primary/accent/surface/text-muted)만 조합 (hex 하드코딩 금지).
 * 확정 토큰 교체 시 자동 반영된다.
 */
import {
  callSessionStatusLabel,
  adherenceStatusLabel,
  type CallSession,
  type CallReport,
  type Senior,
} from "@/lib/contracts/domain";
import {
  getConsentStatus,
  consentStatusLabel,
  type ConsentStatus,
} from "@/components/app/consent";

type Tone = "neutral" | "info" | "active" | "success" | "warn" | "postpone" | "uncertain" | "missed";

const TONE_CLASS: Record<Tone, string> = {
  // 예정: 차분한 표면색
  neutral: "bg-surface text-text-muted",
  // 발신 중: 표면 + primary 텍스트
  info: "bg-surface text-primary",
  // 통화 중: primary 채움 (진행 강조)
  active: "bg-primary text-bg",
  // 완료: primary 채움
  success: "bg-primary text-bg",
  // 미이행: accent 채움 (주의)
  warn: "bg-accent text-bg",
  // 연기: primary 외곽선
  postpone: "border border-primary text-primary",
  // 확인필요: accent 외곽선
  uncertain: "border border-accent text-accent",
  // 불발: text-muted 외곽선
  missed: "border border-text-muted text-text-muted",
};

const SESSION_TONE: Record<CallSession["status"], Tone> = {
  SCHEDULED: "neutral",
  DIALING: "info",
  IN_PROGRESS: "active",
  COMPLETED: "success",
  MISSED: "missed",
};

const ADHERENCE_TONE: Record<CallReport["adherence_status"], Tone> = {
  DONE: "success",
  NOT_DONE: "warn",
  POSTPONED: "postpone",
  UNCERTAIN: "uncertain",
  MISSED: "missed",
};

const CONSENT_TONE: Record<ConsentStatus, Tone> = {
  // 대리동의 없음: 조치 필요 (accent 외곽선)
  NONE: "uncertain",
  // 본인 동의 대기: 진행 중 (primary 외곽선)
  SELF_PENDING: "postpone",
  // 동의 완료: primary 채움
  DONE: "success",
};

function Badge({ label, tone }: { label: string; tone: Tone }) {
  return (
    <span
      className={`inline-flex items-center rounded-base px-2.5 py-1 text-xs font-semibold leading-none ${TONE_CLASS[tone]}`}
    >
      {label}
    </span>
  );
}

export function SessionStatusBadge({ status }: { status: CallSession["status"] }) {
  return <Badge label={callSessionStatusLabel[status]} tone={SESSION_TONE[status]} />;
}

export function AdherenceStatusBadge({
  status,
}: {
  status: CallReport["adherence_status"];
}) {
  return <Badge label={adherenceStatusLabel[status]} tone={ADHERENCE_TONE[status]} />;
}

/** 동의 상태 뱃지 — 대리동의(consent_at) + 본인 동의(self_consent_at) 2단계 판정. */
export function ConsentBadge({
  senior,
}: {
  senior: Pick<Senior, "consent_at" | "self_consent_at">;
}) {
  const status = getConsentStatus(senior);
  return <Badge label={consentStatusLabel[status]} tone={CONSENT_TONE[status]} />;
}
