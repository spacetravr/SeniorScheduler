import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";
import {
  computeMetrics,
  eventKo,
  fmtKstDateLabel,
  fmtKstDateTime,
  pct,
  type ChannelRow,
  type CtaEvent,
  type Metrics,
  type WaitlistRow,
} from "./lib";

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
      <p className="mt-1 text-2xl font-semibold text-text">{value}</p>
      <p className="mt-1 text-xs text-text-muted">{sub}</p>
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
      {desc && <p className="mt-1 text-sm text-text-muted">{desc}</p>}
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
      <td className={`px-3 py-2 text-right ${base}`}>{r.view}</td>
      <td className={`px-3 py-2 text-right ${base}`}>{r.clickTry}</td>
      <td className="px-3 py-2 text-right text-text-muted">
        {pct(r.clickTry, r.view)}
      </td>
      <td className={`px-3 py-2 text-right ${base}`}>{r.submit}</td>
      <td className="px-3 py-2 text-right text-text-muted">
        {pct(r.submit, r.view)}
      </td>
    </tr>
  );
}

// ── 페이지 ────────────────────────────────────────────────────────────────────
export default async function AdminMetricsPage({
  searchParams,
}: {
  searchParams: { pw?: string };
}) {
  if (!isAuthed(searchParams.pw)) {
    return <PasswordGate />;
  }

  const m = await loadMetrics();
  const s = m.summary;

  return (
    <main className="mx-auto max-w-3xl p-4 sm:p-6">
      <header className="mb-6">
        <h1 className="text-xl font-semibold text-text">
          Senior Scheduler 수요 지표 대시보드
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          설문·링크로 유입된 방문자가 어디까지 반응했는지 보여 드립니다. 아래 숫자는
          테스트 유입(<span className="font-medium">test</span>)을 제외한 실제
          수요 데이터입니다.
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

      {/* 2. 퍼널 흐름 안내 */}
      <section className="mb-8 rounded-base border border-text-muted/15 bg-surface p-4">
        <h2 className="mb-2 text-base font-semibold text-text">
          방문자는 이렇게 3단계로 반응합니다
        </h2>
        <ol className="space-y-2 text-sm text-text-muted">
          <li>
            <span className="font-medium text-text">① 페이지 방문</span>{" "}
            <span className="text-xs">(랜딩 /)</span> — 랜딩에 도착해 서비스를 봤습니다.
            같은 브라우저는 새로고침해도 1회만 셉니다.
          </li>
          <li>
            <span className="font-medium text-text">② 사전등록 클릭</span>{" "}
            <span className="text-xs">([사전등록하기] → /preregister 진입)</span> —
            사전등록 페이지로 넘어갔다는 관심 신호입니다.
          </li>
          <li>
            <span className="font-medium text-text">③ 이메일 제출</span>{" "}
            <span className="text-xs">(/preregister에서 대기자 등록)</span> — 대기자로
            이메일을 남겼습니다. 가장 강한 수요 신호입니다.
          </li>
        </ol>
      </section>

      {/* 3. 채널별 퍼널 */}
      <section className="mb-8">
        <SectionTitle desc="어느 채널에서 온 방문자가 더 잘 반응했는지 비교합니다.">
          채널별 반응
        </SectionTitle>
        <div className="overflow-x-auto rounded-base border border-text-muted/20">
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
              {m.channels.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-6 text-center text-text-muted"
                    colSpan={6}
                  >
                    아직 수집된 방문이 없습니다.
                  </td>
                </tr>
              ) : (
                m.channels.map((r) => <ChannelTableRow key={r.source} r={r} />)
              )}
              {m.testChannel && (
                <ChannelTableRow r={m.testChannel} muted />
              )}
            </tbody>
          </table>
        </div>
        <ul className="mt-2 space-y-1 text-xs text-text-muted">
          <li>· 클릭률 = 사전등록 클릭(사전등록 페이지 진입) ÷ 방문. 전환율 = 이메일 제출 ÷ 방문.</li>
          <li>· utm_source가 없는 유입은 &quot;(직접)&quot;으로 표시됩니다.</li>
          <li>· &quot;테스트 유입&quot; 줄은 본인·팀 테스트(test)로, 위 합계·요약에서 제외됩니다.</li>
        </ul>
      </section>

      {/* 4. 일별 추이 */}
      <section className="mb-8">
        <SectionTitle desc="최근 7일간 하루별 반응 추이입니다 (KST 날짜 기준).">
          일별 추이
        </SectionTitle>
        <div className="overflow-x-auto rounded-base border border-text-muted/20">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-surface text-text-muted">
              <tr>
                <Th align="left">날짜</Th>
                <Th>방문</Th>
                <Th>사전등록 클릭</Th>
                <Th>제출</Th>
              </tr>
            </thead>
            <tbody>
              {m.days.map((d) => (
                <tr key={d.dateKey} className="border-t border-text-muted/10">
                  <td className="whitespace-nowrap px-3 py-2 text-text">
                    {fmtKstDateLabel(d.dateKey)}
                  </td>
                  <td className="px-3 py-2 text-right text-text">{d.view}</td>
                  <td className="px-3 py-2 text-right text-text">{d.click}</td>
                  <td className="px-3 py-2 text-right text-text">{d.submit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. 최근 활동 */}
      <section className="mb-8">
        <SectionTitle desc="가장 최근에 일어난 방문·클릭·제출 20건입니다.">
          최근 활동
        </SectionTitle>
        <div className="overflow-x-auto rounded-base border border-text-muted/20">
          <table className="w-full border-collapse text-sm">
            <thead className="bg-surface text-text-muted">
              <tr>
                <Th align="left">시각</Th>
                <Th align="left">활동</Th>
                <Th align="left">채널</Th>
              </tr>
            </thead>
            <tbody>
              {m.recent.length === 0 ? (
                <tr>
                  <td
                    className="px-3 py-6 text-center text-text-muted"
                    colSpan={3}
                  >
                    아직 활동이 없습니다.
                  </td>
                </tr>
              ) : (
                m.recent.map((e, i) => (
                  <tr key={i} className="border-t border-text-muted/10">
                    <td className="whitespace-nowrap px-3 py-2 text-text-muted">
                      {fmtKstDateTime(e.at)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-text">
                      {eventKo(e.type)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-text-muted">
                      {e.source}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. 대기자 현황 */}
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
                      {w.email}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-text-muted">
          개인정보 보호를 위해 이메일 일부만 표시합니다. 전체 명단·CSV 내보내기는{" "}
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
    </main>
  );
}
