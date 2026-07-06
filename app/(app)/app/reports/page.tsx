/**
 * 리포트 (/app/reports) — adherence 뱃지 + 3줄 요약 + mood/health 플래그.
 * 하단에 MEDICAL_DISCLAIMER 고정 표시(가드레일 1).
 */
import Link from "next/link";
import { PageHeader } from "@/components/app/PageHeader";
import { AdherenceStatusBadge } from "@/components/app/StatusBadge";
import { fmtDate } from "@/components/app/format";
import { MEDICAL_DISCLAIMER } from "@/lib/contracts/domain";
import {
  callReports,
  sessionById,
  scheduleById,
  seniorById,
} from "@/lib/mock/data";

export default function ReportsPage() {
  const sorted = [...callReports].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="리포트"
        subtitle="통화 결과 요약과 이행 상태입니다."
      />

      <section className="flex flex-col gap-2">
        {sorted.map((r) => {
          const session = sessionById(r.session_id);
          const senior = session ? seniorById(session.senior_id) : undefined;
          const schedule = session
            ? scheduleById(session.schedule_id)
            : undefined;
          return (
            <Link
              key={r.id}
              href={session ? `/app/calls/${session.id}` : "/app/calls"}
              className="flex flex-col gap-2 rounded-base border border-surface p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-text-muted">
                  {fmtDate(r.created_at)} · {senior?.name} · {schedule?.title}
                </span>
                <AdherenceStatusBadge status={r.adherence_status} />
              </div>
              <p className="line-clamp-3 text-sm leading-relaxed">
                {r.summary}
              </p>
              {r.mood_flag || r.health_flag ? (
                <div className="flex gap-2 text-xs">
                  {r.mood_flag ? (
                    <span className="inline-flex items-center gap-1 rounded-base bg-surface px-2 py-1 font-medium text-accent">
                      🙁 기분 살핌
                    </span>
                  ) : null}
                  {r.health_flag ? (
                    <span className="inline-flex items-center gap-1 rounded-base bg-surface px-2 py-1 font-medium text-accent">
                      🩺 건강 신호
                    </span>
                  ) : null}
                </div>
              ) : null}
            </Link>
          );
        })}
      </section>

      {/* 가드레일 1: 리포트 하단 고정 고지 문구 */}
      <p className="rounded-base bg-surface p-4 text-xs leading-relaxed text-text-muted">
        {MEDICAL_DISCLAIMER}
      </p>
    </div>
  );
}
