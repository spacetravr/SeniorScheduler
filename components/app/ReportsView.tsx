"use client";

/**
 * 리포트 뷰 — 일 / 주 / 월 전환 탭. 데이터는 서버 페이지에서 내려주고,
 * 여기서 KST 달력 기준으로 집계·전환한다 (lib 미수정, 순수 함수 집계).
 * 날짜 그룹핑은 kstYmd 사용 — UTC 문자열 직접 slice 금지(과거 9시간 밀림 버그 방지).
 * 색·라운드·그림자는 토큰 클래스만 사용.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ADHERENCE_STATUSES,
  adherenceStatusLabel,
  type CallReport,
} from "@/lib/contracts/domain";
import { AdherenceStatusBadge } from "@/components/app/StatusBadge";
import { fmtDate, kstYmd } from "@/components/app/format";

type Adherence = CallReport["adherence_status"];

export type ReportItem = {
  id: string;
  sessionId: string | null;
  createdAt: string; // ISO (임의 오프셋)
  status: Adherence;
  summary: string;
  moodFlag: boolean;
  healthFlag: boolean;
  seniorName: string;
  title: string;
};

type View = "DAY" | "WEEK" | "MONTH";

const VIEWS: { key: View; label: string }[] = [
  { key: "DAY", label: "일별" },
  { key: "WEEK", label: "주별" },
  { key: "MONTH", label: "월별" },
];

// ── KST 달력 순수 헬퍼 (TZ 영향 없이 문자열 달력 연산) ──
const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** "YYYY-MM-DD" 정오 앵커 ISO — fmtDate/요일 계산에 안전하게 사용. */
function anchor(ymd: string): string {
  return `${ymd}T12:00:00+09:00`;
}

/** ymd → 요일 인덱스(0=월 … 6=일). */
function mondayIndex(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay(); // 0=일
  return (dow + 6) % 7;
}

function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

/** 그 주 월요일(YYYY-MM-DD). */
function weekStartYmd(ymd: string): string {
  return addDaysYmd(ymd, -mondayIndex(ymd));
}

function rate(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

/** 상태별 카운트 → 0이 아닌 것만 라벨 칩 배열. */
function statusChips(items: ReportItem[]) {
  return ADHERENCE_STATUSES.map((st) => ({
    status: st,
    label: adherenceStatusLabel[st],
    count: items.filter((i) => i.status === st).length,
  })).filter((c) => c.count > 0);
}

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

  // 날짜(KST) 오름/내림 정렬용 키를 미리 계산.
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
      {days.map(({ ymd, items }) => {
        const done = items.filter((i) => i.status === "DONE").length;
        // 피보호자별 그룹(한 줄 요약용)
        const bySenior = new Map<string, ReportItem[]>();
        for (const i of items) {
          const arr = bySenior.get(i.seniorName) ?? [];
          arr.push(i);
          bySenior.set(i.seniorName, arr);
        }
        return (
          <article
            key={ymd}
            className="flex flex-col gap-3 rounded-base border border-border bg-bg p-5 shadow-card"
          >
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="break-keep text-base font-bold">
                {fmtDate(anchor(ymd))} ({WEEKDAY_KO[(mondayIndex(ymd) + 1) % 7]})
              </h3>
              <span className="text-sm text-text-muted tabular-nums">
                총 {items.length}통 · 완료 {done}
              </span>
            </div>

            <StatusChips items={items} />

            {/* 피보호자별 상태 한 줄 */}
            <div className="flex flex-col gap-1">
              {[...bySenior.entries()].map(([name, list]) => (
                <div
                  key={name}
                  className="flex items-center gap-2 text-sm"
                >
                  <span className="break-keep font-medium">{name}</span>
                  <div className="flex flex-wrap gap-1">
                    {list.map((i) => (
                      <AdherenceStatusBadge key={i.id} status={i.status} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* 요약 나열 — 각 통화 상세로 링크 */}
            <div className="flex flex-col gap-2 border-t border-border pt-3">
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
          </article>
        );
      })}
    </div>
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
