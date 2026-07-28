"use client";

/**
 * 리포트 뷰 — 일 / 주 / 월 전환 탭. 각 기간을 **buildDigest 로 다이제스트화**해 3계층으로 렌더한다
 * (docs/report-spec.md §1).
 *   L0 톤 헤드라인 카드(DigestCard) → L1 항목 한 줄 → L2 접힘 상세(DigestItems)
 * 집계·정렬·문구는 전부 lib/reports/digest.ts 가 만든 결과를 그대로 쓴다 —
 * 화면에서 재계산·재정렬하지 않는다(채널 간 판정 불일치 방지).
 *
 * 기간 그룹핑(어느 날짜가 어느 카드에 들어가는가)만 이 파일의 책임이며, KST 달력 문자열
 * 연산(lib/reports/summary 의 순수 헬퍼)만 사용한다.
 * 색·라운드·그림자는 토큰 클래스만 사용.
 */
import { useMemo, useState } from "react";
import { Share2 } from "lucide-react";
import { DigestCard } from "@/components/app/DigestCard";
import { DigestItems } from "@/components/app/DigestItems";
import { ShareDigestModal } from "@/components/app/ShareDigestModal";
import { kstYmd } from "@/components/app/format";
import {
  addDaysYmd,
  weekStartYmd,
  type View,
} from "@/components/app/reportSummary";
import { buildDigest, type DigestInput } from "@/lib/reports/digest";
import type { ReportDigest } from "@/lib/contracts/report-view";

export type { DigestInput } from "@/lib/reports/digest";

const VIEWS: { key: View; label: string }[] = [
  { key: "DAY", label: "일별" },
  { key: "WEEK", label: "주별" },
  { key: "MONTH", label: "월별" },
];

/** "YYYY-MM" → 그 달 마지막 날 "YYYY-MM-DD" (다음 달 1일 -1일, 순수 달력 연산). */
function monthEndYmd(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const nextFirst = new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1))
    .toISOString()
    .slice(0, 10);
  return addDaysYmd(nextFirst, -1);
}

/** 뷰별 기간 경계 — 그룹 키(KST 달력)에서 시작·끝 날짜를 만든다. */
function rangeOf(view: View, key: string): { startYmd: string; endYmd: string } {
  if (view === "DAY") return { startYmd: key, endYmd: key };
  if (view === "WEEK") return { startYmd: key, endYmd: addDaysYmd(key, 6) };
  return { startYmd: `${key}-01`, endYmd: monthEndYmd(key) };
}

function groupKey(view: View, ymd: string): string {
  if (view === "DAY") return ymd;
  if (view === "WEEK") return weekStartYmd(ymd);
  return ymd.slice(0, 7);
}

export function ReportsView({ items }: { items: DigestInput[] }) {
  const [view, setView] = useState<View>("DAY");
  const [shareTarget, setShareTarget] = useState<ReportDigest | null>(null);

  // 기간별 다이제스트 — 최신 기간이 위.
  const digests = useMemo(() => {
    const map = new Map<string, DigestInput[]>();
    for (const item of items) {
      const key = groupKey(view, kstYmd(item.createdAt));
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, group]) => ({
        key,
        digest: buildDigest(
          view,
          group,
          rangeOf(view, key),
        ),
      }));
  }, [items, view]);

  /**
   * 일별 카드는 자기 기간의 점이 1개뿐이라 추이가 그려지지 않는다 →
   * 최신 카드 한 장에만 전체 항목 기준 최근 7일 추이를 얹는다(집계는 동일하게 buildDigest).
   */
  const recentTrend = useMemo(() => buildDigest("WEEK", items).trend, [items]);

  return (
    <div className="flex flex-col gap-5">
      {/* 뷰 전환 탭 */}
      <div
        role="tablist"
        aria-label="리포트 기간"
        className="flex gap-1 rounded-base bg-surface p-1"
      >
        {VIEWS.map((v) => {
          const on = view === v.key;
          return (
            <button
              key={v.key}
              role="tab"
              aria-selected={on}
              type="button"
              onClick={() => setView(v.key)}
              className={`flex-1 rounded-base px-3 py-2 text-sm font-semibold transition-colors ${
                on ? "bg-primary text-bg" : "text-text-muted"
              }`}
            >
              {v.label}
            </button>
          );
        })}
      </div>

      {digests.map(({ key, digest }, idx) => (
        <section key={`${view}-${key}`} className="flex flex-col gap-3">
          {/* L0 */}
          <DigestCard
            digest={digest}
            trend={view === "DAY" && idx === 0 ? recentTrend : undefined}
          />

          {/* L1 + L2 */}
          <DigestItems seniors={digest.seniors} />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShareTarget(digest)}
              className="inline-flex items-center gap-1.5 rounded-base border border-border bg-bg px-3 py-2 text-sm font-semibold text-primary shadow-card transition-colors hover:bg-primary-soft"
            >
              <Share2 className="h-4 w-4" aria-hidden />
              요약 보내기
            </button>
          </div>
        </section>
      ))}

      {shareTarget ? (
        <ShareDigestModal digest={shareTarget} onClose={() => setShareTarget(null)} />
      ) : null}
    </div>
  );
}
