// 일일 지표 리포트 생성 스크립트 (Node 20, 외부 의존성 없음 · 내장 fetch 사용).
//
// Supabase REST에서 cta_events / waitlist를 읽어 KST 기준으로 집계하고,
// 마크다운 리포트를 stdout과 파일(REPORT_OUT, 기본 daily-report.md)로 출력한다.
// 읽기 전용(GET)만 수행. PII(waitlist.email)는 조회하지도 출력하지도 않는다.
//
// 집계 정의는 app/admin/metrics/lib.ts(/admin/metrics 대시보드)와 일치:
//   퍼널 3단계 VIEW(방문) → CLICK_TRY(사전등록 클릭) → WAITLIST_SUBMIT(이메일 제출)
//   utm_source='test'는 전 집계 제외 · CLICK_SUBSCRIBE(레거시)·미상 타입은 무시
//   utm_source가 비면 "(직접)"으로 표기
//   모든 날짜 경계는 KST(UTC+9)

import { writeFileSync } from "node:fs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY;
const REPORT_OUT = process.env.REPORT_OUT || "daily-report.md";

if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  console.error("[daily-report] SUPABASE_URL / SUPABASE_SECRET_KEY 환경변수가 필요합니다.");
  process.exit(1);
}

const DIRECT = "(직접)"; // app/admin/metrics/lib.ts 라벨과 통일
const TEST_SOURCE = "test";
const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // 한국은 DST 없음 → 고정 +9h

/** utm_source 정규화 후 test 유입 판별. */
function isTest(utmSource) {
  return String(utmSource ?? "").trim().toLowerCase() === TEST_SOURCE;
}

/** utm_source → 표기 라벨. 비어 있으면 "(직접)". */
function sourceLabel(utmSource) {
  const s = String(utmSource ?? "").trim();
  return s === "" ? DIRECT : s;
}

/** 집계 대상 타입만 통과(레거시 CLICK_SUBSCRIBE·미상은 배제). */
function isCountedType(type) {
  return type === "VIEW" || type === "CLICK_TRY" || type === "WAITLIST_SUBMIT";
}

/** ISO 시각 → KST 날짜 키 "yyyy-MM-dd". */
function kstDateKey(iso) {
  const shifted = new Date(new Date(iso).getTime() + KST_OFFSET_MS);
  return shifted.toISOString().slice(0, 10);
}

/** 오늘(now) 기준 KST "어제" 날짜 키. */
function yesterdayKstKey(now = new Date()) {
  const shifted = new Date(now.getTime() + KST_OFFSET_MS - 86_400_000);
  return shifted.toISOString().slice(0, 10);
}

/** 전환율(%) 문자열. 분모 0이면 "-". */
function pct(n, d) {
  if (d <= 0) return "-";
  return `${Math.round((n / d) * 100)}%`;
}

async function supaGet(path) {
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      apikey: SUPABASE_SECRET_KEY,
      Authorization: `Bearer ${SUPABASE_SECRET_KEY}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase GET ${path} 실패: ${res.status} ${res.statusText} ${text}`);
  }
  return res.json();
}

/** 채널별 퍼널 누산기 헬퍼. */
function emptyFunnel() {
  return { view: 0, clickTry: 0, submit: 0 };
}
function addToFunnel(f, type) {
  if (type === "VIEW") f.view += 1;
  else if (type === "CLICK_TRY") f.clickTry += 1;
  else if (type === "WAITLIST_SUBMIT") f.submit += 1;
}

function buildReport(events, waitlist, now = new Date()) {
  const yKey = yesterdayKstKey(now);

  // 집계 대상 타입 + test 제외.
  const counted = events.filter((e) => isCountedType(e.type) && !isTest(e.utm_source));

  // 누적/어제 전체 퍼널.
  const cumAll = emptyFunnel();
  const ydAll = emptyFunnel();
  // 채널별(누적 + 어제).
  const bySourceCum = new Map();
  const bySourceYd = new Map();

  for (const e of counted) {
    const isYesterday = kstDateKey(e.created_at) === yKey;
    addToFunnel(cumAll, e.type);
    if (isYesterday) addToFunnel(ydAll, e.type);

    const key = sourceLabel(e.utm_source);
    if (!bySourceCum.has(key)) bySourceCum.set(key, emptyFunnel());
    addToFunnel(bySourceCum.get(key), e.type);
    if (isYesterday) {
      if (!bySourceYd.has(key)) bySourceYd.set(key, emptyFunnel());
      addToFunnel(bySourceYd.get(key), e.type);
    }
  }

  // waitlist 총 등록 수(test 제외). email은 조회하지 않으므로 utm_source 기준만 사용.
  const waitlistTotal = waitlist.filter((w) => !isTest(w.utm_source)).length;

  // 채널 정렬: 누적 방문 내림차순.
  const channels = [...bySourceCum.entries()].sort((a, b) => b[1].view - a[1].view);

  const lines = [];
  lines.push(`# 📊 일일 지표 리포트 ${yKey} (KST)`);
  lines.push("");
  lines.push(`> 집계 기준: KST(UTC+9) · utm_source='test' 제외 · 생성 시각(UTC) ${now.toISOString()}`);
  lines.push("");

  // ① 어제 하루.
  lines.push(`## ① 어제 하루 (${yKey})`);
  lines.push("");
  lines.push("| 지표 | 값 |");
  lines.push("| --- | ---: |");
  lines.push(`| 방문 (VIEW) | ${ydAll.view} |`);
  lines.push(`| 사전등록 클릭 (CLICK_TRY) | ${ydAll.clickTry} |`);
  lines.push(`| 이메일 제출 (WAITLIST_SUBMIT) | ${ydAll.submit} |`);
  lines.push(`| 전환율 (방문→제출) | ${pct(ydAll.submit, ydAll.view)} |`);
  lines.push("");

  // ② 누적.
  lines.push("## ② 누적 (전체 기간)");
  lines.push("");
  lines.push("| 지표 | 값 |");
  lines.push("| --- | ---: |");
  lines.push(`| 방문 (VIEW) | ${cumAll.view} |`);
  lines.push(`| 사전등록 클릭 (CLICK_TRY) | ${cumAll.clickTry} |`);
  lines.push(`| 이메일 제출 (WAITLIST_SUBMIT) | ${cumAll.submit} |`);
  lines.push(`| 전환율 (방문→제출) | ${pct(cumAll.submit, cumAll.view)} |`);
  lines.push(`| waitlist 총 등록 수 | ${waitlistTotal} |`);
  lines.push("");

  // ③ 채널별(utm_source). 누적 기준, 괄호 안은 어제 발생분.
  lines.push("## ③ 채널별 (utm_source) — 누적 (괄호: 어제)");
  lines.push("");
  lines.push("| 채널 | 방문 | 클릭 | 제출 | 전환율(방문→제출) |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  if (channels.length === 0) {
    lines.push("| _(데이터 없음)_ | 0 | 0 | 0 | - |");
  } else {
    for (const [source, cum] of channels) {
      const yd = bySourceYd.get(source) || emptyFunnel();
      lines.push(
        `| ${source} | ${cum.view} (${yd.view}) | ${cum.clickTry} (${yd.clickTry}) | ${cum.submit} (${yd.submit}) | ${pct(cum.submit, cum.view)} |`,
      );
    }
  }
  lines.push("");

  // ④ 판단 기준선.
  lines.push("## ④ 판단 기준선");
  lines.push("");
  lines.push("- 방문→제출 전환율 **5% 이상** = 수요 신호 / **1% 이하** = 메시지 재점검 (PROGRESS.md 기준)");
  lines.push("");

  return { title: `📊 일일 지표 리포트 ${yKey} (KST)`, markdown: lines.join("\n") };
}

async function main() {
  const [events, waitlist] = await Promise.all([
    supaGet("cta_events?select=type,utm_source,created_at&order=created_at.asc&limit=10000"),
    // email(PII)은 절대 select 하지 않는다.
    supaGet("waitlist?select=created_at,utm_source&order=created_at.asc&limit=10000"),
  ]);

  const { title, markdown } = buildReport(events, waitlist);

  writeFileSync(REPORT_OUT, markdown, "utf8");
  // 워크플로의 다음 단계(issue 생성)가 제목을 쓸 수 있게 GITHUB_OUTPUT에도 남긴다.
  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(process.env.GITHUB_OUTPUT, `title=${title}\n`, { flag: "a" });
  }
  console.log(markdown);
}

main().catch((err) => {
  console.error("[daily-report] 실패:", err);
  process.exit(1);
});
