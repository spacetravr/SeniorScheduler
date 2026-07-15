/**
 * 통화 기록 (/app/calls) — 리스트 (실데이터). 비용(cost_krw)은 표시하지 않는다.
 * 항목 클릭 시 상세(/app/calls/[id]).
 */
import Link from "next/link";
import { Phone } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { SessionStatusBadge } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { fmtDateTime } from "@/components/app/format";
import { scheduleTypeLabel } from "@/lib/contracts/domain";
import { getCallSessions, getSeniors, getSchedules } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function CallsPage() {
  const [sessions, seniors, schedules] = await Promise.all([
    getCallSessions(),
    getSeniors(),
    getSchedules(),
  ]);

  const seniorName = new Map(seniors.map((s) => [s.id, s.name]));
  const scheduleById = new Map(schedules.map((s) => [s.id, s]));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="통화 기록"
        subtitle="부모님께 발신한 안내 전화 기록입니다."
      />

      {sessions.length === 0 ? (
        <EmptyState
          icon={Phone}
          title="아직 통화 기록이 없습니다"
          description="발신이 시작되면 부모님께 걸린 안내 전화가 여기에 표시됩니다."
        />
      ) : (
        <section className="flex flex-col gap-2">
          {sessions.map((s) => {
            const schedule =
              s.schedule_id != null ? scheduleById.get(s.schedule_id) : undefined;
            const isConsent = s.purpose === "CONSENT";
            const name = seniorName.get(s.senior_id) ?? "부모님";
            const title = isConsent
              ? "동의 확인 전화"
              : schedule?.title ?? "안내 전화";
            const meta = isConsent
              ? "동의 확인"
              : schedule
                ? scheduleTypeLabel[schedule.type]
                : "-";
            return (
              <Link
                key={s.id}
                href={`/app/calls/${s.id}`}
                className="flex items-center gap-4 rounded-base border border-border bg-bg p-4 shadow-card transition-colors hover:border-primary"
              >
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="break-keep font-medium">{title}</span>
                  <span className="break-keep text-sm text-text-muted">
                    {fmtDateTime(s.scheduled_at)} · {name} · {meta}
                  </span>
                </div>
                <SessionStatusBadge status={s.status} />
              </Link>
            );
          })}
        </section>
      )}
    </div>
  );
}
