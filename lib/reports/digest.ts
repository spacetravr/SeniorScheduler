/**
 * ReportDigest 빌더 — 채널 무관 리포트 ViewModel 생성 (순수 함수).
 *
 * 웹 화면(components/app), 이메일 크론(app/api/cron), 카톡 공유 텍스트가 **모두 이 함수 하나**를
 * 거친다. 채널이 늘어나도 집계·판정 로직은 여기 한 곳만 본다 (docs/report-spec.md).
 *
 * 시간대(CLAUDE.md): 모든 달력 연산은 date-fns-tz Asia/Seoul 명시. 암묵적 UTC/로컬 금지.
 */
import { formatInTimeZone } from "date-fns-tz";
import { adherenceStatusLabel, MEDICAL_DISCLAIMER } from "@/lib/contracts/domain";
import {
  EMERGENCY_DISCLAIMER,
  type DigestItem,
  type DigestPeriod,
  type DigestSenior,
  type DigestStats,
  type DigestTone,
  type ReportDigest,
} from "@/lib/contracts/report-view";
import { anchor, WEEKDAY_KO, type ReportItem } from "@/lib/reports/summary";

const KST = "Asia/Seoul";

/** 이상 신호 판정 단일 기준 — DONE·POSTPONED 는 정상(연기는 부모님이 의사를 밝힌 것). */
const EXCEPTION_STATUSES = new Set(["NOT_DONE", "UNCERTAIN", "MISSED"]);

/** 빌더 입력 — 기존 ReportItem 에 피보호자 식별자를 더한 형태. */
export type DigestInput = ReportItem & { seniorId: string };

/** ISO → KST "HH:mm" */
function kstTime(iso: string): string {
  return formatInTimeZone(iso, KST, "HH:mm");
}

/** ISO → KST "yyyy-MM-dd" */
function kstYmd(iso: string): string {
  return formatInTimeZone(iso, KST, "yyyy-MM-dd");
}

/** "YYYY-MM-DD" → "7월 28일 (월)" */
function fmtDayLabel(ymd: string): string {
  const iso = anchor(ymd);
  const month = Number(formatInTimeZone(iso, KST, "M"));
  const day = Number(formatInTimeZone(iso, KST, "d"));
  const dow = WEEKDAY_KO[Number(formatInTimeZone(iso, KST, "i")) % 7];
  return `${month}월 ${day}일 (${dow})`;
}

/** "YYYY-MM-DD" → "7월 28일" */
function fmtShortDay(ymd: string): string {
  const iso = anchor(ymd);
  return `${Number(formatInTimeZone(iso, KST, "M"))}월 ${Number(formatInTimeZone(iso, KST, "d"))}일`;
}

function periodLabelOf(kind: DigestPeriod, startYmd: string, endYmd: string): string {
  if (kind === "DAY") return fmtDayLabel(startYmd);
  if (startYmd === endYmd) return fmtShortDay(startYmd);
  return `${fmtShortDay(startYmd)} ~ ${fmtShortDay(endYmd)}`;
}

function buildStats(items: DigestItem[]): DigestStats {
  const count = (s: string) => items.filter((i) => i.status === s).length;
  const missed = count("MISSED");
  const done = count("DONE");
  const answered = items.length - missed;
  return {
    total: items.length,
    done,
    notDone: count("NOT_DONE"),
    postponed: count("POSTPONED"),
    uncertain: count("UNCERTAIN"),
    missed,
    exception: items.filter((i) => i.isException).length,
    adherenceRate: answered > 0 ? Math.round((done / answered) * 100) : null,
  };
}

/**
 * 톤 판정 — 알림 발송 여부(EXCEPTION 레벨)와 헤드라인 색을 동시에 좌우한다.
 * CALM(0건) / ATTENTION(1건) / ALERT(2건+ 또는 MISSED 2건+).
 * 단발 MISSED 는 ALERT 로 올리지 않는다 (THIRD-PLAN P0-4: 오경보 관리).
 */
function toneOf(stats: DigestStats): DigestTone {
  if (stats.exception === 0) return "CALM";
  if (stats.exception >= 2 || stats.missed >= 2) return "ALERT";
  return "ATTENTION";
}

function headlineOf(tone: DigestTone, kind: DigestPeriod, stats: DigestStats): string {
  const when = kind === "DAY" ? "오늘은" : "이 기간에는";
  if (stats.total === 0) return `${when} 안내 전화가 없었어요`;
  if (tone === "CALM") return `${when} 이상 신호가 없었어요`;
  return `확인이 필요한 일이 ${stats.exception}건 있어요`;
}

function sublineOf(stats: DigestStats): string {
  if (stats.total === 0) return "";
  const parts = [`통화 ${stats.total}건`];
  if (stats.adherenceRate !== null) parts.push(`이행 ${stats.done}건 (${stats.adherenceRate}%)`);
  // 예외는 종류별로 **빠짐없이** 적는다 — headline 의 "N건"과 내역 합이 어긋나면
  // 리포트 자체의 신뢰가 깨진다(미이행 누락 버그 2026-07-28).
  if (stats.notDone > 0) parts.push(`미이행 ${stats.notDone}건`);
  if (stats.missed > 0) parts.push(`부재 ${stats.missed}건`);
  if (stats.uncertain > 0) parts.push(`확인 필요 ${stats.uncertain}건`);
  return parts.join(" · ");
}

/** 예외 우선 → 시간 오름차순. 같은 그룹 안에서는 항상 결정적 순서. */
function sortItems(a: DigestItem, b: DigestItem): number {
  if (a.isException !== b.isException) return a.isException ? -1 : 1;
  if (a.ymd !== b.ymd) return a.ymd.localeCompare(b.ymd);
  return a.time.localeCompare(b.time);
}

/**
 * 일자별 이행률 추이 — 오래된→최신. 통화가 없는 날은 null(0% 로 오해되지 않게).
 * 최대 maxPoints 개만 남긴다(스파크라인용).
 */
function buildTrend(items: DigestItem[], maxPoints = 7): (number | null)[] {
  const byYmd = new Map<string, DigestItem[]>();
  for (const it of items) {
    const list = byYmd.get(it.ymd) ?? [];
    list.push(it);
    byYmd.set(it.ymd, list);
  }
  const ymds = [...byYmd.keys()].sort().slice(-maxPoints);
  return ymds.map((ymd) => buildStats(byYmd.get(ymd) ?? []).adherenceRate);
}

/**
 * 리포트 다이제스트 생성.
 * @param kind   기간 종류 (DAY/WEEK/MONTH)
 * @param inputs 기간 안의 리포트 항목 (필터링은 호출자 책임)
 * @param range  KST 달력 경계. 생략 시 inputs 의 최소/최대 날짜에서 유도(항목 0건이면 today 필요)
 */
export function buildDigest(
  kind: DigestPeriod,
  inputs: DigestInput[],
  range?: { startYmd: string; endYmd: string },
): ReportDigest {
  const items: DigestItem[] = inputs.map((i) => ({
    reportId: i.id,
    sessionId: i.sessionId,
    time: kstTime(i.createdAt),
    ymd: kstYmd(i.createdAt),
    title: i.title,
    status: i.status,
    statusLabel: adherenceStatusLabel[i.status],
    isException: EXCEPTION_STATUSES.has(i.status),
    summary: i.summary,
    moodFlag: i.moodFlag,
    healthFlag: i.healthFlag,
  }));

  const ymds = items.map((i) => i.ymd).sort();
  const startYmd = range?.startYmd ?? ymds[0] ?? "";
  const endYmd = range?.endYmd ?? ymds[ymds.length - 1] ?? startYmd;

  // 피보호자 묶음 — 등장 순서로 colorIndex 를 배정(UI 의 index%3 규칙과 동일).
  const order: string[] = [];
  const bySenior = new Map<string, { name: string; items: DigestItem[] }>();
  inputs.forEach((input, idx) => {
    const key = input.seniorId;
    if (!bySenior.has(key)) {
      order.push(key);
      bySenior.set(key, { name: input.seniorName, items: [] });
    }
    bySenior.get(key)!.items.push(items[idx]);
  });

  const seniors: DigestSenior[] = order.map((seniorId, idx) => {
    const entry = bySenior.get(seniorId)!;
    const sorted = [...entry.items].sort(sortItems);
    return {
      seniorId,
      name: entry.name,
      colorIndex: idx % 3,
      exceptionCount: sorted.filter((i) => i.isException).length,
      items: sorted,
    };
  });
  // 이상 신호가 있는 피보호자를 위로 (예외 우선 원칙을 묶음 레벨에도 적용)
  seniors.sort((a, b) => b.exceptionCount - a.exceptionCount);

  const stats = buildStats(items);
  const tone = toneOf(stats);

  return {
    period: { kind, label: periodLabelOf(kind, startYmd, endYmd), startYmd, endYmd },
    tone,
    headline: headlineOf(tone, kind, stats),
    subline: sublineOf(stats),
    stats,
    seniors,
    trend: buildTrend(items),
  };
}

/**
 * 공유용 플레인 텍스트 — 카카오톡 공유·문자·클립보드 공통.
 * 카톡 대화창에서 한 화면에 읽히도록 **예외 우선 + 간결**하게. 정상 항목은 접어서 건수로만.
 * 전사·상세는 넣지 않는다(민감 정보 확산 방지 — 링크로 유도).
 */
export function renderShareText(digest: ReportDigest, linkUrl?: string): string {
  const lines: string[] = [];
  lines.push(`[Senior Scheduler] ${digest.period.label}`);
  lines.push(digest.headline);
  if (digest.subline) lines.push(digest.subline);

  for (const senior of digest.seniors) {
    const exceptions = senior.items.filter((i) => i.isException);
    if (exceptions.length === 0) continue;
    lines.push("");
    lines.push(`· ${senior.name}`);
    for (const item of exceptions) {
      lines.push(`  - ${item.time} ${item.title} → ${item.statusLabel}`);
    }
  }

  const normal = digest.stats.total - digest.stats.exception;
  if (normal > 0) {
    lines.push("");
    lines.push(`그 밖의 ${normal}건은 정상적으로 확인되었어요.`);
  }

  if (linkUrl) {
    lines.push("");
    lines.push(`자세히 보기: ${linkUrl}`);
  }
  lines.push("");
  lines.push(MEDICAL_DISCLAIMER);
  lines.push(EMERGENCY_DISCLAIMER);
  return lines.join("\n");
}
