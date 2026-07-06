import { cookies } from "next/headers";
import { getAdminClient } from "@/lib/supabase/admin";
import type { CtaEventType } from "@/lib/contracts/cta";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIRECT = "(direct)";

type Row = {
  source: string;
  view: number;
  click: number; // CLICK_SUBSCRIBE + CLICK_TRY
  submit: number; // WAITLIST_SUBMIT
};

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
      <h1 className="mb-4 text-lg font-semibold text-text">지표 열람</h1>
      <form method="GET" className="flex flex-col gap-3">
        <input
          type="password"
          name="pw"
          placeholder="비밀번호"
          autoComplete="off"
          className="rounded-base border border-text-muted/30 bg-surface px-3 py-2 text-text"
        />
        <button
          type="submit"
          className="rounded-base bg-primary px-3 py-2 text-bg"
        >
          확인
        </button>
      </form>
    </main>
  );
}

async function loadFunnel(): Promise<Row[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("cta_events")
    .select("type, utm_source");

  if (error) {
    throw new Error(`cta_events 조회 실패: ${error.code}`);
  }

  const bySource = new Map<string, Row>();
  for (const ev of (data ?? []) as { type: CtaEventType; utm_source: string | null }[]) {
    const source = ev.utm_source ?? DIRECT;
    let row = bySource.get(source);
    if (!row) {
      row = { source, view: 0, click: 0, submit: 0 };
      bySource.set(source, row);
    }
    if (ev.type === "VIEW") row.view += 1;
    else if (ev.type === "CLICK_SUBSCRIBE" || ev.type === "CLICK_TRY") row.click += 1;
    else if (ev.type === "WAITLIST_SUBMIT") row.submit += 1;
  }

  // 정렬은 view 내림차순.
  return [...bySource.values()].sort((a, b) => b.view - a.view);
}

function pct(n: number, d: number): string {
  if (d <= 0) return "-";
  return `${Math.round((n / d) * 100)}%`;
}

export default async function AdminMetricsPage({
  searchParams,
}: {
  searchParams: { pw?: string };
}) {
  if (!isAuthed(searchParams.pw)) {
    return <PasswordGate />;
  }

  const rows = await loadFunnel();
  const total = rows.reduce(
    (acc, r) => ({
      view: acc.view + r.view,
      click: acc.click + r.click,
      submit: acc.submit + r.submit,
    }),
    { view: 0, click: 0, submit: 0 },
  );

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-1 text-lg font-semibold text-text">CTA 퍼널</h1>
      <p className="mb-4 text-sm text-text-muted">
        utm_source별 VIEW → CLICK(구독+베타) → WAITLIST_SUBMIT
      </p>

      <div className="overflow-x-auto rounded-base border border-text-muted/20">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-surface text-text-muted">
            <tr>
              <th className="px-3 py-2 text-left font-medium">utm_source</th>
              <th className="px-3 py-2 text-right font-medium">VIEW</th>
              <th className="px-3 py-2 text-right font-medium">CLICK</th>
              <th className="px-3 py-2 text-right font-medium">CTR</th>
              <th className="px-3 py-2 text-right font-medium">SUBMIT</th>
              <th className="px-3 py-2 text-right font-medium">CVR</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-center text-text-muted" colSpan={6}>
                  아직 수집된 이벤트가 없습니다.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.source} className="border-t border-text-muted/10">
                  <td className="px-3 py-2 text-text">{r.source}</td>
                  <td className="px-3 py-2 text-right text-text">{r.view}</td>
                  <td className="px-3 py-2 text-right text-text">{r.click}</td>
                  <td className="px-3 py-2 text-right text-text-muted">
                    {pct(r.click, r.view)}
                  </td>
                  <td className="px-3 py-2 text-right text-text">{r.submit}</td>
                  <td className="px-3 py-2 text-right text-text-muted">
                    {pct(r.submit, r.view)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot className="border-t border-text-muted/20 bg-surface font-medium text-text">
              <tr>
                <td className="px-3 py-2">합계</td>
                <td className="px-3 py-2 text-right">{total.view}</td>
                <td className="px-3 py-2 text-right">{total.click}</td>
                <td className="px-3 py-2 text-right text-text-muted">
                  {pct(total.click, total.view)}
                </td>
                <td className="px-3 py-2 text-right">{total.submit}</td>
                <td className="px-3 py-2 text-right text-text-muted">
                  {pct(total.submit, total.view)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </main>
  );
}
