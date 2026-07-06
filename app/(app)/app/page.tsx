/**
 * 대시보드 (/app)
 * - 오늘의 일정: getTodayCallInstances() 실데이터 (Phase 2).
 * - 주간 이행률 / 최근 통화 결과: mock 유지 (Phase 3~4에서 교체) → "예시 데이터" 라벨 표시.
 */
import Link from "next/link";
import { PageHeader } from "@/components/app/PageHeader";
import {
  SessionStatusBadge,
  AdherenceStatusBadge,
} from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { SampleBadge } from "@/components/app/SampleBadge";
import { fmtTime, fmtDate } from "@/components/app/format";
import { scheduleTypeLabel } from "@/lib/contracts/domain";
import { getTodayCallInstances, getSeniors } from "@/lib/db/queries";
import {
  weeklyAdherence,
  callReports,
  sessionById,
  scheduleById,
  seniorById,
} from "@/lib/mock/data";

export const dynamic = "force-dynamic";

/** "YYYY-MM-DD (요일)" KST 오늘 라벨 (표시 전용). */
function todayLabelKst(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(now);
  return parts;
}

export default async function DashboardPage() {
  const [instances, seniors] = await Promise.all([
    getTodayCallInstances(),
    getSeniors(),
  ]);

  const recentReports = callReports.slice(0, 3);
  const hasSeniors = seniors.length > 0;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="대시보드" subtitle={todayLabelKst()} />

      {!hasSeniors ? (
        <EmptyState
          icon="👋"
          title="안심 전화를 시작해 볼까요?"
          description="부모님을 등록하고 통화 동의를 완료한 뒤, 복약·병원 일정을 추가하면 예약한 시간에 자동으로 전화를 걸어드려요."
          action={{ href: "/app/seniors", label: "피보호자 등록하기" }}
        />
      ) : null}

      {/* 오늘의 일정 (실데이터) */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">오늘의 일정</h2>
          <Link href="/app/schedules" className="text-sm font-medium text-primary">
            전체 일정
          </Link>
        </div>
        {instances.length === 0 ? (
          <p className="rounded-base bg-surface p-5 text-sm text-text-muted">
            {hasSeniors
              ? "오늘 예정된 안내 전화가 없어요. 일정에서 발신을 켜면 여기에 표시됩니다."
              : "피보호자와 일정을 등록하면 오늘의 안내 전화가 여기에 표시됩니다."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {instances.map((inst) => (
              <div
                key={inst.schedule.id}
                className="flex items-center gap-4 rounded-base border border-surface p-4"
              >
                <span className="w-14 shrink-0 text-lg font-bold tabular-nums">
                  {fmtTime(inst.scheduled_at)}
                </span>
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="font-medium">{inst.schedule.title}</span>
                  <span className="text-sm text-text-muted">
                    {inst.senior.name} · {scheduleTypeLabel[inst.schedule.type]}
                  </span>
                </div>
                <SessionStatusBadge status="SCHEDULED" />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 주간 이행률 (mock) */}
      <section className="rounded-base bg-surface p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">이번 주 이행률</h2>
            <SampleBadge />
          </div>
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

      {/* 최근 통화 결과 (mock) */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">최근 통화 결과</h2>
            <SampleBadge />
          </div>
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
                    {fmtDate(r.created_at)} · {senior?.name} · {schedule?.title}
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
