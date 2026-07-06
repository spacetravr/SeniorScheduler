/**
 * 대시보드 (/app) — 오늘 일정 인스턴스, 최근 통화 결과 요약, 주간 이행률 (전부 mock).
 */
import Link from "next/link";
import { PageHeader } from "@/components/app/PageHeader";
import {
  SessionStatusBadge,
  AdherenceStatusBadge,
} from "@/components/app/StatusBadge";
import { fmtTime, fmtDate } from "@/components/app/format";
import { scheduleTypeLabel } from "@/lib/contracts/domain";
import {
  TODAY_LABEL,
  todaySessionIds,
  weeklyAdherence,
  callReports,
  sessionById,
  scheduleById,
  seniorById,
} from "@/lib/mock/data";

export default function DashboardPage() {
  const todaySessions = todaySessionIds
    .map((id) => sessionById(id))
    .filter((s): s is NonNullable<typeof s> => Boolean(s))
    .sort((a, b) => fmtTime(a.scheduled_at).localeCompare(fmtTime(b.scheduled_at)));

  const recentReports = callReports.slice(0, 3);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="대시보드" subtitle={TODAY_LABEL} />

      {/* 주간 이행률 */}
      <section className="rounded-base bg-surface p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-base font-semibold">이번 주 이행률</h2>
          <p className="text-sm text-text-muted">
            <span className="text-2xl font-bold text-primary">
              {weeklyAdherence.ratePercent}%
            </span>{" "}
            ({weeklyAdherence.done}/{weeklyAdherence.total}건)
          </p>
        </div>
        <div className="flex justify-between gap-2">
          {weeklyAdherence.byDay.map((d, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
              <span
                className={`flex h-9 w-full items-center justify-center rounded-base text-xs font-semibold ${
                  d.done ? "bg-primary text-bg" : "bg-bg text-text-muted"
                }`}
                aria-label={d.done ? "이행" : "미이행"}
              >
                {d.done ? "○" : "–"}
              </span>
              <span className="text-xs text-text-muted">{d.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 오늘의 일정 */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">오늘의 일정</h2>
          <Link href="/app/schedules" className="text-sm font-medium text-primary">
            전체 일정
          </Link>
        </div>
        <div className="flex flex-col gap-2">
          {todaySessions.map((s) => {
            const schedule = scheduleById(s.schedule_id);
            const senior = seniorById(s.senior_id);
            return (
              <div
                key={s.id}
                className="flex items-center gap-4 rounded-base border border-surface p-4"
              >
                <span className="w-14 shrink-0 text-lg font-bold tabular-nums">
                  {fmtTime(s.scheduled_at)}
                </span>
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="font-medium">{schedule?.title}</span>
                  <span className="text-sm text-text-muted">
                    {senior?.name} ·{" "}
                    {schedule ? scheduleTypeLabel[schedule.type] : "-"}
                  </span>
                </div>
                <SessionStatusBadge status={s.status} />
              </div>
            );
          })}
        </div>
      </section>

      {/* 최근 통화 결과 */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">최근 통화 결과</h2>
          <Link href="/app/reports" className="text-sm font-medium text-primary">
            전체 리포트
          </Link>
        </div>
        <div className="flex flex-col gap-2">
          {recentReports.map((r) => {
            const session = sessionById(r.session_id);
            const senior = session ? seniorById(session.senior_id) : undefined;
            const schedule = session
              ? scheduleById(session.schedule_id)
              : undefined;
            return (
              <Link
                key={r.id}
                href="/app/reports"
                className="flex flex-col gap-2 rounded-base border border-surface p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-text-muted">
                    {fmtDate(r.created_at)} · {senior?.name} ·{" "}
                    {schedule?.title}
                  </span>
                  <AdherenceStatusBadge status={r.adherence_status} />
                </div>
                <p className="line-clamp-2 text-sm leading-relaxed">
                  {r.summary}
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
