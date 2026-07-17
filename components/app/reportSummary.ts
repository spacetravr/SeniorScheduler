/**
 * 리포트 집계용 순수 헬퍼 + "요약 보내기" 텍스트 생성기.
 * TZ 영향 없이 "YYYY-MM-DD" 문자열 달력으로만 연산한다(과거 9시간 밀림 버그 방지).
 * 표시 문자열은 format.ts의 fmtDate(=formatInTimeZone Asia/Seoul)만 사용.
 * lib 미수정 — ui 소유 경계 내 순수 함수. buildReportSummary는 단위 테스트 대상.
 */
import {
  ADHERENCE_STATUSES,
  adherenceStatusLabel,
  type CallReport,
} from "@/lib/contracts/domain";
import { fmtDate, kstYmd } from "@/components/app/format";

type Adherence = CallReport["adherence_status"];

export type ReportItem = {
  id: string;
  sessionId: string | null;
  createdAt: string; // ISO (임의 오프셋)
  status: Adherence;
  summary: string;
  moodFlag: boolean;
  healthFlag: boolean;
  seniorName: string;
  title: string;
};

export type View = "DAY" | "WEEK" | "MONTH";

// ── KST 달력 순수 헬퍼 (문자열 달력 연산) ──
export const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** "YYYY-MM-DD" 정오 앵커 ISO — fmtDate/요일 계산에 안전하게 사용. */
export function anchor(ymd: string): string {
  return `${ymd}T12:00:00+09:00`;
}

/** ymd → 요일 인덱스(0=월 … 6=일). */
export function mondayIndex(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay(); // 0=일
  return (dow + 6) % 7;
}

/** ymd → 한국어 요일 한 글자 (일~토). */
export function weekdayKo(ymd: string): string {
  return WEEKDAY_KO[(mondayIndex(ymd) + 1) % 7];
}

export function addDaysYmd(ymd: string, delta: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

/** 그 주 월요일(YYYY-MM-DD). */
export function weekStartYmd(ymd: string): string {
  return addDaysYmd(ymd, -mondayIndex(ymd));
}

export function rate(done: number, total: number): number {
  return total > 0 ? Math.round((done / total) * 100) : 0;
}

/** 상태별 카운트 → 0이 아닌 것만 라벨 칩 배열. */
export function statusChips(items: ReportItem[]) {
  return ADHERENCE_STATUSES.map((st) => ({
    status: st,
    label: adherenceStatusLabel[st],
    count: items.filter((i) => i.status === st).length,
  })).filter((c) => c.count > 0);
}

// ── "요약 보내기" 텍스트 생성 ──

/** 뷰 granularity에 맞춰 items 전체가 걸친 기간 라벨을 만든다. */
export function periodLabel(view: View, ymds: string[]): string {
  if (ymds.length === 0) return "";
  const sorted = [...ymds].sort();
  const min = sorted[0];
  const max = sorted[sorted.length - 1];

  if (view === "DAY") {
    if (min === max) return `${fmtDate(anchor(min))} (${weekdayKo(min)})`;
    return `${fmtDate(anchor(min))} ~ ${fmtDate(anchor(max))}`;
  }
  if (view === "WEEK") {
    const ws = weekStartYmd(min);
    const we = addDaysYmd(weekStartYmd(max), 6);
    return `${fmtDate(anchor(ws))} ~ ${fmtDate(anchor(we))} 주간`;
  }
  // MONTH
  const minYm = min.slice(0, 7);
  const maxYm = max.slice(0, 7);
  const fmtYm = (ym: string) => {
    const [y, m] = ym.split("-");
    return `${y}년 ${Number(m)}월`;
  };
  return minYm === maxYm ? fmtYm(minYm) : `${fmtYm(minYm)} ~ ${fmtYm(maxYm)}`;
}

/** 피보호자별 상태 카운트 한 줄 (예: "김영자님: 완료 3 · 미이행 1 (총 4통)"). */
function seniorLine(name: string, list: ReportItem[]): string {
  const parts = statusChips(list).map((c) => `${c.label} ${c.count}`);
  return `- ${name}님: ${parts.join(" · ")} (총 ${list.length}통)`;
}

/**
 * 현재 선택된 뷰/기간의 요약 평문 생성 (이메일 본문에 그대로 붙일 수 있는 형식).
 * 의료 조언 금지 고지 한 줄을 항상 마지막에 포함(가드레일 1).
 */
export function buildReportSummary(view: View, items: ReportItem[]): string {
  if (items.length === 0) {
    return "표시할 통화 리포트가 없습니다.";
  }

  const ymds = items.map((i) => kstYmd(i.createdAt));
  const period = periodLabel(view, ymds);

  // 피보호자별 그룹 (등장 순서 유지)
  const order: string[] = [];
  const bySenior = new Map<string, ReportItem[]>();
  for (const i of items) {
    if (!bySenior.has(i.seniorName)) {
      bySenior.set(i.seniorName, []);
      order.push(i.seniorName);
    }
    bySenior.get(i.seniorName)!.push(i);
  }

  const lines: string[] = [];
  lines.push(`[${period} 리포트 요약]`);
  lines.push("");
  for (const name of order) {
    lines.push(seniorLine(name, bySenior.get(name)!));
  }

  // mood/health 특이사항 — 있으면 피보호자 단위로 한 줄.
  const flagged: string[] = [];
  for (const name of order) {
    const list = bySenior.get(name)!;
    const kinds: string[] = [];
    if (list.some((i) => i.moodFlag)) kinds.push("기분");
    if (list.some((i) => i.healthFlag)) kinds.push("건강");
    if (kinds.length > 0) flagged.push(`${name}님 ${kinds.join("·")} 관련`);
  }
  if (flagged.length > 0) {
    lines.push("");
    lines.push(`특이사항: ${flagged.join(", ")} 언급이 있었습니다.`);
  }

  lines.push("");
  lines.push("본 리포트는 의료적 판단이 아닌 통화 요약입니다.");

  return lines.join("\n");
}
