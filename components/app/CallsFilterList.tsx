"use client";

/**
 * 통화 기록 리스트 + 피보호자 필터 칩 (클라이언트).
 * - 상단 필터 칩([전체] + 피보호자별): 선택 시 해당 피보호자 통화만 표시. 활성 칩은 구분색.
 * - 오늘(KST) 섹션 강조 + 이전 날짜별(KST) 그룹 구조 유지, 필터 적용.
 * - 각 통화 항목에 피보호자 구분색 점(dot) 표시.
 * 색·라운드는 토큰만 사용 (senior-N 구분 토큰 포함).
 */
import { useState } from "react";
import Link from "next/link";
import { SessionStatusBadge } from "@/components/app/StatusBadge";
import { fmtTime, kstYmd } from "@/components/app/format";
import {
  scheduleTypeLabel,
  type CallSession,
  type Schedule,
} from "@/lib/contracts/domain";

/** 피보호자 구분색 클래스 (index % 3). Tailwind 스캔용 리터럴. */
const SENIOR_COLOR = [
  { dot: "bg-senior-1", chip: "bg-senior-1 text-bg" },
  { dot: "bg-senior-2", chip: "bg-senior-2 text-bg" },
  { dot: "bg-senior-3", chip: "bg-senior-3 text-bg" },
] as const;

type SeniorLite = { id: string; name: string };

function todayYmdKst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function ymdHeaderLabel(ymd: string): string {
  const anchor = new Date(`${ymd}T12:00:00+09:00`);
  const md = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "long",
    day: "numeric",
  }).format(anchor);
  const wd = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(anchor);
  return `${md} (${wd})`;
}

export function CallsFilterList({
  sessions,
  seniors,
  schedules,
}: {
  sessions: CallSession[];
  seniors: SeniorLite[];
  schedules: Schedule[];
}) {
  const [selected, setSelected] = useState<string>("ALL");

  const seniorName = new Map(seniors.map((s) => [s.id, s.name]));
  const scheduleById = new Map(schedules.map((s) => [s.id, s]));
  // 피보호자 순서 기반 구분색 index (대시보드와 동일 규칙).
  const colorIndexById = new Map(seniors.map((s, i) => [s.id, i % 3]));

  const visible =
    selected === "ALL"
      ? sessions
      : sessions.filter((s) => s.senior_id === selected);

  const todayYmd = todayYmdKst();
  const byDay = new Map<string, CallSession[]>();
  for (const s of visible) {
    const ymd = kstYmd(s.scheduled_at);
    const arr = byDay.get(ymd) ?? [];
    arr.push(s);
    byDay.set(ymd, arr);
  }
  const todaySessions = byDay.get(todayYmd) ?? [];
  const pastDays = [...byDay.keys()]
    .filter((ymd) => ymd !== todayYmd)
    .sort((a, b) => b.localeCompare(a));

  function renderItem(s: CallSession) {
    const schedule = s.schedule_id != null ? scheduleById.get(s.schedule_id) : undefined;
    const isConsent = s.purpose === "CONSENT";
    const name = seniorName.get(s.senior_id) ?? "부모님";
    const title = isConsent ? "동의 확인 전화" : schedule?.title ?? "안내 전화";
    const meta = isConsent
      ? "동의 확인"
      : schedule
        ? scheduleTypeLabel[schedule.type]
        : "-";
    const ci = colorIndexById.get(s.senior_id) ?? 0;
    return (
      <Link
        key={s.id}
        href={`/app/calls/${s.id}`}
        className="flex items-center gap-4 rounded-base border border-border bg-bg p-4 shadow-card transition-colors hover:border-primary"
      >
        <span className="w-14 shrink-0 text-lg font-bold tabular-nums">
          {fmtTime(s.scheduled_at)}
        </span>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="break-keep font-medium">{title}</span>
          <span className="flex items-center gap-1.5 break-keep text-sm text-text-muted">
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${SENIOR_COLOR[ci].dot}`}
              aria-hidden
            />
            {name} · {meta}
          </span>
        </div>
        <SessionStatusBadge status={s.status} />
      </Link>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 피보호자 필터 칩 */}
      <div
        className="-mx-1 flex flex-wrap gap-2 px-1"
        role="group"
        aria-label="피보호자 필터"
      >
        <button
          type="button"
          onClick={() => setSelected("ALL")}
          aria-pressed={selected === "ALL"}
          className={`rounded-base px-3.5 py-2 text-sm font-medium transition-colors ${
            selected === "ALL"
              ? "bg-primary text-bg"
              : "bg-surface text-text-muted"
          }`}
        >
          전체
        </button>
        {seniors.map((s, i) => {
          const on = selected === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setSelected(s.id)}
              aria-pressed={on}
              className={`flex items-center gap-1.5 rounded-base px-3.5 py-2 text-sm font-medium transition-colors ${
                on ? SENIOR_COLOR[i % 3].chip : "bg-surface text-text-muted"
              }`}
            >
              {!on ? (
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${SENIOR_COLOR[i % 3].dot}`}
                  aria-hidden
                />
              ) : null}
              {s.name}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <p className="break-keep rounded-base border border-border bg-bg px-4 py-8 text-center text-sm text-text-muted">
          해당 피보호자의 통화 기록이 없습니다.
        </p>
      ) : (
        <div className="flex flex-col gap-8">
          {todaySessions.length > 0 ? (
            <section className="flex flex-col gap-3">
              <div className="flex items-baseline gap-2">
                <h2 className="text-base font-semibold text-primary">오늘</h2>
                <span className="text-sm text-text-muted tabular-nums">
                  {todaySessions.length}통
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {todaySessions.map(renderItem)}
              </div>
            </section>
          ) : null}

          {pastDays.map((ymd) => {
            const items = byDay.get(ymd) ?? [];
            return (
              <section key={ymd} className="flex flex-col gap-3">
                <div className="flex items-baseline gap-2">
                  <h2 className="break-keep text-base font-semibold">
                    {ymdHeaderLabel(ymd)}
                  </h2>
                  <span className="text-sm text-text-muted tabular-nums">
                    {items.length}통
                  </span>
                </div>
                <div className="flex flex-col gap-2">{items.map(renderItem)}</div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
