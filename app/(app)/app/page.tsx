/**
 * 대시보드 (/app)
 * - 오늘의 일정: getTodayCallInstances() 실데이터.
 * - 주간 이행률 / 최근 통화 결과: getRecentReports() 실데이터. 0건이면 안내 문구(빈 상태) 유지.
 */
import Link from "next/link";
import { PageHeader } from "@/components/app/PageHeader";
import {
  SessionStatusBadge,
  AdherenceStatusBadge,
} from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { fmtTime, fmtDate } from "@/components/app/format";
import { scheduleTypeLabel } from "@/lib/contracts/domain";
import { getConsentStatus } from "@/components/app/consent";
import {
  getTodayCallInstances,
  getSeniors,
  getSchedules,
  getCallSessions,
  getRecentReports,
} from "@/lib/db/queries";

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

/** KST 기준 오늘 날짜 "YYYY-MM-DD". */
function todayYmdKst(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** 달력 날짜(YYYY-MM-DD)에 delta일을 더한 날짜 문자열 (TZ 무관, 순수 달력 연산). */
function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;
/** 달력 날짜의 요일 한글 라벨 (정오 앵커로 TZ 영향 제거). */
function weekdayLabelKo(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return WEEKDAY_KO[new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay()];
}

export default async function DashboardPage() {
  const [instances, seniors, schedules, sessions, reports] = await Promise.all([
    getTodayCallInstances(),
    getSeniors(),
    getSchedules(),
    getCallSessions(),
    getRecentReports(),
  ]);

  const hasSeniors = seniors.length > 0;
  const hasReports = reports.length > 0;

  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const seniorName = new Map(seniors.map((s) => [s.id, s.name]));
  const scheduleById = new Map(schedules.map((s) => [s.id, s]));

  // 본인 동의(동의 콜) 대기 중인 피보호자 — 대리동의는 됐으나 본인 동의가 아직인 경우
  const awaitingSelfConsent = seniors.filter(
    (s) => getConsentStatus(s) === "SELF_PENDING",
  );

  // 최근 7일(오늘 포함) 이행률 집계 — 리포트 created_at(KST 오프셋)의 날짜 부분으로 그룹핑.
  const todayYmd = todayYmdKst(new Date());
  const weekDays = Array.from({ length: 7 }, (_, i) => addDaysYmd(todayYmd, i - 6));
  const reportsByDay = new Map<string, typeof reports>();
  for (const r of reports) {
    const ymd = r.created_at.slice(0, 10);
    const arr = reportsByDay.get(ymd) ?? [];
    arr.push(r);
    reportsByDay.set(ymd, arr);
  }
  const weekReports = weekDays.flatMap((ymd) => reportsByDay.get(ymd) ?? []);
  const weekDone = weekReports.filter((r) => r.adherence_status === "DONE").length;
  const weekTotal = weekReports.length;
  const weekRate = weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : 0;
  const byDay = weekDays.map((ymd) => {
    const dayReports = reportsByDay.get(ymd) ?? [];
    return {
      label: weekdayLabelKo(ymd),
      hasReport: dayReports.length > 0,
      done: dayReports.some((r) => r.adherence_status === "DONE"),
    };
  });

  const recentReports = reports.slice(0, 3);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="대시보드" subtitle={todayLabelKst()} />

      {awaitingSelfConsent.length > 0 ? (
        <div className="flex flex-col gap-1 rounded-base border border-primary bg-surface px-4 py-3">
          <p className="break-keep text-sm font-semibold text-primary">
            {awaitingSelfConsent.length === 1
              ? `${awaitingSelfConsent[0].name}님의 동의 콜이 준비 중입니다`
              : `${awaitingSelfConsent[0].name}님 외 ${awaitingSelfConsent.length - 1}명의 동의 콜이 준비 중입니다`}
          </p>
          <p className="break-keep text-xs leading-relaxed text-text-muted">
            첫 통화에서 부모님께 직접 동의를 여쭙습니다. 부모님이 동의하시면 일정
            전화가 시작됩니다.
          </p>
        </div>
      ) : null}

      {!hasSeniors ? (
        <EmptyState
          icon="👋"
          title="Senior Scheduler를 시작해 볼까요?"
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
          <p className="break-keep rounded-base bg-surface p-5 text-sm text-text-muted">
            {hasSeniors
              ? "오늘 예정된 안내 전화가 없어요. 일정에서 발신을 켜면 여기에 표시됩니다."
              : "피보호자와 일정을 등록하면 오늘의 안내 전화가 여기에 표시됩니다."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {instances.map((inst) => (
              <Link
                key={inst.schedule.id}
                href="/app/schedules"
                className="flex items-center gap-4 rounded-base border border-surface p-4 transition-colors hover:border-primary"
              >
                <span className="w-14 shrink-0 text-lg font-bold tabular-nums">
                  {fmtTime(inst.scheduled_at)}
                </span>
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="break-keep font-medium">{inst.schedule.title}</span>
                  <span className="break-keep text-sm text-text-muted">
                    {inst.senior.name} · {scheduleTypeLabel[inst.schedule.type]}
                  </span>
                </div>
                <SessionStatusBadge status="SCHEDULED" />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* 주간 이행률 (실데이터) */}
      <section className="rounded-base bg-surface p-5">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-base font-semibold">이번 주 이행률</h2>
          {hasReports ? (
            <p className="text-sm text-text-muted">
              <span className="text-2xl font-bold text-primary">{weekRate}%</span>{" "}
              ({weekDone}/{weekTotal}건)
            </p>
          ) : null}
        </div>
        {hasReports ? (
          <div className="flex justify-between gap-2">
            {byDay.map((d, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <span
                  className={`flex h-9 w-full items-center justify-center rounded-base text-xs font-semibold ${
                    d.done
                      ? "bg-primary text-bg"
                      : "bg-bg text-text-muted"
                  }`}
                  aria-label={
                    !d.hasReport ? "기록 없음" : d.done ? "이행" : "미이행"
                  }
                >
                  {d.done ? "○" : "–"}
                </span>
                <span className="text-xs text-text-muted">{d.label}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="break-keep text-sm leading-relaxed text-text-muted">
            아직 통화 기록이 없습니다. 발신이 시작되면 주간 이행률이 여기에
            표시됩니다.
          </p>
        )}
      </section>

      {/* 최근 통화 결과 (실데이터) */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">최근 통화 결과</h2>
        {hasReports ? (
          <>
            <div className="flex flex-col gap-2">
              {recentReports.map((r) => {
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
                    className="flex flex-col gap-2 rounded-base border border-surface p-4 transition-colors hover:border-primary"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="break-keep text-sm text-text-muted">
                        {fmtDate(r.created_at)}
                        {name ? ` · ${name}` : ""} · {title}
                      </span>
                      <AdherenceStatusBadge status={r.adherence_status} />
                    </div>
                    <p className="line-clamp-2 break-keep text-sm leading-relaxed">
                      {r.summary}
                    </p>
                  </Link>
                );
              })}
            </div>
            <Link
              href="/app/reports"
              className="text-sm font-medium text-primary"
            >
              전체 리포트
            </Link>
          </>
        ) : (
          <p className="break-keep rounded-base bg-surface p-5 text-sm text-text-muted">
            아직 통화 기록이 없습니다. 발신이 시작되면 최근 통화 결과가 여기에
            표시됩니다.
          </p>
        )}
      </section>
    </div>
  );
}
