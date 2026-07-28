/**
 * 이행률 추이 스파크라인 — 순수 CSS 막대(외부 차트 라이브러리 없음).
 * 값이 없는 날(null)은 흐린 최소 막대로 그려 0% 로 오해되지 않게 한다.
 * 색은 토큰 클래스만 사용. 스크린리더용 aria-label 은 sparklineLabel(순수 함수)이 만든다.
 */
import { sparklineHeight, sparklineLabel } from "@/components/app/digestTone";

export function Sparkline({
  trend,
  variant = "onLight",
}: {
  /** 오래된 → 최신. 각 원소는 이행률 0~100 또는 null(통화 없음) */
  trend: (number | null)[];
  /** onAccent: ALERT 카드처럼 accent 배경 위에 올릴 때 */
  variant?: "onLight" | "onAccent";
}) {
  if (trend.length < 2) return null;

  const filled = variant === "onAccent" ? "bg-bg" : "bg-primary";
  const empty = variant === "onAccent" ? "bg-bg/30" : "bg-primary/15";

  return (
    <div
      role="img"
      aria-label={sparklineLabel(trend)}
      className="flex h-8 items-end gap-1"
    >
      {trend.map((v, i) => (
        <span
          key={i}
          aria-hidden
          className={`w-1.5 shrink-0 rounded-base ${v === null ? empty : filled}`}
          style={{ height: `${sparklineHeight(v)}%` }}
        />
      ))}
    </div>
  );
}
