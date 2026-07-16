import { pct } from "./lib";
import {
  GROUP_META,
  type ChannelDatum,
  type ChannelGroup,
  type MetricsView,
} from "./demo-data";

/**
 * /admin/metrics 그래프 컴포넌트(순수 CSS/SVG, 외부 차트 라이브러리 미사용).
 * 데이터는 MetricsView 뷰모델로 정규화해 받는다(실데이터·데모 공용).
 * 막대 폭은 방문 대비 % 기반 → 모바일에서도 줄바꿈·가로 스크롤 없이 안정.
 */

/** 방문 → 사전등록 클릭 → 이메일 제출 3단계 가로 막대. */
export function FunnelChart({ summary }: { summary: MetricsView["summary"] }) {
  const { visitors, clickTry, waitlist } = summary;
  const stages = [
    {
      key: "visit",
      label: "방문",
      value: visitors,
      barClass: "bg-primary-soft",
      // primary-soft 배경 위 대비 확보: 진한 잉크 텍스트
      textClass: "text-text",
      rate: null as string | null,
      rateLabel: "",
    },
    {
      key: "click",
      label: "사전등록 클릭",
      value: clickTry,
      barClass: "bg-primary",
      textClass: "text-bg",
      rate: pct(clickTry, visitors),
      rateLabel: "클릭률",
    },
    {
      key: "submit",
      label: "이메일 제출",
      value: waitlist,
      barClass: "bg-accent",
      textClass: "text-bg",
      rate: pct(waitlist, visitors),
      rateLabel: "전환율",
    },
  ];

  return (
    <div className="flex flex-col gap-2">
      {stages.map((st) => {
        const widthPct = visitors > 0 ? (st.value / visitors) * 100 : 0;
        const ariaRate = st.rate ? `, ${st.rateLabel} ${st.rate}` : "";
        return (
          <div key={st.key} className="break-keep">
            <div className="mb-1 flex items-baseline justify-between text-sm">
              <span className="font-medium text-text">{st.label}</span>
              <span className="text-text-muted tabular-nums">
                <span className="font-semibold text-text">{st.value}</span>
                {st.rate && (
                  <span className="ml-2 text-xs">
                    {st.rateLabel} {st.rate}
                  </span>
                )}
              </span>
            </div>
            <div
              className="h-8 w-full overflow-hidden rounded-base bg-surface"
              role="img"
              aria-label={`${st.label} ${st.value}건${ariaRate}`}
            >
              <div
                className={`flex h-full min-w-[3rem] items-center rounded-base px-2 ${st.barClass}`}
                style={{ width: `${Math.max(widthPct, 4)}%` }}
              >
                <span
                  className={`text-xs font-semibold tabular-nums ${st.textClass}`}
                >
                  {st.value}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** 단일 채널 가로 막대 행. */
function ChannelBar({ r, maxView }: { r: ChannelDatum; maxView: number }) {
  const widthPct = maxView > 0 ? (r.view / maxView) * 100 : 0;
  return (
    <li className="break-keep">
      <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
        <span className="min-w-0 truncate font-medium text-text">
          {r.source}
        </span>
        <span className="shrink-0 text-xs text-text-muted tabular-nums">
          방문 <span className="font-semibold text-text">{r.view}</span>
          <span className="mx-1 text-text-muted/50">·</span>클릭 {r.clickTry}
          <span className="mx-1 text-text-muted/50">·</span>제출 {r.submit}
        </span>
      </div>
      <div
        className="h-4 w-full overflow-hidden rounded-base bg-surface"
        role="img"
        aria-label={`${r.source} 방문 ${r.view}건, 사전등록 클릭 ${r.clickTry}건, 이메일 제출 ${r.submit}건`}
      >
        <div
          className="h-full rounded-base bg-primary"
          style={{ width: `${Math.max(widthPct, 2)}%` }}
        />
      </div>
    </li>
  );
}

/** 채널별 가로 막대 차트. 그룹이 있으면 소제목으로 구분. */
export function ChannelBarChart({ channels }: { channels: ChannelDatum[] }) {
  if (channels.length === 0) {
    return (
      <p className="rounded-base border border-text-muted/20 bg-surface p-4 text-center text-sm text-text-muted">
        아직 수집된 방문이 없습니다.
      </p>
    );
  }

  const maxView = Math.max(...channels.map((c) => c.view), 1);
  const hasGroups = channels.some((c) => c.group);

  if (!hasGroups) {
    const sorted = [...channels].sort((a, b) => b.view - a.view);
    return (
      <ul className="flex flex-col gap-3">
        {sorted.map((r) => (
          <ChannelBar key={r.source} r={r} maxView={maxView} />
        ))}
      </ul>
    );
  }

  const groups: ChannelGroup[] = ["1차", "2차"];
  return (
    <div className="flex flex-col gap-6">
      {groups.map((g) => {
        const rows = channels
          .filter((c) => c.group === g)
          .sort((a, b) => b.view - a.view);
        if (rows.length === 0) return null;
        const meta = GROUP_META[g];
        const groupView = rows.reduce((s, r) => s + r.view, 0);
        return (
          <div key={g}>
            <div className="mb-2 flex items-baseline justify-between break-keep">
              <h3 className="text-sm font-semibold text-text">{meta.title}</h3>
              <span className="text-xs text-text-muted tabular-nums">
                방문 합계 {groupView}
              </span>
            </div>
            <ul className="flex flex-col gap-3">
              {rows.map((r) => (
                <ChannelBar key={r.source} r={r} maxView={maxView} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
