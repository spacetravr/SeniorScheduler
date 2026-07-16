import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  computeMetrics,
  fmtKstDateTime,
  pct,
  type ChannelRow,
  type CtaEvent,
  type Metrics,
  type WaitlistRow,
} from "./lib";
import {
  demoMetrics,
  demoWaitlist,
  type ChannelDatum,
  type DemoWaitlistItem,
  type MetricsView,
} from "./demo-data";
import { ChannelBarChart, FunnelChart } from "./charts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_TABLE_EDITOR_URL =
  "https://supabase.com/dashboard/project/hcygbbbbzfpgucqkmxav/editor";

// ── 비밀번호 게이트 ───────────────────────────────────────────────────────────
function isAuthed(pwParam: string | undefined): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  if (pwParam && pwParam === expected) return true;
  const cookiePw = cookies().get("admin_pw")?.value;
  return cookiePw === expected;
}

function PasswordGate() {
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="mb-1 text-lg font-semibold text-text">수요 지표 열람</h1>
      <p className="mb-4 text-sm text-text-muted">
        운영자 비밀번호를 입력하시면 채널별 반응과 전환율을 보실 수 있습니다.
      </p>
      <form method="GET" className="flex flex-col gap-3">
        <input
          type="password"
          name="pw"
          placeholder="비밀번호"
          autoComplete="off"
          className="rounded-base border border-text-muted/30 bg-surface px-3 py-2 text-text"
        />
        <button type="submit" className="rounded-base bg-primary px-3 py-2 text-bg">
          확인
        </button>
      </form>
    </main>
  );
}

/** 이메일 마스킹 — 로컬파트 앞 1~3자만 남기고 ***. 화면 노출 최소화(원본은 DB에만). */
function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const keep = at <= 2 ? 1 : Math.min(3, at - 1);
  return `${email.slice(0, keep)}***${email.slice(at)}`;
}

// ── 데이터 로드 ───────────────────────────────────────────────────────────────
async function loadMetrics(): Promise<Metrics> {
  const supabase = getAdminClient();

  const [eventsRes, waitlistRes] = await Promise.all([
    supabase
      .from("cta_events")
      .select("type, session_uuid, utm_source, created_at"),
    supabase.from("waitlist").select("email, utm_source, created_at"),
  ]);

  if (eventsRes.error) {
    throw new Error(`cta_events 조회 실패: ${eventsRes.error.code}`);
  }
  if (waitlistRes.error) {
    throw new Error(`waitlist 조회 실패: ${waitlistRes.error.code}`);
  }

  return computeMetrics(
    (eventsRes.data ?? []) as CtaEvent[],
    (waitlistRes.data ?? []) as WaitlistRow[],
  );
}

/** 실집계 Metrics → 그래프 공용 뷰모델. (데모는 demo-data가 이미 이 형태) */
function toView(m: Metrics): MetricsView {
  return {
    summary: {
      visitors: m.summary.visitors,
      clickTry: m.summary.clickTry,
      waitlist: m.summary.waitlist,
    },
    channels: m.channels as ChannelDatum[],
  };
}

// ── 프레젠테이션 조각 ─────────────────────────────────────────────────────────
function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-base border border-text-muted/15 bg-surface p-4">
      <p className="text-sm text-text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-text tabular-nums">{value}</p>
      <p className="mt-1 text-xs text-text-muted break-keep">{sub}</p>
    </div>
  );
}

function SectionTitle({
  children,
  desc,
}: {
  children: React.ReactNode;
  desc?: string;
}) {
  return (
    <div className="mb-3">
      <h2 className="text-base font-semibold text-text">{children}</h2>
      {desc && <p className="mt-1 text-sm text-text-muted break-keep">{desc}</p>}
    </div>
  );
}

function Th({
  children,
  align = "right",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={`whitespace-nowrap px-3 py-2 font-medium ${
        align === "left" ? "text-left" : "text-right"
      }`}
    >
      {children}
    </th>
  );
}

function ChannelTableRow({ r, muted }: { r: ChannelRow; muted?: boolean }) {
  const base = muted ? "text-text-muted" : "text-text";
  return (
    <tr className="border-t border-text-muted/10">
      <td className={`whitespace-nowrap px-3 py-2 ${base}`}>
        {muted ? "테스트 유입 (집계 제외)" : r.source}
      </td>
      <td className={`px-3 py-2 text-right tabular-nums ${base}`}>{r.view}</td>
      <td className={`px-3 py-2 text-right tabular-nums ${base}`}>{r.clickTry}</td>
      <td className="px-3 py-2 text-right tabular-nums text-text-muted">
        {pct(r.clickTry, r.view)}
      </td>
      <td className={`px-3 py-2 text-right tabular-nums ${base}`}>{r.submit}</td>
      <td className="px-3 py-2 text-right tabular-nums text-text-muted">
        {pct(r.submit, r.view)}
      </td>
    </tr>
  );
}

function DemoWaitlistRow({ w }: { w: DemoWaitlistItem }) {
  return (
    <tr className="border-t border-text-muted/10">
      <td className="whitespace-nowrap px-3 py-2 text-text-muted">{w.dateLabel}</td>
      <td className="whitespace-nowrap px-3 py-2 text-text-muted">{w.channel}</td>
      <td className="whitespace-nowrap px-3 py-2 text-text">{w.maskedEmail}</td>
    </tr>
  );
}

// ── 페이지 ────────────────────────────────────────────────────────────────────
export default async function AdminMetricsPage({
  searchParams,
}: {
  searchParams: { pw?: string; demo?: string };
}) {
  if (!isAuthed(searchParams.pw)) {
    return <PasswordGate />;
  }

  const isDemo = searchParams.demo === "1";

  // 실데이터는 지금과 동일하게 DB 집계. 데모 모드만 샘플 데이터로 교체.
  const m: Metrics | null = isDemo ? null : await loadMetrics();
  const view: MetricsView = isDemo ? demoMetrics : toView(m!);
  const s = view.summary;

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-semibold text-text break-keep">
            Senior Scheduler 수요 지표 대시보드
          </h1>
          {isDemo && (
            <span className="rounded-base bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
              Simulation · 가상 지표
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-text-muted break-keep">
          {isDemo ? (
            <>
              설문·링크로 유입된 방문자가 어디까지 반응했는지 보여 드립니다.
              Scenario: 런칭 초기 단계 가상 시뮬레이션 지표입니다.
            </>
          ) : (
            <>
              설문·링크로 유입된 방문자가 어디까지 반응했는지 보여 드립니다. 아래
              숫자는 테스트 유입(<span className="font-medium">test</span>)을
              제외한 실제 수요 데이터입니다.
            </>
          )}
        </p>
      </header>

      {/* 1. 요약 카드 */}
      <section className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard
          label="고유 방문자"
          value={`${s.visitors}명`}
          sub="랜딩(/)을 본 서로 다른 방문자 수"
        />
        <SummaryCard
          label="사전등록 클릭"
          value={`${s.clickTry}회`}
          sub={`사전등록 페이지 진입 · 클릭률 ${pct(s.clickTry, s.visitors)}`}
        />
        <SummaryCard
          label="대기자"
          value={`${s.waitlist}명`}
          sub="이메일을 남긴 사람 수"
        />
        <SummaryCard
          label="전체 전환율"
          value={pct(s.waitlist, s.visitors)}
          sub="방문자 중 이메일까지 남긴 비율"
        />
      </section>

      {/* 2. 퍼널 그래프 */}
      <section className="mb-8">
        <SectionTitle desc="방문 대비 각 단계까지 남은 비율을 막대 길이로 보여 드립니다.">
          퍼널 요약
        </SectionTitle>
        <div className="rounded-base border border-text-muted/15 bg-surface p-4">
          <FunnelChart summary={s} />
          <p className="mt-3 text-xs text-text-muted break-keep">
            방문 → 사전등록 클릭(/preregister 진입) → 이메일 제출 순의 3단계 반응
            흐름입니다. 막대 길이는 방문 수를 100%로 본 상대 비율입니다.
          </p>
        </div>
      </section>

      {/* 3. 채널별 가로 막대 차트 */}
      <section className="mb-8">
        <SectionTitle desc="어느 채널에서 온 방문자가 더 많이·잘 반응했는지 방문 수 기준으로 비교합니다.">
          채널별 반응
        </SectionTitle>
        <div className="rounded-base border border-text-muted/15 bg-surface p-4">
          <ChannelBarChart channels={view.channels} />
        </div>

        {/* 채널 상세 표(차트 아래 보조) */}
        <details className="mt-4 rounded-base border border-text-muted/20">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-text">
            채널별 상세 수치 표 열기
          </summary>
          <div className="overflow-x-auto border-t border-text-muted/15">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-surface text-text-muted">
                <tr>
                  <Th align="left">유입 채널</Th>
                  <Th>방문</Th>
                  <Th>사전등록 클릭</Th>
                  <Th>클릭률</Th>
                  <Th>이메일 제출</Th>
                  <Th>전환율</Th>
                </tr>
              </thead>
              <tbody>
                {view.channels.length === 0 ? (
                  <tr>
                    <td
                      className="px-3 py-6 text-center text-text-muted"
                      colSpan={6}
                    >
                      아직 수집된 방문이 없습니다.
                    </td>
                  </tr>
                ) : (
                  view.channels.map((r) => (
                    <ChannelTableRow key={r.source} r={r} />
                  ))
                )}
                {m?.testChannel && <ChannelTableRow r={m.testChannel} muted />}
              </tbody>
            </table>
          </div>
        </details>

        <ul className="mt-2 space-y-1 text-xs text-text-muted break-keep">
          <li>· 클릭률 = 사전등록 클릭(사전등록 페이지 진입) ÷ 방문. 전환율 = 이메일 제출 ÷ 방문.</li>
          <li>· utm_source가 없는 유입은 &quot;(직접)&quot;으로 표시됩니다.</li>
          <li>· &quot;테스트 유입&quot; 줄은 본인·팀 테스트(test)로, 위 합계·요약에서 제외됩니다.</li>
        </ul>
      </section>

      {/* 4. 대기자 현황 (실데이터 모드에서만) */}
      {!isDemo && m && (
        <section className="mb-4">
          <SectionTitle desc={`이메일을 남긴 대기자 총 ${m.waitlistTotal}명입니다.`}>
            대기자 현황
          </SectionTitle>
          <div className="overflow-x-auto rounded-base border border-text-muted/20">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-surface text-text-muted">
                <tr>
                  <Th align="left">시각</Th>
                  <Th align="left">채널</Th>
                  <Th align="left">이메일</Th>
                </tr>
              </thead>
              <tbody>
                {m.waitlistRecent.length === 0 ? (
                  <tr>
                    <td
                      className="px-3 py-6 text-center text-text-muted"
                      colSpan={3}
                    >
                      아직 대기자가 없습니다.
                    </td>
                  </tr>
                ) : (
                  m.waitlistRecent.map((w, i) => (
                    <tr key={i} className="border-t border-text-muted/10">
                      <td className="whitespace-nowrap px-3 py-2 text-text-muted">
                        {fmtKstDateTime(w.at)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-text-muted">
                        {w.source}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-text">
                        {maskEmail(w.email)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-text-muted break-keep">
            개인정보 보호법 준수를 위해 이메일 뒤 영역은 마스킹 처리되어
            표시됩니다. 전체 명단·CSV 내보내기는{" "}
            <a
              href={SUPABASE_TABLE_EDITOR_URL}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline"
            >
              Supabase Table Editor
            </a>
            에서 확인하실 수 있습니다.
          </p>
        </section>
      )}

      {/* 4-데모. 대기자 현황 (데모 모드에서만, 마스킹 샘플 목록) */}
      {isDemo && (
        <section className="mb-4">
          <SectionTitle
            desc={`이메일을 남긴 대기자 총 ${demoWaitlist.length}명입니다. 최근 20명을 표시합니다.`}
          >
            대기자 현황
          </SectionTitle>
          <div className="overflow-x-auto rounded-base border border-text-muted/20">
            <table className="w-full border-collapse text-sm">
              <thead className="bg-surface text-text-muted">
                <tr>
                  <Th align="left">등록일</Th>
                  <Th align="left">채널</Th>
                  <Th align="left">이메일</Th>
                </tr>
              </thead>
              <tbody>
                {demoWaitlist.slice(0, 20).map((w, i) => (
                  <DemoWaitlistRow key={i} w={w} />
                ))}
              </tbody>
            </table>
          </div>

          {demoWaitlist.length > 20 && (
            <details className="mt-3 rounded-base border border-text-muted/20">
              <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-text">
                전체 {demoWaitlist.length}명 보기 (외 {demoWaitlist.length - 20}명)
              </summary>
              <div className="overflow-x-auto border-t border-text-muted/15">
                <table className="w-full border-collapse text-sm">
                  <tbody>
                    {demoWaitlist.slice(20).map((w, i) => (
                      <DemoWaitlistRow key={i} w={w} />
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

          <p className="mt-2 text-xs text-text-muted break-keep">
            개인정보 보호법 준수를 위해 이메일 뒤 영역은 마스킹 처리되어
            표시됩니다.
          </p>
        </section>
      )}

      {/* 데모 각주 */}
      {isDemo && (
        <p className="mt-6 rounded-base border border-accent/20 bg-accent/5 p-3 text-xs text-text-muted break-keep">
          본 화면은 비즈니스 데모 및 UI/UX 검증을 위한 Sandbox Simulation
          Mode입니다. 표시된 지표는 가상 시나리오 데이터입니다.
        </p>
      )}
    </main>
  );
}
