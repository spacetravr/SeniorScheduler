/**
 * 통화 상세 (/app/calls/[id]) — 통화 턴 전사 타임라인 + 연결된 리포트 (실데이터).
 * 리포트가 있으면 하단에 MEDICAL_DISCLAIMER 고정 표시(가드레일 1).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Frown, Stethoscope } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import {
  SessionStatusBadge,
  AdherenceStatusBadge,
} from "@/components/app/StatusBadge";
import { fmtDateTime, fmtTime } from "@/components/app/format";
import {
  scheduleTypeLabel,
  adherenceStatusLabel,
  MEDICAL_DISCLAIMER,
} from "@/lib/contracts/domain";
import {
  getCallSessionDetail,
  getSeniors,
  getSchedules,
} from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function CallDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const detail = await getCallSessionDetail(params.id);
  if (!detail) notFound();

  const { session, turns, report } = detail;
  const [seniors, schedules] = await Promise.all([
    getSeniors(),
    getSchedules(),
  ]);

  const senior = seniors.find((s) => s.id === session.senior_id);
  const schedule =
    session.schedule_id != null
      ? schedules.find((s) => s.id === session.schedule_id)
      : undefined;

  const isConsent = session.purpose === "CONSENT";
  const seniorLabel = senior?.name ?? "부모님";
  const title = isConsent
    ? "동의 확인 전화"
    : schedule?.title ?? "안내 전화";
  const meta = isConsent
    ? "동의 확인"
    : schedule
      ? scheduleTypeLabel[schedule.type]
      : "-";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4">
        <Link
          href="/app/calls"
          className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden strokeWidth={2} />
          통화 기록
        </Link>
        <PageHeader
          title={title}
          subtitle={`${seniorLabel} · ${meta}`}
        />
      </div>

      {/* 리포트 — 이 통화의 핵심. 최상단으로 승격 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">이 통화의 리포트</h2>
        {report ? (
          <div className="flex flex-col gap-4 rounded-base border border-border bg-bg p-5 shadow-card">
            {/* 일정 수행 여부를 크게 */}
            <div className="flex flex-col gap-2">
              <span className="break-keep text-sm text-text-muted">일정 수행 여부</span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-2xl font-bold text-primary">
                  {adherenceStatusLabel[report.adherence_status]}
                </span>
                <AdherenceStatusBadge status={report.adherence_status} />
              </div>
            </div>

            {/* 요약 문단 */}
            <p className="break-keep text-base leading-relaxed">{report.summary}</p>

            {/* 기분/건강 플래그 */}
            {report.mood_flag || report.health_flag ? (
              <div className="flex flex-wrap gap-2 text-xs">
                {report.mood_flag ? (
                  <span className="inline-flex items-center gap-1 rounded-base bg-surface px-2.5 py-1.5 font-medium text-accent">
                    <Frown className="h-3.5 w-3.5" aria-hidden strokeWidth={2} />
                    기분 살핌
                  </span>
                ) : null}
                {report.health_flag ? (
                  <span className="inline-flex items-center gap-1 rounded-base bg-surface px-2.5 py-1.5 font-medium text-accent">
                    <Stethoscope className="h-3.5 w-3.5" aria-hidden strokeWidth={2} />
                    건강 신호
                  </span>
                ) : null}
              </div>
            ) : null}

            <p className="break-keep border-t border-border pt-3 text-xs leading-relaxed text-text-muted">
              {MEDICAL_DISCLAIMER}
            </p>
          </div>
        ) : (
          <p className="break-keep rounded-base bg-surface p-5 text-sm text-text-muted">
            아직 생성된 리포트가 없습니다.
          </p>
        )}
      </section>

      {/* 통화 메타 — 예정 시각·상태·시도 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">통화 정보</h2>
        <dl className="flex flex-col gap-2 rounded-base border border-border bg-bg p-5 shadow-card text-sm">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-text-muted">예정 시각</dt>
            <dd className="break-keep font-medium tabular-nums">
              {fmtDateTime(session.scheduled_at)}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-text-muted">통화 상태</dt>
            <dd>
              <SessionStatusBadge status={session.status} />
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-text-muted">시도 횟수</dt>
            <dd className="font-medium tabular-nums">{session.attempt}회</dd>
          </div>
        </dl>
      </section>

      {/* 전사 타임라인 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">통화 전사</h2>
        {turns.length === 0 ? (
          <p className="break-keep rounded-base bg-surface p-5 text-sm text-text-muted">
            통화가 이루어지지 않아 전사 내용이 없습니다.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {turns.map((t) => {
              const isSystem = t.role === "SYSTEM";
              const isDtmf = t.input_kind === "DTMF";
              return (
                <div
                  key={t.id}
                  className={`flex flex-col gap-1 ${
                    isSystem ? "items-start" : "items-end"
                  }`}
                >
                  <span className="break-keep px-1 text-xs text-text-muted">
                    {isSystem ? "안내" : seniorLabel} ·{" "}
                    {isDtmf ? "버튼 입력" : ""}
                    {isDtmf ? " · " : ""}
                    {fmtTime(t.created_at)}
                  </span>
                  <p
                    className={`max-w-[85%] break-keep rounded-base px-4 py-2.5 text-sm leading-relaxed ${
                      isSystem ? "bg-surface text-text" : "bg-primary text-bg"
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
    </div>
  );
}
