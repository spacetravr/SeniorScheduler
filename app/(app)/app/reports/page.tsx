/**
 * 리포트 (/app/reports) — adherence 뱃지 + 3줄 요약 + mood/health 플래그 (실데이터).
 * 하단에 MEDICAL_DISCLAIMER 고정 표시(가드레일 1).
 */
import Link from "next/link";
import { ClipboardList, Frown, Stethoscope } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { AdherenceStatusBadge } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { fmtDate } from "@/components/app/format";
import { MEDICAL_DISCLAIMER } from "@/lib/contracts/domain";
import { getRecentReports, getCallSessions, getSeniors, getSchedules } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [reports, sessions, seniors, schedules] = await Promise.all([
    getRecentReports(),
    getCallSessions(),
    getSeniors(),
    getSchedules(),
  ]);

  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const seniorName = new Map(seniors.map((s) => [s.id, s.name]));
  const scheduleById = new Map(schedules.map((s) => [s.id, s]));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="리포트"
        subtitle="통화 결과 요약과 이행 상태입니다."
      />

      {reports.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="아직 통화 리포트가 없습니다"
          description="통화가 완료되면 이행 상태와 요약 리포트가 여기에 표시됩니다."
        />
      ) : (
        <section className="flex flex-col gap-2">
          {reports.map((r) => {
            const session = sessionById.get(r.session_id);
            const name = session ? seniorName.get(session.senior_id) : undefined;
            const schedule =
              session && session.schedule_id != null
                ? scheduleById.get(session.schedule_id)
                : undefined;
            const isConsent = session?.purpose === "CONSENT";
            const title = isConsent
              ? "동의 확인 전화"
              : schedule?.title ?? "안내 전화";
            return (
              <Link
                key={r.id}
                href={session ? `/app/calls/${session.id}` : "/app/calls"}
                className="flex flex-col gap-2 rounded-base border border-border bg-bg p-4 shadow-card transition-colors hover:border-primary"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="break-keep text-sm text-text-muted">
                    {fmtDate(r.created_at)}
                    {name ? ` · ${name}` : ""} · {title}
                  </span>
                  <AdherenceStatusBadge status={r.adherence_status} />
                </div>
                <p className="line-clamp-3 break-keep text-sm leading-relaxed">
                  {r.summary}
                </p>
                {r.mood_flag || r.health_flag ? (
                  <div className="flex gap-2 text-xs">
                    {r.mood_flag ? (
                      <span className="inline-flex items-center gap-1 rounded-base bg-surface px-2 py-1 font-medium text-accent">
                        <Frown className="h-3.5 w-3.5" aria-hidden strokeWidth={2} />
                        기분 살핌
                      </span>
                    ) : null}
                    {r.health_flag ? (
                      <span className="inline-flex items-center gap-1 rounded-base bg-surface px-2 py-1 font-medium text-accent">
                        <Stethoscope className="h-3.5 w-3.5" aria-hidden strokeWidth={2} />
                        건강 신호
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </Link>
            );
          })}
        </section>
      )}

      {/* 가드레일 1: 리포트 하단 고정 고지 문구 */}
      <p className="break-keep rounded-base bg-surface p-4 text-xs leading-relaxed text-text-muted">
        {MEDICAL_DISCLAIMER}
      </p>
    </div>
  );
}
