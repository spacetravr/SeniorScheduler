import { describe, it, expect } from "vitest";
import {
  periodLabel,
  buildReportSummary,
  type ReportItem,
} from "./reportSummary";

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

describe("periodLabel", () => {
  it("DAY 단일 날짜는 요일까지 표기한다", () => {
    // 2026-07-16 = 목요일
    expect(periodLabel("DAY", ["2026-07-16"])).toBe("7월 16일 (목)");
  });

  it("DAY 여러 날짜는 범위로 표기한다", () => {
    expect(periodLabel("DAY", ["2026-07-16", "2026-07-14"])).toBe(
      "7월 14일 ~ 7월 16일",
    );
  });

  it("WEEK는 월요일~일요일 주간 범위로 표기한다", () => {
    // 2026-07-16(목) 이 속한 주 = 07-13(월) ~ 07-19(일)
    expect(periodLabel("WEEK", ["2026-07-16"])).toBe(
      "7월 13일 ~ 7월 19일 주간",
    );
  });

  it("MONTH 단일 달은 연·월로 표기한다", () => {
    expect(periodLabel("MONTH", ["2026-07-16", "2026-07-02"])).toBe("2026년 7월");
  });

  it("MONTH 여러 달은 범위로 표기한다", () => {
    expect(periodLabel("MONTH", ["2026-06-30", "2026-07-02"])).toBe(
      "2026년 6월 ~ 2026년 7월",
    );
  });

  it("UTC 오프셋과 무관하게 KST 달력으로 집계된다(경계 케이스는 kstYmd 통과분 사용)", () => {
    expect(periodLabel("DAY", [])).toBe("");
  });
});

describe("buildReportSummary", () => {
  it("빈 입력은 안내 문구를 반환한다", () => {
    expect(buildReportSummary("DAY", [])).toBe("표시할 통화 리포트가 없습니다.");
  });

  it("피보호자별 상태 카운트와 고지 문구를 포함한다", () => {
    const items: ReportItem[] = [
      item({ createdAt: "2026-07-16T09:00:00+09:00", status: "DONE" }),
      item({ createdAt: "2026-07-16T12:00:00+09:00", status: "NOT_DONE" }),
      item({
        createdAt: "2026-07-16T18:00:00+09:00",
        status: "DONE",
        seniorName: "이철수",
      }),
    ];
    const text = buildReportSummary("DAY", items);
    expect(text).toContain("[7월 16일 (목) 리포트 요약]");
    expect(text).toContain("- 김영자님: 완료 1 · 미이행 1 (총 2통)");
    expect(text).toContain("- 이철수님: 완료 1 (총 1통)");
    expect(text.trimEnd().endsWith("본 리포트는 의료적 판단이 아닌 통화 요약입니다.")).toBe(
      true,
    );
  });

  it("mood/health 플래그가 있으면 특이사항 줄을 추가한다", () => {
    const items: ReportItem[] = [
      item({ createdAt: "2026-07-16T09:00:00+09:00", moodFlag: true }),
      item({
        createdAt: "2026-07-16T10:00:00+09:00",
        seniorName: "이철수",
        healthFlag: true,
      }),
    ];
    const text = buildReportSummary("DAY", items);
    expect(text).toContain(
      "특이사항: 김영자님 기분 관련, 이철수님 건강 관련 언급이 있었습니다.",
    );
  });

  it("플래그가 없으면 특이사항 줄을 넣지 않는다", () => {
    const items: ReportItem[] = [
      item({ createdAt: "2026-07-16T09:00:00+09:00" }),
    ];
    expect(buildReportSummary("DAY", items)).not.toContain("특이사항");
  });
});
