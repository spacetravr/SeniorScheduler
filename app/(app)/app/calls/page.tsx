/**
 * 통화 기록 (/app/calls) — 리스트. 비용(cost_krw)은 표시하지 않는다.
 * 항목 클릭 시 상세(/app/calls/[id]).
 */
import Link from "next/link";
import { PageHeader } from "@/components/app/PageHeader";
import { SessionStatusBadge } from "@/components/app/StatusBadge";
import { SampleBadge } from "@/components/app/SampleBadge";
import { fmtDateTime } from "@/components/app/format";
import { scheduleTypeLabel } from "@/lib/contracts/domain";
import { callSessions, scheduleById, seniorById } from "@/lib/mock/data";

export default function CallsPage() {
  const sorted = [...callSessions].sort((a, b) =>
    b.scheduled_at.localeCompare(a.scheduled_at),
  );

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="통화 기록"
        subtitle="부모님께 발신한 안내 전화 기록입니다."
        action={<SampleBadge />}
      />

      <section className="flex flex-col gap-2">
        {sorted.map((s) => {
          const schedule = scheduleById(s.schedule_id);
          const senior = seniorById(s.senior_id);
          return (
            <Link
              key={s.id}
              href={`/app/calls/${s.id}`}
              className="flex items-center gap-4 rounded-base border border-surface p-4"
            >
              <div className="flex flex-1 flex-col gap-0.5">
                <span className="font-medium">{schedule?.title}</span>
                <span className="text-sm text-text-muted">
                  {fmtDateTime(s.scheduled_at)} · {senior?.name} ·{" "}
                  {schedule ? scheduleTypeLabel[schedule.type] : "-"}
                </span>
              </div>
              <SessionStatusBadge status={s.status} />
            </Link>
          );
        })}
      </section>
    </div>
  );
}
