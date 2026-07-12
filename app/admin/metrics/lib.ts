import { formatInTimeZone } from "date-fns-tz";
import type { CtaEventType } from "@/lib/contracts/cta";

/**
 * /admin/metrics 전용 집계·포맷 유틸.
 * - 모든 날짜/시각은 KST(Asia/Seoul) 고정. 로컬 타임존 의존 금지.
 * - utm_source=test 유입은 본 집계에서 제외(별도 표시)하기 위한 판별 포함.
 *
 * 퍼널(2페이지 구조):
 *   ① 방문(VIEW) → ② 사전등록 클릭(CLICK_TRY, /preregister 진입) → ③ 이메일 제출(WAITLIST_SUBMIT)
 * CLICK_SUBSCRIBE는 UI에서 제거되어 더 이상 발생하지 않는다. 과거 데이터가 남아 있어도
 * 집계에서 무시한다(계약 enum은 유지). 알 수 없는 타입도 방어적으로 무시한다.
 */

export const KST = "Asia/Seoul";
export const DIRECT = "(직접)";
export const TEST_SOURCE = "test";

export type CtaEvent = {
  type: CtaEventType;
  session_uuid: string;
  utm_source: string | null;
  created_at: string;
};

export type WaitlistRow = {
  email: string;
  utm_source: string | null;
  created_at: string;
};

/**
 * 현재 퍼널에서 집계 대상인 이벤트 타입만 통과시킨다.
 * CLICK_SUBSCRIBE(제거됨)·알 수 없는 타입은 false → 모든 집계에서 배제.
 */
export function isCountedType(type: string): type is "VIEW" | "CLICK_TRY" | "WAITLIST_SUBMIT" {
  return type === "VIEW" || type === "CLICK_TRY" || type === "WAITLIST_SUBMIT";
}

export function sourceLabel(utmSource: string | null): string {
  const s = (utmSource ?? "").trim();
  return s === "" ? DIRECT : s;
}

export function isTest(utmSource: string | null): boolean {
  return (utmSource ?? "").trim().toLowerCase() === TEST_SOURCE;
}

/** 이벤트 타입 → 한글 표기. 집계 대상만 노출(그 외는 "기타"). */
export function eventKo(type: string): string {
  switch (type) {
    case "VIEW":
      return "방문";
    case "CLICK_TRY":
      return "사전등록 클릭";
    case "WAITLIST_SUBMIT":
      return "이메일 제출";
    default:
      return "기타";
  }
}

/** ISO 시각 → KST "7/6 20:15" 형식. */
export function fmtKstDateTime(iso: string): string {
  return formatInTimeZone(new Date(iso), KST, "M/d HH:mm");
}

/** ISO 시각 → KST 날짜 키 "yyyy-MM-dd". 날짜 묶기용. */
export function kstDateKey(iso: string): string {
  return formatInTimeZone(new Date(iso), KST, "yyyy-MM-dd");
}

/** KST 날짜 키 → 화면 표기 "M/d(요일)". */
export function fmtKstDateLabel(dateKey: string): string {
  // dateKey는 이미 KST 기준. 정오로 고정해 타임존 경계 흔들림 방지.
  const d = new Date(`${dateKey}T12:00:00+09:00`);
  return formatInTimeZone(d, KST, "M/d(EEEEE)");
}

/** 최근 N일의 KST 날짜 키 배열(오래된→최신). 한국은 DST 없음 → 24h 뒤로 안전. */
export function recentKstDateKeys(days: number, now: Date = new Date()): string[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    keys.push(formatInTimeZone(d, KST, "yyyy-MM-dd"));
  }
  return keys;
}

/** 이메일 마스킹: 앞 2자 + *** + @도메인 (ab***@gmail.com). */
export function maskEmail(email: string): string {
  const at = email.indexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  const domain = email.slice(at); // @도메인 포함
  const head = local.slice(0, 2);
  return `${head}***${domain}`;
}

/** 비율(%) 문자열. 분모 0이면 "-". */
export function pct(n: number, d: number): string {
  if (d <= 0) return "-";
  return `${Math.round((n / d) * 100)}%`;
}

export type ChannelRow = {
  source: string;
  view: number;
  clickTry: number; // 사전등록 클릭(페이지 진입)
  submit: number; // 이메일 제출
};

export type DayRow = {
  dateKey: string;
  view: number;
  click: number; // 사전등록 클릭
  submit: number;
};

export type Summary = {
  visitors: number; // distinct session_uuid (test 제외)
  clickTry: number; // 사전등록 클릭(페이지 진입)
  waitlist: number; // 이메일 제출자 수
};

/** 집계 결과 묶음. */
export type Metrics = {
  summary: Summary;
  channels: ChannelRow[]; // test 제외, view 내림차순
  testChannel: ChannelRow | null; // test 유입 합계(있을 때만)
  days: DayRow[]; // 최근 7일(오래된→최신)
  recent: { at: string; type: CtaEventType; source: string }[]; // 최신순 20건
  waitlistRecent: { at: string; source: string; email: string }[]; // 최신순 10건
  waitlistTotal: number;
};

function emptyChannel(source: string): ChannelRow {
  return { source, view: 0, clickTry: 0, submit: 0 };
}

function addEvent(row: ChannelRow, type: string) {
  if (type === "VIEW") row.view += 1;
  else if (type === "CLICK_TRY") row.clickTry += 1;
  else if (type === "WAITLIST_SUBMIT") row.submit += 1;
  // 그 외(CLICK_SUBSCRIBE·미상)는 무시.
}

export function computeMetrics(
  events: CtaEvent[],
  waitlist: WaitlistRow[],
  now: Date = new Date(),
): Metrics {
  // 집계 대상 타입만 남기고, test 유입을 분리.
  const counted = events.filter((e) => isCountedType(e.type));
  const nonTest = counted.filter((e) => !isTest(e.utm_source));
  const testEvents = counted.filter((e) => isTest(e.utm_source));

  // 요약: 고유 방문자 = distinct session_uuid (test 제외).
  const visitorSet = new Set<string>();
  let clickTry = 0;
  for (const e of nonTest) {
    visitorSet.add(e.session_uuid);
    if (e.type === "CLICK_TRY") clickTry += 1;
  }

  const waitlistNonTest = waitlist.filter((w) => !isTest(w.utm_source));

  // 채널별 퍼널.
  const bySource = new Map<string, ChannelRow>();
  for (const e of nonTest) {
    const key = sourceLabel(e.utm_source);
    let row = bySource.get(key);
    if (!row) {
      row = emptyChannel(key);
      bySource.set(key, row);
    }
    addEvent(row, e.type);
  }
  const channels = [...bySource.values()].sort((a, b) => b.view - a.view);

  let testChannel: ChannelRow | null = null;
  if (testEvents.length > 0) {
    testChannel = emptyChannel("테스트 유입");
    for (const e of testEvents) addEvent(testChannel, e.type);
  }

  // 일별 추이(최근 7일, KST).
  const dayKeys = recentKstDateKeys(7, now);
  const dayMap = new Map<string, DayRow>();
  for (const k of dayKeys) dayMap.set(k, { dateKey: k, view: 0, click: 0, submit: 0 });
  for (const e of nonTest) {
    const k = kstDateKey(e.created_at);
    const row = dayMap.get(k);
    if (!row) continue; // 7일 범위 밖.
    if (e.type === "VIEW") row.view += 1;
    else if (e.type === "CLICK_TRY") row.click += 1;
    else if (e.type === "WAITLIST_SUBMIT") row.submit += 1;
  }
  const days = dayKeys.map((k) => dayMap.get(k)!);

  // 최근 활동 20건(최신순, test 제외).
  const recent = [...nonTest]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 20)
    .map((e) => ({ at: e.created_at, type: e.type, source: sourceLabel(e.utm_source) }));

  // 대기자 최근 10건(최신순, test 제외).
  const waitlistRecent = [...waitlistNonTest]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 10)
    .map((w) => ({
      at: w.created_at,
      source: sourceLabel(w.utm_source),
      email: maskEmail(w.email),
    }));

  return {
    summary: {
      visitors: visitorSet.size,
      clickTry,
      waitlist: waitlistNonTest.length,
    },
    channels,
    testChannel,
    days,
    recent,
    waitlistRecent,
    waitlistTotal: waitlistNonTest.length,
  };
}
