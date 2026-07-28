/**
 * L0 — 톤 헤드라인 카드 (리포트·대시보드 공용, docs/report-spec.md §1).
 *
 * "이것만 보고 닫아도 되는 층". headline/subline 은 buildDigest 가 만든 문장을 **그대로** 쓴다
 * (표시 레이어에서 문구를 재조립하지 않는다 = 채널 간 문구 일관성).
 *  - CALM      차분한 카드 + 체크 아이콘
 *  - ATTENTION 테라코타 테두리
 *  - ALERT     테라코타 배경 + tel: 원버튼(연락처가 있을 때만)
 * 색·라운드·그림자는 토큰 클래스만 사용.
 */
import { AlertTriangle, CheckCircle2, PhoneCall } from "lucide-react";
import { Sparkline } from "@/components/app/Sparkline";
import { escalateTone, telHref } from "@/components/app/digestTone";
import { toneLabel, type ReportDigest } from "@/lib/contracts/report-view";

export type CallTarget = { name: string; phone: string };

const TONE_CARD = {
  CALM: "border border-border bg-bg",
  ATTENTION: "border-2 border-accent bg-bg",
  ALERT: "border-2 border-accent bg-accent text-bg",
} as const;

const TONE_MUTED = {
  CALM: "text-text-muted",
  ATTENTION: "text-text-muted",
  ALERT: "text-bg/90",
} as const;

const TONE_CHIP = {
  CALM: "bg-primary-soft text-primary",
  ATTENTION: "bg-accent text-bg",
  ALERT: "bg-bg text-accent",
} as const;

export function DigestCard({
  digest,
  title,
  trend,
  hasMissedStreak = false,
  missedStreakNames = [],
  callTargets = [],
  children,
}: {
  digest: ReportDigest;
  /** 카드 상단 소제목 — 생략 시 기간 라벨 */
  title?: string;
  /** 추이 override (일별 카드처럼 자기 기간의 점이 1개뿐일 때 최근 7일 추이를 대신 넣는다) */
  trend?: (number | null)[];
  /** 연속 불발 승격 — true 면 톤을 ALERT 로 올린다(강등 없음) */
  hasMissedStreak?: boolean;
  /** 연속 불발이 감지된 피보호자 이름 (카드 안에 흡수해 표시 — 별도 배너 금지) */
  missedStreakNames?: string[];
  /** ALERT 일 때 노출할 tel: 대상 */
  callTargets?: CallTarget[];
  children?: React.ReactNode;
}) {
  const tone = escalateTone(digest.tone, hasMissedStreak);
  const Icon = tone === "CALM" ? CheckCircle2 : AlertTriangle;
  const points = trend ?? digest.trend;

  return (
    <article
      className={`flex flex-col gap-4 rounded-base p-5 shadow-card ${TONE_CARD[tone]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className={`break-keep text-xs font-semibold ${TONE_MUTED[tone]}`}>
          {title ?? digest.period.label}
        </p>
        <span
          className={`inline-flex shrink-0 items-center rounded-base px-2 py-0.5 text-xs font-semibold leading-none ${TONE_CHIP[tone]}`}
        >
          {toneLabel[tone]}
        </span>
      </div>

      {/* 헤드라인 — 3초 안에 읽히는 한 줄 */}
      <div className="flex items-start gap-3">
        <Icon className="mt-0.5 h-6 w-6 shrink-0" aria-hidden strokeWidth={2} />
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="break-keep text-lg font-bold leading-snug">
            {digest.headline}
          </h3>
          {digest.subline ? (
            <p className={`break-keep text-sm leading-relaxed ${TONE_MUTED[tone]}`}>
              {digest.subline}
            </p>
          ) : null}
        </div>
      </div>

      {/* 연속 불발 안내 — 기존 별도 경고 배너를 이 카드로 흡수 */}
      {missedStreakNames.length > 0 ? (
        <p
          role="alert"
          className={`break-keep rounded-base px-3 py-2 text-sm leading-relaxed ${
            tone === "ALERT" ? "bg-bg/15 text-bg" : "bg-accent/10 text-accent"
          }`}
        >
          {missedStreakNames.join(", ")}님이 최근 3회 연속 전화를 받지 못하셨어요. 직접
          안부를 확인해 보시는 걸 권해드려요.
        </p>
      ) : null}

      {/* 추이 스파크라인 */}
      {points.length >= 2 ? (
        <div className="flex items-end gap-2">
          <Sparkline trend={points} variant={tone === "ALERT" ? "onAccent" : "onLight"} />
          <span className={`text-xs ${TONE_MUTED[tone]}`}>최근 추이</span>
        </div>
      ) : null}

      {/* ALERT 원버튼 — 지금 직접 전화 */}
      {tone === "ALERT" && callTargets.length > 0 ? (
        <div className="flex flex-col gap-2">
          <p className="break-keep text-sm font-semibold">
            지금 전화해 보시겠어요?
          </p>
          <div className="flex flex-wrap gap-2">
            {callTargets.map((t) => {
              const href = telHref(t.phone);
              if (!href) return null;
              return (
                <a
                  key={`${t.name}-${t.phone}`}
                  href={href}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-base bg-bg px-4 py-3 text-sm font-bold text-accent transition-opacity hover:opacity-90"
                >
                  <PhoneCall className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2} />
                  {t.name}께 전화
                </a>
              );
            })}
          </div>
        </div>
      ) : null}

      {children}
    </article>
  );
}
