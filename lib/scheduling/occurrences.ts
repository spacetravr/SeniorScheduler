import { RRule } from "rrule";
import { fromZonedTime, formatInTimeZone } from "date-fns-tz";

/**
 * RRULE + call_time("HH:mm", KST) → 발신 시각(instant) 계산.
 *
 * ── rrule 2.8 UTC 함정 회피 (중요) ──
 * rrule 의 date 생성기(RRule#all/between/after)는 dtstart 를 UTC 로 취급해, 로컬/KST 의도와
 * 어긋난 instant 를 만들어낸다(특히 자정 경계). 그래서 이 모듈은 rrule 을 **문자열 파싱
 * (RRule.parseString) 검증 용도로만** 쓰고, 실제 날짜 반복·instant 생성은 rrule 에 맡기지
 * 않는다. 대신:
 *   1) rrule 로부터 FREQ 와 BYDAY(요일 집합)만 뽑고
 *   2) "이 KST 달력 날짜에 발신하는가?" 는 KST 요일로 직접 판정하며
 *   3) 최종 instant 는 date-fns-tz `fromZonedTime(`${ymd}T${HH:mm}:00`, 'Asia/Seoul')` 로
 *      Asia/Seoul 을 **명시**해 만든다. 암묵적 로컬/UTC 의존 없음.
 */

export const KST = "Asia/Seoul";

/** 잘못된/미지원 RRULE 입력. server action 은 이를 잡아 한국어 4xx 로 변환한다. */
export class InvalidRruleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidRruleError";
  }
}

export type ParsedRule = {
  freq: "DAILY" | "WEEKLY";
  /** WEEKLY 일 때 발신 요일(ISO: 1=월 … 7=일). DAILY 는 빈 배열. */
  weekdaysIso: number[];
};

// rrule Weekday.weekday(MO=0 … SU=6) → ISO(월=1 … 일=7)
function rruleWeekdayToIso(entry: unknown): number {
  const raw =
    typeof entry === "number"
      ? entry
      : entry && typeof entry === "object" && "weekday" in entry
        ? (entry as { weekday: number }).weekday
        : null;
  if (raw === null || raw === undefined || raw < 0 || raw > 6) {
    throw new InvalidRruleError("BYDAY 요일 값이 올바르지 않습니다.");
  }
  return raw + 1;
}

/**
 * RRULE 문자열을 검증·정규화. FREQ=DAILY | (FREQ=WEEKLY;BYDAY=…) 만 지원.
 * WEEKLY 는 BYDAY 필수(발신 요일이 명시돼야 함 — DTSTART 없는 도메인이므로).
 */
export function parseRule(rrule: string): ParsedRule {
  if (typeof rrule !== "string" || rrule.trim() === "") {
    throw new InvalidRruleError("반복 규칙(RRULE)이 비어 있습니다.");
  }

  let options: Partial<{ freq: number; byweekday: unknown }>;
  try {
    options = RRule.parseString(rrule) as typeof options;
  } catch {
    throw new InvalidRruleError("반복 규칙(RRULE) 형식이 올바르지 않습니다.");
  }

  if (options.freq === RRule.DAILY) {
    return { freq: "DAILY", weekdaysIso: [] };
  }

  if (options.freq === RRule.WEEKLY) {
    const by = options.byweekday;
    const list = by == null ? [] : Array.isArray(by) ? by : [by];
    if (list.length === 0) {
      throw new InvalidRruleError("주간 반복은 요일(BYDAY)을 지정해야 합니다.");
    }
    const weekdaysIso = Array.from(new Set(list.map(rruleWeekdayToIso))).sort((a, b) => a - b);
    return { freq: "WEEKLY", weekdaysIso };
  }

  throw new InvalidRruleError("지원하지 않는 반복 규칙입니다(매일/매주만 지원).");
}

/** "yyyy-MM-dd" (KST 달력 날짜) 의 ISO 요일(월=1 … 일=7). 런타임 타임존 비의존. */
function isoWeekdayOfKstDate(ymd: string): number {
  // 정오(UTC)는 KST(+9)로 같은 날 21:00 → 어떤 경우에도 달력 날짜가 어긋나지 않는 안전 앵커.
  return Number(formatInTimeZone(new Date(`${ymd}T12:00:00Z`), KST, "i"));
}

function assertYmd(ymd: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    throw new Error(`KST 날짜 형식이 올바르지 않습니다: ${ymd}`);
  }
}

/** 주어진 instant 의 KST 달력 날짜("yyyy-MM-dd"). */
export function kstDateOf(instant: Date): string {
  return formatInTimeZone(instant, KST, "yyyy-MM-dd");
}

/** 해당 RRULE 이 특정 KST 달력 날짜에 발신하는가? (날짜만 판정, 시각 무관) */
export function occursOnKstDate(rrule: string, date: Date | string): boolean {
  const ymd = typeof date === "string" ? date : kstDateOf(date);
  assertYmd(ymd);
  const parsed = parseRule(rrule);
  if (parsed.freq === "DAILY") return true;
  return parsed.weekdaysIso.includes(isoWeekdayOfKstDate(ymd));
}

/**
 * 특정 KST 날짜의 발신 instant. 그 날 발신이 없으면 null.
 * callTime 은 "HH:mm"(KST). 결과는 Asia/Seoul 을 명시해 만든 UTC instant.
 */
export function instanceOnKstDate(
  rrule: string,
  callTime: string,
  ymd: string,
): Date | null {
  assertYmd(ymd);
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(callTime)) {
    throw new Error(`call_time 형식이 올바르지 않습니다(HH:mm): ${callTime}`);
  }
  if (!occursOnKstDate(rrule, ymd)) return null;
  return fromZonedTime(`${ymd}T${callTime}:00`, KST);
}

/**
 * from(기본: 현재) **이후(같은 시각 포함)** 의 다음 발신 instant.
 * DAILY/WEEKLY 만 다루므로 최대 370일 이내에 반드시 존재한다.
 */
export function nextOccurrence(rrule: string, callTime: string, from: Date = new Date()): Date {
  // 유효성 선검증(잘못된 규칙/시각은 즉시 throw).
  parseRule(rrule);
  const fromMs = from.getTime();
  const startYmd = kstDateOf(from);
  // 정오 UTC 앵커에 일 단위로 더하면 KST 달력 날짜가 하루씩 정확히 증가한다(한국은 DST 없음).
  const anchorMs = new Date(`${startYmd}T12:00:00Z`).getTime();
  const DAY = 86_400_000;

  for (let i = 0; i < 370; i++) {
    const ymd = formatInTimeZone(new Date(anchorMs + i * DAY), KST, "yyyy-MM-dd");
    const instant = instanceOnKstDate(rrule, callTime, ymd);
    if (instant && instant.getTime() >= fromMs) return instant;
  }
  throw new Error("다음 발신 시각을 370일 이내에 찾지 못했습니다(예상치 못한 규칙).");
}
