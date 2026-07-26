import { describe, it, expect } from "vitest";
import { weeklyWindowKst, composeWeeklyDigest } from "./weekly";
import { MEDICAL_DISCLAIMER } from "@/lib/contracts/domain";
import type { ReportItem } from "@/lib/reports/summary";

function item(over: Partial<ReportItem> & Pick<ReportItem, "createdAt">): ReportItem {
  return {
    id: Math.random().toString(36).slice(2),
    sessionId: null,
    status: "DONE",
    summary: "요약",
    moodFlag: false,
    healthFlag: false,
    seniorName: "김영자",
    title: "복약 안내",
    ...over,
  };
}

describe("weeklyWindowKst", () => {
  it("오늘(KST) 이전 7개 달력일을 반개구간으로 반환한다", () => {
    // 2026-07-27(월) 09:00 KST = 2026-07-27T00:00:00Z
    const now = new Date("2026-07-27T00:00:00Z");
    const { startIso, endIso } = weeklyWindowKst(now);
    // end = KST 07-27 00:00 = UTC 07-26 15:00
    expect(endIso).toBe("2026-07-26T15:00:00.000Z");
    // start = KST 07-20 00:00 = UTC 07-19 15:00
    expect(startIso).toBe("2026-07-19T15:00:00.000Z");
  });

  it("KST 자정 직전(늦은 밤)에도 그날의 달력일 기준으로 계산한다", () => {
    // 2026-07-27T14:30:00Z = KST 07-27 23:30 → 오늘 ymd = 07-27
    const now = new Date("2026-07-27T14:30:00Z");
    const { endIso } = weeklyWindowKst(now);
    expect(endIso).toBe("2026-07-26T15:00:00.000Z");
  });
});

describe("composeWeeklyDigest", () => {
  it("리포트가 없으면 null 을 반환한다", () => {
    expect(composeWeeklyDigest([])).toBeNull();
  });

  it("제목은 주간 기간, 본문은 요약 + 정식 고지 문구를 포함한다", () => {
    const items: ReportItem[] = [
      item({ createdAt: "2026-07-20T09:00:00+09:00", status: "DONE" }),
      item({ createdAt: "2026-07-21T09:00:00+09:00", status: "NOT_DONE", seniorName: "이철수" }),
    ];
    const digest = composeWeeklyDigest(items);
    expect(digest).not.toBeNull();
    expect(digest!.subject).toContain("[주간 리포트]");
    // 2026-07-20(월) 이 속한 주 = 07-20 ~ 07-26
    expect(digest!.subject).toContain("7월 20일 ~ 7월 26일 주간");
    expect(digest!.text).toContain("- 김영자님: 완료 1 (총 1통)");
    expect(digest!.text).toContain("- 이철수님: 미이행 1 (총 1통)");
    expect(digest!.text.trimEnd().endsWith(MEDICAL_DISCLAIMER)).toBe(true);
  });
});
