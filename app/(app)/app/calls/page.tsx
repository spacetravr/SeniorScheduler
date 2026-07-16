/**
 * 통화 기록 (/app/calls) — 리스트 (실데이터). 비용(cost_krw)은 표시하지 않는다.
 * 오늘(KST) 통화를 최상단 "오늘" 섹션으로 강조하고, 이전 기록은 날짜별(KST)로 묶는다.
 * 항목 클릭 시 상세(/app/calls/[id]).
 */
import Link from "next/link";
import { Phone } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { SessionStatusBadge } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { fmtTime, kstYmd } from "@/components/app/format";
import { scheduleTypeLabel, type CallSession } from "@/lib/contracts/domain";
import { getCallSessions, getSeniors, getSchedules } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/** KST 기준 오늘 날짜 "YYYY-MM-DD". */
function todayYmdKst(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** "YYYY-MM-DD" → KST "7월 16일 (수)" (정오 앵커로 TZ 영향 제거). */
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

export default async function CallsPage() {
  const [sessions, seniors, schedules] = await Promise.all([
    getCallSessions(),
    getSeniors(),
    getSchedules(),
  ]);

  const seniorName = new Map(seniors.map((s) => [s.id, s.name]));
  const scheduleById = new Map(schedules.map((s) => [s.id, s]));

  // 예정 시각(KST 달력일)로 그룹핑. getCallSessions 는 이미 최신순 정렬.
  const todayYmd = todayYmdKst();
  const byDay = new Map<string, CallSession[]>();
  for (const s of sessions) {
    const ymd = kstYmd(s.scheduled_at);
    const arr = byDay.get(ymd) ?? [];
    arr.push(s);
    byDay.set(ymd, arr);
  }
  const todaySessions = byDay.get(todayYmd) ?? [];
  const pastDays = [...byDay.keys()]
    .filter((ymd) => ymd !== todayYmd)
    .sort((a, b) => b.localeCompare(a)); // 최신 날짜부터

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
          <span className="break-keep text-sm text-text-muted">
            {name} · {meta}
          </span>
        </div>
        <SessionStatusBadge status={s.status} />
      </Link>
    );
  }

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
        <div className="flex flex-col gap-8">
          {/* 오늘 섹션 강조 */}
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

          {/* 이전 날짜별 그룹 */}
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
