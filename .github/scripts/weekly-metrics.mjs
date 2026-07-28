// 주간 마케팅 퍼널 리포트 생성 스크립트 (Node 20, 외부 의존성 없음 · 내장 fetch 사용).
//
// Supabase REST에서 cta_events / waitlist를 읽어 KST 기준으로 집계하고,
// "최근 7일 vs 직전 7일" 채널별 퍼널을 마크다운으로 stdout(및 REPORT_OUT 파일)에 출력한다.
//
// 원칙 (daily-report.mjs 와 동일 — 집계 정의를 일부러 일치시킨다):
//   - 읽기 전용(GET)만 수행. **쓰기 없음.**
//   - PII 미조회·미출력 (waitlist.email 은 select 하지 않는다)
//   - utm_source='test' 는 전 집계 제외 / CLICK_SUBSCRIBE(레거시)·미상 타입 무시
//   - utm_source 가 비면 "(직접)"
//   - 모든 날짜 경계는 KST(UTC+9, 한국은 DST 없음)
//   - **추정·보정 없음.** 표본이 적으면 적다고 표시할 뿐, 숫자를 만들어내지 않는다.
//
// 사용: SUPABASE_URL=... SUPABASE_SECRET_KEY=... node .github/scripts/weekly-metrics.mjs

import { writeFileSync } from "node:fs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const REPORT_OUT = process.env.REPORT_OUT || "weekly-metrics.md";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("[weekly-metrics] SUPABASE_URL / SUPABASE_SECRET_KEY 환경변수가 필요합니다.");
  process.exit(1);
}

const DIRECT = "(직접)";
const TEST_SOURCE = "test";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 86_400_000;

/** MARKETING-PLAN §1 합의 기준선 — 판정 문구의 단일 소스. */
const SIGNAL_HIGH = 5; // 제출/방문 5%↑ = 수요 신호
const SIGNAL_LOW = 1; // 1%↓ = 메시지 재점검
const MIN_SAMPLE = 30; // 채널당 VIEW 30 미만이면 판정 보류(MARKETING-PLAN "채널당 30~50 모인 뒤 비교")

const isTest = (s) => String(s ?? "").trim().toLowerCase() === TEST_SOURCE;
const sourceLabel = (s) => (String(s ?? "").trim() === "" ? DIRECT : String(s).trim());
const isCountedType = (t) => t === "VIEW" || t === "CLICK_TRY" || t === "WAITLIST_SUBMIT";

/** ISO → KST 날짜 키 "yyyy-MM-dd". */
function kstDateKey(iso) {
  return new Date(new Date(iso).getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 전환율(%) 숫자. 분모 0이면 null. */
function rate(n, d) {
  return d > 0 ? (n / d) * 100 : null;
}

/** 전환율 표기. null 이면 "-". */
function pct(n, d) {
  const r = rate(n, d);
  return r === null ? "-" : `${Math.round(r)}%`;
}

/** 증감 표기. 이전이 0이면 배수 계산이 무의미하므로 절대 증감만. */
function delta(cur, prev) {
  const d = cur - prev;
  if (d === 0) return "→ 0";
  return d > 0 ? `▲ +${d}` : `▼ ${d}`;
}

async function supaGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: "GET",
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase GET ${path} 실패: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/**
 * 기간 경계 — 최근 7일(어제까지) / 직전 7일. 오늘(진행 중인 날)은 제외해
 * 부분 집계가 추세를 왜곡하지 않게 한다.
 */
function windows(now = new Date()) {
  const todayKst = new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
  const keyBefore = (n) =>
    new Date(new Date(`${todayKst}T00:00:00Z`).getTime() - n * DAY_MS).toISOString().slice(0, 10);
  return {
    todayKst,
    curStart: keyBefore(7), // 최근 7일: [today-7, today-1]
    curEnd: keyBefore(1),
    prevStart: keyBefore(14), // 직전 7일: [today-14, today-8]
    prevEnd: keyBefore(8),
  };
}

const inRange = (key, start, end) => key >= start && key <= end;

/** 이벤트 배열 → {VIEW, CLICK_TRY, WAITLIST_SUBMIT} 카운트. */
function countFunnel(events) {
  const c = { VIEW: 0, CLICK_TRY: 0, WAITLIST_SUBMIT: 0 };
  for (const e of events) if (isCountedType(e.type)) c[e.type] += 1;
  return c;
}

/** 채널별 집계 맵 — Map<label, {VIEW, CLICK_TRY, WAITLIST_SUBMIT}>. */
function byChannel(events) {
  const m = new Map();
  for (const e of events) {
    if (!isCountedType(e.type)) continue;
    const k = sourceLabel(e.utm_source);
    const c = m.get(k) ?? { VIEW: 0, CLICK_TRY: 0, WAITLIST_SUBMIT: 0 };
    c[e.type] += 1;
    m.set(k, c);
  }
  return m;
}

/** 채널 판정 — 표본이 모자라면 판정하지 않는다(억지 결론 금지). */
function verdict(c) {
  if (c.VIEW < MIN_SAMPLE) return `표본 부족 (VIEW ${c.VIEW}/${MIN_SAMPLE})`;
  const r = rate(c.WAITLIST_SUBMIT, c.VIEW);
  if (r === null) return "-";
  if (r >= SIGNAL_HIGH) return "수요 신호";
  if (r < SIGNAL_LOW) return "메시지 재점검";
  return "관찰 계속";
}

function buildReport(events, waitlist, now = new Date()) {
  const live = events.filter((e) => !isTest(e.utm_source));
  const w = windows(now);

  const cur = live.filter((e) => inRange(kstDateKey(e.created_at), w.curStart, w.curEnd));
  const prev = live.filter((e) => inRange(kstDateKey(e.created_at), w.prevStart, w.prevEnd));

  const curF = countFunnel(cur);
  const prevF = countFunnel(prev);

  const curCh = byChannel(cur);
  const prevCh = byChannel(prev);

  const waitlistLive = waitlist.filter((x) => !isTest(x.utm_source));
  const waitlistCur = waitlistLive.filter((x) =>
    inRange(kstDateKey(x.created_at), w.curStart, w.curEnd),
  ).length;

  const title = `주간 마케팅 퍼널 리포트 (${w.curStart} ~ ${w.curEnd} KST)`;
  const lines = [];
  lines.push(`# ${title}`);
  lines.push("");
  lines.push(
    `> 최근 7일(${w.curStart}~${w.curEnd}) vs 직전 7일(${w.prevStart}~${w.prevEnd}). ` +
      `오늘(${w.todayKst})은 진행 중이라 제외. utm_source='test' 제외. 실데이터만.`,
  );
  lines.push("");

  lines.push("## 1. 전체 퍼널");
  lines.push("");
  lines.push("| 단계 | 최근 7일 | 직전 7일 | 증감 |");
  lines.push("|---|---:|---:|---:|");
  lines.push(`| 방문(VIEW) | ${curF.VIEW} | ${prevF.VIEW} | ${delta(curF.VIEW, prevF.VIEW)} |`);
  lines.push(
    `| 사전등록 클릭(CLICK_TRY) | ${curF.CLICK_TRY} | ${prevF.CLICK_TRY} | ${delta(curF.CLICK_TRY, prevF.CLICK_TRY)} |`,
  );
  lines.push(
    `| 이메일 제출(WAITLIST_SUBMIT) | ${curF.WAITLIST_SUBMIT} | ${prevF.WAITLIST_SUBMIT} | ${delta(curF.WAITLIST_SUBMIT, prevF.WAITLIST_SUBMIT)} |`,
  );
  lines.push("");
  lines.push("| 전환율 | 최근 7일 | 직전 7일 |");
  lines.push("|---|---:|---:|");
  lines.push(
    `| 방문→클릭 | ${pct(curF.CLICK_TRY, curF.VIEW)} | ${pct(prevF.CLICK_TRY, prevF.VIEW)} |`,
  );
  lines.push(
    `| 클릭→제출 | ${pct(curF.WAITLIST_SUBMIT, curF.CLICK_TRY)} | ${pct(prevF.WAITLIST_SUBMIT, prevF.CLICK_TRY)} |`,
  );
  lines.push(
    `| **방문→제출** | **${pct(curF.WAITLIST_SUBMIT, curF.VIEW)}** | ${pct(prevF.WAITLIST_SUBMIT, prevF.VIEW)} |`,
  );
  lines.push("");
  lines.push(
    `판정 기준(MARKETING-PLAN §1): 방문→제출 **${SIGNAL_HIGH}%↑ = 수요 신호** / **${SIGNAL_LOW}%↓ = 메시지 재점검**. ` +
      `채널당 VIEW ${MIN_SAMPLE} 미만은 판정 보류.`,
  );
  lines.push("");

  lines.push("## 2. 채널별 (최근 7일)");
  lines.push("");
  const labels = [...new Set([...curCh.keys(), ...prevCh.keys()])].sort(
    (a, b) => (curCh.get(b)?.VIEW ?? 0) - (curCh.get(a)?.VIEW ?? 0),
  );
  if (labels.length === 0) {
    lines.push("_최근 7일 유입 없음._");
  } else {
    lines.push("| 채널(utm_source) | 방문 | 클릭 | 제출 | 방문→제출 | 직전 7일 방문 | 판정 |");
    lines.push("|---|---:|---:|---:|---:|---:|---|");
    for (const l of labels) {
      const c = curCh.get(l) ?? { VIEW: 0, CLICK_TRY: 0, WAITLIST_SUBMIT: 0 };
      const p = prevCh.get(l) ?? { VIEW: 0, CLICK_TRY: 0, WAITLIST_SUBMIT: 0 };
      lines.push(
        `| ${l} | ${c.VIEW} | ${c.CLICK_TRY} | ${c.WAITLIST_SUBMIT} | ${pct(c.WAITLIST_SUBMIT, c.VIEW)} | ${p.VIEW} | ${verdict(c)} |`,
      );
    }
  }
  lines.push("");

  lines.push("## 3. 대기자");
  lines.push("");
  lines.push("| 항목 | 값 |");
  lines.push("|---|---:|");
  lines.push(`| 최근 7일 신규 등록 | ${waitlistCur} |`);
  lines.push(`| 누적 등록 | ${waitlistLive.length} |`);
  lines.push("");
  lines.push("_이메일 주소는 조회하지 않습니다(PII 미수집 원칙)._");
  lines.push("");

  return { title, markdown: lines.join("\n") };
}

async function main() {
  const [events, waitlist] = await Promise.all([
    supaGet("cta_events?select=type,utm_source,created_at&order=created_at.asc&limit=20000"),
    supaGet("waitlist?select=created_at,utm_source&order=created_at.asc&limit=20000"),
  ]);

  const { markdown } = buildReport(events, waitlist);
  writeFileSync(REPORT_OUT, markdown, "utf8");
  console.log(markdown);
}

main().catch((err) => {
  console.error(`[weekly-metrics] 실패: ${err.message}`);
  process.exit(1);
});
