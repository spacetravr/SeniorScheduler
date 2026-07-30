import { describe, it, expect } from "vitest";
import {
  LEVEL,
  WORKFLOW_EXPECTATIONS,
  kstDayRange,
  judgeWorkflows,
  judgeDispatch,
  judgeNotify,
  worstLevel,
  buildOpsSection,
  titlePrefix,
} from "./ops-health.mjs";

// 기준 시각: 2026-07-30 09:00 KST = 2026-07-30T00:00:00Z (daily-report 가 실제로 도는 시각).
const NOW = new Date("2026-07-30T00:00:00.000Z");

const DISPATCH = ".github/workflows/call-dispatch.yml";

/** 전부 정상인 워크플로 응답(테스트에서 필요한 항목만 덮어쓴다). */
function healthyWorkflows(overrides = {}) {
  return WORKFLOW_EXPECTATIONS.map((w) => ({
    path: w.path,
    state: "active",
    lastRunAt: new Date(NOW.getTime() - 10 * 60_000).toISOString(), // 10분 전
    lastConclusion: "success",
    ...(overrides[w.path] ?? {}),
  }));
}

describe("kstDayRange", () => {
  it("어제(KST)의 경계를 UTC 로 정확히 만든다 — KST 00:00 은 UTC 전날 15:00", () => {
    // NOW = 7/30 09:00 KST → 어제는 7/29
    expect(kstDayRange(NOW, -1)).toEqual({
      ymd: "2026-07-29",
      startIso: "2026-07-28T15:00:00.000Z",
      endIso: "2026-07-29T15:00:00.000Z",
    });
  });

  it("KST 자정 직후에도 날짜가 하루 밀리지 않는다", () => {
    // 2026-07-30T00:10 KST = 2026-07-29T15:10Z → 어제는 7/29
    expect(kstDayRange(new Date("2026-07-29T15:10:00.000Z"), -1).ymd).toBe("2026-07-29");
  });

  it("offsetDays 0 은 오늘", () => {
    expect(kstDayRange(NOW, 0).ymd).toBe("2026-07-30");
  });
});

describe("judgeWorkflows", () => {
  it("전부 정상이면 모두 OK", () => {
    const rows = judgeWorkflows(healthyWorkflows(), NOW);
    expect(rows).toHaveLength(WORKFLOW_EXPECTATIONS.length);
    expect(rows.every((r) => r.level === LEVEL.OK)).toBe(true);
  });

  it("disabled_manually 는 RED — 세션 #14 의 12일 침묵을 잡는 핵심 케이스", () => {
    const rows = judgeWorkflows(healthyWorkflows({ [DISPATCH]: { state: "disabled_manually" } }), NOW);
    const row = rows.find((r) => r.label.includes("call-dispatch"));
    expect(row.level).toBe(LEVEL.RED);
    expect(row.detail).toContain("수동 비활성화");
  });

  it("disabled_inactivity(GitHub 자동 비활성화)도 RED 이며 사유를 구분해 알려준다", () => {
    const rows = judgeWorkflows(healthyWorkflows({ [DISPATCH]: { state: "disabled_inactivity" } }), NOW);
    expect(rows.find((r) => r.label.includes("call-dispatch")).detail).toContain("무활동");
  });

  it("활성이지만 임계를 넘겨 침묵하면 RED", () => {
    const rows = judgeWorkflows(
      healthyWorkflows({ [DISPATCH]: { lastRunAt: new Date(NOW.getTime() - 12 * 3_600_000).toISOString() } }),
      NOW,
    );
    const row = rows.find((r) => r.label.includes("call-dispatch"));
    expect(row.level).toBe(LEVEL.RED);
    expect(row.detail).toContain("침묵");
  });

  it("GitHub 지연(임계 이내)은 RED 로 올리지 않는다 — best-effort 스케줄 오탐 방지", () => {
    const rows = judgeWorkflows(
      healthyWorkflows({ [DISPATCH]: { lastRunAt: new Date(NOW.getTime() - 90 * 60_000).toISOString() } }),
      NOW,
    );
    expect(rows.find((r) => r.label.includes("call-dispatch")).level).toBe(LEVEL.OK);
  });

  it("실행 이력이 0건이면 RED", () => {
    const rows = judgeWorkflows(healthyWorkflows({ [DISPATCH]: { lastRunAt: null } }), NOW);
    expect(rows.find((r) => r.label.includes("call-dispatch")).level).toBe(LEVEL.RED);
  });

  it("마지막 실행이 실패면 YELLOW", () => {
    const rows = judgeWorkflows(healthyWorkflows({ [DISPATCH]: { lastConclusion: "failure" } }), NOW);
    expect(rows.find((r) => r.label.includes("call-dispatch")).level).toBe(LEVEL.YELLOW);
  });

  it("목록에 없는 워크플로는 YELLOW(삭제·경로 변경 감지)", () => {
    const rows = judgeWorkflows([], NOW);
    expect(rows.every((r) => r.level === LEVEL.YELLOW)).toBe(true);
  });

  it("조회 실패(null)는 UNKNOWN — 감시 실패가 곧 고장 판정이 되면 안 된다", () => {
    const rows = judgeWorkflows(null, NOW);
    expect(rows.every((r) => r.level === LEVEL.UNKNOWN)).toBe(true);
  });
});

describe("judgeDispatch", () => {
  const base = { activeScheduleCount: 6, consentedSeniorCount: 2 };

  it("발신이 있었으면 OK 이고 상태별 내역과 원가 합계를 보여준다", () => {
    const row = judgeDispatch({
      ...base,
      sessions: [
        { status: "COMPLETED", purpose: "SCHEDULE", cost_krw: "60.00" },
        { status: "COMPLETED", purpose: "SCHEDULE", cost_krw: "60.00" },
        { status: "MISSED", purpose: "SCHEDULE", cost_krw: null },
      ],
    });
    expect(row.level).toBe(LEVEL.OK);
    expect(row.detail).toContain("3건");
    expect(row.detail).toContain("COMPLETED 2");
    expect(row.detail).toContain("120");
  });

  it("발신 조건이 갖춰졌는데 0건이면 RED", () => {
    const row = judgeDispatch({ ...base, sessions: [] });
    expect(row.level).toBe(LEVEL.RED);
    expect(row.detail).toContain("활성 일정 6건");
  });

  it("활성 일정이 없으면 0건은 정상(INFO)", () => {
    const row = judgeDispatch({ sessions: [], activeScheduleCount: 0, consentedSeniorCount: 2 });
    expect(row.level).toBe(LEVEL.INFO);
  });

  it("동의 완료 피보호자가 0명이면 0건은 YELLOW(동의 전이면 정상)", () => {
    const row = judgeDispatch({ sessions: [], activeScheduleCount: 6, consentedSeniorCount: 0 });
    expect(row.level).toBe(LEVEL.YELLOW);
  });

  it("기대치 조회에 실패하면 판정을 보류한다(YELLOW)", () => {
    const row = judgeDispatch({ sessions: [], activeScheduleCount: null, consentedSeniorCount: null });
    expect(row.level).toBe(LEVEL.YELLOW);
    expect(row.detail).toContain("보류");
  });

  it("세션 조회 실패는 UNKNOWN", () => {
    expect(judgeDispatch({ ...base, sessions: null }).level).toBe(LEVEL.UNKNOWN);
  });
});

describe("judgeNotify", () => {
  it("이상 신호가 있었는데 예외 알림 0건이면 YELLOW", () => {
    const row = judgeNotify({
      reports: [{ adherence_status: "NOT_DONE" }, { adherence_status: "DONE" }],
      notifyLogs: [],
    });
    expect(row.level).toBe(LEVEL.YELLOW);
    expect(row.detail).toContain("이상 신호 리포트 1건");
  });

  it("이상 신호와 알림이 모두 있으면 OK", () => {
    const row = judgeNotify({
      reports: [{ adherence_status: "MISSED" }],
      notifyLogs: [{ kind: "EXCEPTION_ALERT" }],
    });
    expect(row.level).toBe(LEVEL.OK);
  });

  it("이상 신호가 없으면 알림 0건이어도 OK", () => {
    const row = judgeNotify({ reports: [{ adherence_status: "DONE" }], notifyLogs: [] });
    expect(row.level).toBe(LEVEL.OK);
  });

  it("UNCERTAIN 도 이상 신호로 센다 (digest 예외 집합과 동일 정의)", () => {
    const row = judgeNotify({ reports: [{ adherence_status: "UNCERTAIN" }], notifyLogs: [] });
    expect(row.level).toBe(LEVEL.YELLOW);
  });

  it("어제 리포트가 0건이면 판정 대상 없음(INFO)", () => {
    expect(judgeNotify({ reports: [], notifyLogs: [] }).level).toBe(LEVEL.INFO);
  });

  it("주간 요약 발송 건수도 함께 보여준다", () => {
    const row = judgeNotify({ reports: [{ adherence_status: "DONE" }], notifyLogs: [{ kind: "WEEKLY_DIGEST" }] });
    expect(row.detail).toContain("주간 요약 1건");
  });

  it("조회 실패는 UNKNOWN", () => {
    expect(judgeNotify({ reports: null, notifyLogs: [] }).level).toBe(LEVEL.UNKNOWN);
  });
});

describe("worstLevel / titlePrefix", () => {
  it("RED 가 하나라도 있으면 RED", () => {
    expect(worstLevel([{ level: LEVEL.OK }, { level: LEVEL.YELLOW }, { level: LEVEL.RED }])).toBe(LEVEL.RED);
  });

  it("YELLOW 만 있으면 YELLOW", () => {
    expect(worstLevel([{ level: LEVEL.OK }, { level: LEVEL.YELLOW }])).toBe(LEVEL.YELLOW);
  });

  it("UNKNOWN/INFO 는 경보로 승격하지 않는다", () => {
    expect(worstLevel([{ level: LEVEL.UNKNOWN }, { level: LEVEL.INFO }])).toBe(LEVEL.OK);
  });

  it("제목 접두사는 등급에 따라 붙는다", () => {
    expect(titlePrefix(LEVEL.RED)).toContain("점검 필요");
    expect(titlePrefix(LEVEL.YELLOW)).toBe("🟡 ");
    expect(titlePrefix(LEVEL.OK)).toBe("");
  });
});

describe("buildOpsSection", () => {
  it("세션 #14 상황(발신 침묵 + 워크플로 비활성)을 RED 로 재현한다", () => {
    const { worst, markdown, rows } = buildOpsSection(
      {
        workflows: healthyWorkflows({ [DISPATCH]: { state: "disabled_manually", lastRunAt: null } }),
        sessions: [],
        activeScheduleCount: 6,
        consentedSeniorCount: 2,
        reports: [],
        notifyLogs: [],
      },
      NOW,
    );
    expect(worst).toBe(LEVEL.RED);
    expect(rows).toHaveLength(2 + WORKFLOW_EXPECTATIONS.length);
    expect(markdown).toContain("🩺 운영 상태 (2026-07-29 KST 기준)");
    expect(markdown).toContain("조치 필요");
    expect(markdown).toContain("🔴");
  });

  it("전부 정상이면 초록 문구로 끝난다", () => {
    const { worst, markdown } = buildOpsSection(
      {
        workflows: healthyWorkflows(),
        sessions: [{ status: "COMPLETED", purpose: "SCHEDULE", cost_krw: 60 }],
        activeScheduleCount: 6,
        consentedSeniorCount: 2,
        reports: [{ adherence_status: "DONE" }],
        notifyLogs: [],
      },
      NOW,
    );
    expect(worst).toBe(LEVEL.OK);
    expect(markdown).toContain("이상 없음");
  });

  it("전부 조회 실패해도 섹션은 만들어진다 (fail-soft — 마케팅 리포트를 막지 않는다)", () => {
    const { worst, markdown } = buildOpsSection(
      { workflows: null, sessions: null, activeScheduleCount: null, consentedSeniorCount: null, reports: null, notifyLogs: null },
      NOW,
    );
    expect(worst).toBe(LEVEL.OK); // UNKNOWN 은 경보가 아니다
    expect(markdown).toContain("점검 불가");
  });
});
