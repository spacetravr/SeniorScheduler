"use client";

/**
 * 리포트 뷰 — 일 / 주 / 월 전환 탭. 데이터는 서버 페이지에서 내려주고,
 * 여기서 KST 달력 기준으로 집계·전환한다 (lib 미수정, 순수 함수 집계).
 * 날짜 그룹핑·집계·요약 텍스트는 reportSummary.ts의 순수 헬퍼 사용
 *   → kstYmd 기반이라 UTC 문자열 직접 slice 금지(과거 9시간 밀림 버그 방지).
 * 첫 진입 텍스트 최소화: 일별 카드의 요약문 모음은 기본 접힘 → "자세히 보기"로 펼친다.
 * 색·라운드·그림자는 토큰 클래스만 사용.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Copy, Check, Mail, Share2, X } from "lucide-react";
import { AdherenceStatusBadge } from "@/components/app/StatusBadge";
import { fmtDate, kstYmd } from "@/components/app/format";
import {
  addDaysYmd,
  anchor,
  buildReportSummary,
  periodLabel,
  rate,
  statusChips,
  weekdayKo,
  weekStartYmd,
  WEEKDAY_KO,
  type ReportItem,
  type View,
} from "@/components/app/reportSummary";

export type { ReportItem } from "@/components/app/reportSummary";

const VIEWS: { key: View; label: string }[] = [
  { key: "DAY", label: "일별" },
  { key: "WEEK", label: "주별" },
  { key: "MONTH", label: "월별" },
];

function StatusChips({ items }: { items: ReportItem[] }) {
  const chips = statusChips(items);
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 text-xs">
      {chips.map((c) => (
        <span
          key={c.status}
          className="inline-flex items-center gap-1 rounded-base bg-surface px-2 py-1 font-medium text-text-muted"
        >
          {c.label}
          <span className="tabular-nums text-primary">{c.count}</span>
        </span>
      ))}
    </div>
  );
}

/** 통화 상세 링크(sessionId 없으면 통화 목록). */
function hrefOf(item: ReportItem): string {
  return item.sessionId ? `/app/calls/${item.sessionId}` : "/app/calls";
}

export function ReportsView({ items }: { items: ReportItem[] }) {
  const [view, setView] = useState<View>("DAY");
  const [shareOpen, setShareOpen] = useState(false);

  // 날짜(KST) 정렬용 키를 미리 계산.
  const withYmd = useMemo(
    () => items.map((i) => ({ item: i, ymd: kstYmd(i.createdAt) })),
    [items],
  );

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

      {/* 요약 보내기 */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShareOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-base border border-border bg-bg px-3 py-2 text-sm font-semibold text-primary shadow-card transition-colors hover:bg-primary-soft"
        >
          <Share2 className="h-4 w-4" aria-hidden />
          요약 보내기
        </button>
      </div>

      {shareOpen && (
        <ShareSummary
          view={view}
          items={items}
          onClose={() => setShareOpen(false)}
        />
      )}

      {view === "DAY" ? (
        <DayView rows={withYmd} />
      ) : view === "WEEK" ? (
        <WeekView rows={withYmd} />
      ) : (
        <MonthView rows={withYmd} />
      )}
    </div>
  );
}

type Row = { item: ReportItem; ymd: string };

// ── 요약 보내기 모달 (미리보기 + 메일 / 복사) ──
function ShareSummary({
  view,
  items,
  onClose,
}: {
  view: View;
  items: ReportItem[];
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const text = useMemo(() => buildReportSummary(view, items), [view, items]);
  const period = useMemo(
    () => periodLabel(view, items.map((i) => kstYmd(i.createdAt))),
    [view, items],
  );

  const mailto = `mailto:?subject=${encodeURIComponent(
    `Senior Scheduler 리포트 요약 — ${period}`,
  )}&body=${encodeURIComponent(text)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-text/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="리포트 요약 보내기"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col gap-4 rounded-base border border-border bg-bg p-5 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="break-keep text-base font-bold">리포트 요약 보내기</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-base p-1 text-text-muted transition-colors hover:bg-surface"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-keep rounded-base bg-surface p-4 text-sm leading-relaxed text-text [font-family:var(--font-sans)]">
          {text}
        </pre>

        <div className="flex gap-2">
          <a
            href={mailto}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-base bg-primary px-3 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
          >
            <Mail className="h-4 w-4" aria-hidden />
            메일로 보내기
          </a>
          <button
            type="button"
            onClick={copy}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-base border border-border bg-bg px-3 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary-soft"
          >
            {copied ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : (
              <Copy className="h-4 w-4" aria-hidden />
            )}
            {copied ? "복사됨" : "복사하기"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 일별 뷰: 하루 = 카드 1개 ──
function DayView({ rows }: { rows: Row[] }) {
  const days = useMemo(() => {
    const map = new Map<string, ReportItem[]>();
    for (const { item, ymd } of rows) {
      const arr = map.get(ymd) ?? [];
      arr.push(item);
      map.set(ymd, arr);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0])) // 최신 날짜부터
      .map(([ymd, items]) => ({ ymd, items }));
  }, [rows]);

  return (
    <div className="flex flex-col gap-3">
      {days.map(({ ymd, items }) => (
        <DayCard key={ymd} ymd={ymd} items={items} />
      ))}
    </div>
  );
}

function DayCard({ ymd, items }: { ymd: string; items: ReportItem[] }) {
  const [open, setOpen] = useState(false); // 요약문 모음은 기본 접힘
  const done = items.filter((i) => i.status === "DONE").length;

  // 피보호자별 그룹(한 줄 요약용)
  const bySenior = new Map<string, ReportItem[]>();
  for (const i of items) {
    const arr = bySenior.get(i.seniorName) ?? [];
    arr.push(i);
    bySenior.set(i.seniorName, arr);
  }

  return (
    <article className="flex flex-col gap-3 rounded-base border border-border bg-bg p-5 shadow-card">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="break-keep text-base font-bold">
          {fmtDate(anchor(ymd))} ({weekdayKo(ymd)})
        </h3>
        <span className="text-sm text-text-muted tabular-nums">
          총 {items.length}통 · 완료 {done}
        </span>
      </div>

      <StatusChips items={items} />

      {/* 피보호자별 상태 한 줄 */}
      <div className="flex flex-col gap-1">
        {[...bySenior.entries()].map(([name, list]) => (
          <div key={name} className="flex items-center gap-2 text-sm">
            <span className="break-keep font-medium">{name}</span>
            <div className="flex flex-wrap gap-1">
              {list.map((i) => (
                <AdherenceStatusBadge key={i.id} status={i.status} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* 요약문 모음 — 기본 접힘, "자세히 보기"로 펼침 */}
      <div className="border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-2 text-sm font-medium text-text-muted transition-colors hover:text-primary"
        >
          <span>통화별 요약 {items.length}건</span>
          <span className="inline-flex items-center gap-1">
            {open ? "접기" : "자세히 보기"}
            <ChevronDown
              className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden
            />
          </span>
        </button>

        {open && (
          <div className="mt-3 flex flex-col gap-2">
            {items.map((i) => (
              <Link
                key={i.id}
                href={hrefOf(i)}
                className="flex flex-col gap-0.5 rounded-base px-1 py-1 transition-colors hover:bg-surface"
              >
                <span className="break-keep text-xs text-text-muted">
                  {i.seniorName} · {i.title}
                </span>
                <p className="line-clamp-2 break-keep text-sm leading-relaxed">
                  {i.summary}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

// ── 주별 뷰: 주(월~일, KST) = 카드 1개 ──
function WeekView({ rows }: { rows: Row[] }) {
  const weeks = useMemo(() => {
    const map = new Map<string, ReportItem[]>();
    for (const { item, ymd } of rows) {
      const wk = weekStartYmd(ymd);
      const arr = map.get(wk) ?? [];
      arr.push(item);
      map.set(wk, arr);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([start, items]) => ({ start, items }));
  }, [rows]);

  return (
    <div className="flex flex-col gap-3">
      {weeks.map(({ start, items }) => {
        const end = addDaysYmd(start, 6);
        const done = items.filter((i) => i.status === "DONE").length;
        // 요일별 미니 표시(월~일)
        const dayCells = Array.from({ length: 7 }, (_, idx) => {
          const dayYmd = addDaysYmd(start, idx);
          const dayItems = items.filter((i) => kstYmd(i.createdAt) === dayYmd);
          return {
            label: WEEKDAY_KO[(idx + 1) % 7],
            hasReport: dayItems.length > 0,
            done: dayItems.some((i) => i.status === "DONE"),
          };
        });
        return (
          <article
            key={start}
            className="flex flex-col gap-4 rounded-base border border-border bg-bg p-5 shadow-card"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="break-keep text-base font-bold">
                {fmtDate(anchor(start))} ~ {fmtDate(anchor(end))}
              </h3>
              <p className="text-sm text-text-muted">
                <span className="text-xl font-bold text-primary tabular-nums">
                  {rate(done, items.length)}%
                </span>{" "}
                <span className="tabular-nums">
                  ({done}/{items.length}건)
                </span>
              </p>
            </div>

            <div className="flex justify-between gap-2">
              {dayCells.map((d, i) => (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                  <span
                    className={`flex h-9 w-full items-center justify-center rounded-base text-xs font-semibold ${
                      d.done
                        ? "bg-primary text-bg"
                        : "bg-surface text-text-muted"
                    }`}
                    aria-label={!d.hasReport ? "기록 없음" : d.done ? "이행" : "미이행"}
                  >
                    {d.hasReport ? (d.done ? "○" : "–") : ""}
                  </span>
                  <span className="text-xs text-text-muted">{d.label}</span>
                </div>
              ))}
            </div>

            <StatusChips items={items} />
          </article>
        );
      })}
    </div>
  );
}

// ── 월별 뷰: 월 = 카드 1개 ──
function MonthView({ rows }: { rows: Row[] }) {
  const months = useMemo(() => {
    const map = new Map<string, ReportItem[]>();
    for (const { item, ymd } of rows) {
      const key = ymd.slice(0, 7); // YYYY-MM
      const arr = map.get(key) ?? [];
      arr.push(item);
      map.set(key, arr);
    }
    return [...map.entries()]
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([ym, items]) => ({ ym, items }));
  }, [rows]);

  return (
    <div className="flex flex-col gap-3">
      {months.map(({ ym, items }) => {
        const [y, m] = ym.split("-");
        const done = items.filter((i) => i.status === "DONE").length;
        return (
          <article
            key={ym}
            className="flex flex-col gap-4 rounded-base border border-border bg-bg p-5 shadow-card"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="break-keep text-base font-bold">
                {y}년 {Number(m)}월
              </h3>
              <p className="text-sm text-text-muted">
                <span className="text-xl font-bold text-primary tabular-nums">
                  {rate(done, items.length)}%
                </span>{" "}
                <span className="tabular-nums">총 {items.length}통</span>
              </p>
            </div>
            <StatusChips items={items} />
          </article>
        );
      })}
    </div>
  );
}
