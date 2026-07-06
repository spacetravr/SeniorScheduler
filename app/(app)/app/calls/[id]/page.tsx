/**
 * 통화 상세 (/app/calls/[id]) — 통화 턴 전사 타임라인 + 연결된 리포트.
 * 리포트가 있으면 하단에 MEDICAL_DISCLAIMER 고정 표시(가드레일 1).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/PageHeader";
import {
  SessionStatusBadge,
  AdherenceStatusBadge,
} from "@/components/app/StatusBadge";
import { fmtDateTime, fmtTime } from "@/components/app/format";
import { scheduleTypeLabel, MEDICAL_DISCLAIMER } from "@/lib/contracts/domain";
import {
  callSessions,
  sessionById,
  scheduleById,
  seniorById,
  turnsBySession,
  reportBySession,
} from "@/lib/mock/data";

export function generateStaticParams() {
  return callSessions.map((s) => ({ id: s.id }));
}

export default function CallDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = sessionById(params.id);
  if (!session) notFound();

  const schedule = scheduleById(session.schedule_id);
  const senior = seniorById(session.senior_id);
  const turns = turnsBySession(session.id);
  const report = reportBySession(session.id);

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link href="/app/calls" className="text-sm font-medium text-primary">
          ← 통화 기록
        </Link>
        <PageHeader
          title={schedule?.title ?? "통화 상세"}
          subtitle={`${fmtDateTime(session.scheduled_at)} · ${senior?.name ?? "-"} · ${
            schedule ? scheduleTypeLabel[schedule.type] : "-"
          }`}
          action={<SessionStatusBadge status={session.status} />}
        />
      </div>

      {/* 전사 타임라인 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">통화 전사</h2>
        {turns.length === 0 ? (
          <p className="rounded-base bg-surface p-5 text-sm text-text-muted">
            통화가 이루어지지 않아 전사 내용이 없습니다.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {turns.map((t) => {
              const isSystem = t.role === "SYSTEM";
              return (
                <div
                  key={t.id}
                  className={`flex flex-col gap-1 ${
                    isSystem ? "items-start" : "items-end"
                  }`}
                >
                  <span className="px-1 text-xs text-text-muted">
                    {isSystem ? "안내" : senior?.name ?? "부모님"} ·{" "}
                    {fmtTime(t.created_at)}
                  </span>
                  <p
                    className={`max-w-[85%] rounded-base px-4 py-2.5 text-sm leading-relaxed ${
                      isSystem
                        ? "bg-surface text-text"
                        : "bg-primary text-bg"
                    }`}
                  >
                    {t.text}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 연결된 리포트 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">통화 리포트</h2>
        {report ? (
          <div className="flex flex-col gap-3 rounded-base border border-surface p-5">
            <div className="flex items-center justify-between gap-3">
              <AdherenceStatusBadge status={report.adherence_status} />
              <div className="flex gap-2 text-xs">
                {report.mood_flag ? (
                  <span className="inline-flex items-center gap-1 rounded-base bg-surface px-2 py-1 font-medium text-accent">
                    🙁 기분 살핌
                  </span>
                ) : null}
                {report.health_flag ? (
                  <span className="inline-flex items-center gap-1 rounded-base bg-surface px-2 py-1 font-medium text-accent">
                    🩺 건강 신호
                  </span>
                ) : null}
              </div>
            </div>
            <p className="text-sm leading-relaxed">{report.summary}</p>
            <p className="border-t border-surface pt-3 text-xs leading-relaxed text-text-muted">
              {MEDICAL_DISCLAIMER}
            </p>
          </div>
        ) : (
          <p className="rounded-base bg-surface p-5 text-sm text-text-muted">
            아직 생성된 리포트가 없습니다.
          </p>
        )}
      </section>
    </div>
  );
}
