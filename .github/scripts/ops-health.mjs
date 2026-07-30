// 운영 상태 판정 (순수 함수 · 외부 의존성 없음).
//
// 왜 필요한가 (PROGRESS.md 세션 #14 "다음 할 일" 3번):
//   call-dispatch 워크플로가 disabled_manually 상태로 12일간 멈춰 있었는데 아무도 몰랐다.
//   daily-report 는 CTA 퍼널·대기자 등 "마케팅 지표"만 담고 있어서 파이프라인 침묵을
//   드러내는 신호가 어디에도 없었다. 여기서 세 가지를 매일 판정한다:
//     ① 워크플로 상태·침묵      (비활성 / 마지막 실행이 너무 오래됨)
//     ② 어제 발신 0건            (활성 일정 + 동의 완료 피보호자가 있는데 세션이 없음)
//     ③ 알림 미발송 의심         (이상 신호 리포트가 있었는데 예외 알림 0건)
//
// 설계 원칙:
//   - **판정과 입출력을 분리**한다. 이 모듈은 fetch 하지 않고 이미 조회된 값만 받아 판정한다
//     (그래서 유닛 테스트가 가능하다 — CLAUDE.md "판정 정확성 코드는 유닛 테스트 필수").
//   - **fail-soft**: 어떤 입력이 null 이면 "점검 불가"로 표시할 뿐 마케팅 리포트를 막지 않는다.
//     운영 감시가 실패해서 일일 리포트 자체가 안 나오면 감시를 더 잃는다.
//   - **억지 판정 금지**(CLAUDE.md 가드레일 정신): 근거가 불충분하면 RED 대신 YELLOW/INFO.
//   - 모든 날짜 경계는 KST(UTC+9). 한국은 DST 가 없어 고정 오프셋으로 계산한다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** 심각도 — 이슈 제목 접두사와 표 아이콘에 쓰인다. */
export const LEVEL = {
  RED: "RED", // 확실한 고장. 사람이 오늘 조치해야 함
  YELLOW: "YELLOW", // 의심 신호. 확인 필요
  OK: "OK", // 정상
  INFO: "INFO", // 정상이지만 맥락 설명이 필요한 상태(예: 발신 대상 자체가 없음)
  UNKNOWN: "UNKNOWN", // 점검 불가(조회 실패)
};

const ICON = {
  RED: "🔴",
  YELLOW: "🟡",
  OK: "🟢",
  INFO: "⚪",
  UNKNOWN: "⚪",
};

/**
 * 감시 대상 워크플로와 "이 정도 안 돌면 침묵으로 본다" 임계.
 *
 * GitHub schedule 은 best-effort 다 — PROGRESS.md 세션 #14 기록대로 10분 주기(uptime)가 실제로는
 * 1~1.5시간 간격으로 돌기도 한다. 그래서 임계를 cron 주기의 몇 배가 아니라 **넉넉한 절대값**으로
 * 잡는다. 목표는 "5분 늦었다"가 아니라 "12일째 안 돈다"를 잡는 것이다.
 */
export const WORKFLOW_EXPECTATIONS = [
  { path: ".github/workflows/call-dispatch.yml", label: "통화 발신 (call-dispatch)", maxSilenceHours: 6 },
  { path: ".github/workflows/uptime.yml", label: "생존 점검 (uptime)", maxSilenceHours: 6 },
  { path: ".github/workflows/daily-report.yml", label: "일일 리포트 (daily-report)", maxSilenceHours: 48 },
  { path: ".github/workflows/weekly-report.yml", label: "주간 요약 메일 (weekly-report)", maxSilenceHours: 24 * 9 },
];

/** 이상 신호로 보는 리포트 판정 — lib/reports/digest.ts 의 예외 집합과 같은 정의. */
const EXCEPTION_STATUSES = new Set(["NOT_DONE", "UNCERTAIN", "MISSED"]);

/**
 * KST 달력 하루의 경계를 UTC ISO 로 돌려준다.
 * @param {Date} now 기준 시각
 * @param {number} offsetDays 0=오늘, -1=어제
 * @returns {{ymd: string, startIso: string, endIso: string}}
 */
export function kstDayRange(now, offsetDays = 0) {
  const shifted = new Date(now.getTime() + KST_OFFSET_MS + offsetDays * 86_400_000);
  const ymd = shifted.toISOString().slice(0, 10);
  // KST 00:00 = UTC 전날 15:00.
  const startMs = Date.parse(`${ymd}T00:00:00.000Z`) - KST_OFFSET_MS;
  return {
    ymd,
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(startMs + 86_400_000).toISOString(),
  };
}

/** 경과 시간을 "3시간"/"12일" 처럼 사람이 읽는 문자열로. */
function humanizeAge(ms) {
  const hours = ms / 3_600_000;
  if (hours < 1) return `${Math.max(1, Math.round(ms / 60_000))}분`;
  if (hours < 48) return `${Math.round(hours)}시간`;
  return `${Math.round(hours / 24)}일`;
}

/**
 * ① 워크플로 상태·침묵 판정.
 *
 * @param {Array<{path: string, state: string, lastRunAt: string|null, lastConclusion: string|null}>|null} workflows
 *        GitHub Actions API 조회 결과(없으면 null → 점검 불가)
 * @param {Date} now
 * @returns {Array<{level: string, label: string, detail: string}>} 대상별 1행
 */
export function judgeWorkflows(workflows, now) {
  if (workflows === null || workflows === undefined) {
    return WORKFLOW_EXPECTATIONS.map((w) => ({
      level: LEVEL.UNKNOWN,
      label: w.label,
      detail: "점검 불가 — GitHub Actions API 조회 실패",
    }));
  }

  return WORKFLOW_EXPECTATIONS.map((expect) => {
    const found = workflows.find((w) => w.path === expect.path);
    if (!found) {
      return { level: LEVEL.YELLOW, label: expect.label, detail: "워크플로를 찾을 수 없음(삭제·경로 변경?)" };
    }

    // state 가 active 가 아니면 스케줄이 아예 돌지 않는다. 12일 침묵의 실제 원인이 이것이었다.
    // disabled_inactivity = 저장소 60일 무활동 시 GitHub 이 스케줄 워크플로를 자동 비활성화한 상태.
    if (found.state !== "active") {
      const reason =
        found.state === "disabled_manually"
          ? "수동 비활성화됨"
          : found.state === "disabled_inactivity"
            ? "저장소 무활동으로 GitHub 이 자동 비활성화함"
            : `상태 ${found.state}`;
      return { level: LEVEL.RED, label: expect.label, detail: `비활성 — ${reason} (실행되지 않음)` };
    }

    if (!found.lastRunAt) {
      return { level: LEVEL.RED, label: expect.label, detail: "활성이지만 실행 이력이 0건" };
    }

    const ageMs = now.getTime() - new Date(found.lastRunAt).getTime();
    const ageText = humanizeAge(ageMs);
    if (ageMs > expect.maxSilenceHours * 3_600_000) {
      return {
        level: LEVEL.RED,
        label: expect.label,
        detail: `침묵 ${ageText}째 — 마지막 실행 이후 임계(${expect.maxSilenceHours}시간) 초과`,
      };
    }
    if (found.lastConclusion && found.lastConclusion !== "success") {
      return { level: LEVEL.YELLOW, label: expect.label, detail: `마지막 실행 ${ageText} 전 · 결과 ${found.lastConclusion}` };
    }
    return { level: LEVEL.OK, label: expect.label, detail: `마지막 실행 ${ageText} 전` };
  });
}

/**
 * ② 어제 발신 판정.
 *
 * "0건"이 항상 고장은 아니다 — 활성 일정이 없거나 동의가 없으면 발신 대상 자체가 없다.
 * 발신이 있어야 할 조건이 갖춰졌는데 0건일 때만 RED 로 올린다.
 *
 * @param {{sessions: Array<{status: string, purpose: string, cost_krw: number|string|null}>|null,
 *          activeScheduleCount: number|null, consentedSeniorCount: number|null}} input
 */
export function judgeDispatch({ sessions, activeScheduleCount, consentedSeniorCount }) {
  if (sessions === null || sessions === undefined) {
    return { level: LEVEL.UNKNOWN, label: "어제 발신", detail: "점검 불가 — call_sessions 조회 실패" };
  }

  const byStatus = new Map();
  let costSum = 0;
  for (const s of sessions) {
    byStatus.set(s.status, (byStatus.get(s.status) ?? 0) + 1);
    const c = Number(s.cost_krw);
    if (Number.isFinite(c)) costSum += c;
  }
  const statusText = [...byStatus.entries()].map(([k, v]) => `${k} ${v}`).join(" · ");
  const costText = costSum > 0 ? ` · 원가 ${Math.round(costSum).toLocaleString("ko-KR")}원` : "";

  if (sessions.length > 0) {
    return { level: LEVEL.OK, label: "어제 발신", detail: `${sessions.length}건 (${statusText})${costText}` };
  }

  // 0건 — 기대치와 대조한다.
  if (activeScheduleCount === null || consentedSeniorCount === null) {
    return { level: LEVEL.YELLOW, label: "어제 발신", detail: "0건 — 기대 발신 건수 조회 실패로 정상 여부 판정 보류" };
  }
  if (activeScheduleCount === 0) {
    return { level: LEVEL.INFO, label: "어제 발신", detail: "0건 — 활성 일정이 없어 발신 대상 없음(정상)" };
  }
  if (consentedSeniorCount === 0) {
    return {
      level: LEVEL.YELLOW,
      label: "어제 발신",
      detail: `0건 — 활성 일정 ${activeScheduleCount}건이 있으나 동의 완료 피보호자가 0명(동의 전이면 정상)`,
    };
  }
  return {
    level: LEVEL.RED,
    label: "어제 발신",
    detail: `0건 — 활성 일정 ${activeScheduleCount}건 · 동의 완료 ${consentedSeniorCount}명이므로 발신이 있어야 함`,
  };
}

/**
 * ③ 알림 발송 판정.
 *
 * notify_log 는 **성공만** 기록한다(0011). 그래서 실패를 직접 볼 수는 없고,
 * "이상 신호 리포트가 있었는데 예외 알림이 0건" 이라는 간접 신호로 잡는다.
 * 보호자가 알림 레벨을 낮춰 두면 정상적으로 0건일 수 있으므로 RED 가 아니라 YELLOW 다.
 *
 * @param {{reports: Array<{adherence_status: string}>|null,
 *          notifyLogs: Array<{kind: string}>|null}} input
 */
export function judgeNotify({ reports, notifyLogs }) {
  if (reports === null || reports === undefined || notifyLogs === null || notifyLogs === undefined) {
    return { level: LEVEL.UNKNOWN, label: "알림 발송", detail: "점검 불가 — call_reports / notify_log 조회 실패" };
  }

  const exceptionCount = reports.filter((r) => EXCEPTION_STATUSES.has(r.adherence_status)).length;
  const alertCount = notifyLogs.filter((n) => n.kind === "EXCEPTION_ALERT").length;
  const weeklyCount = notifyLogs.filter((n) => n.kind === "WEEKLY_DIGEST").length;
  const weeklyText = weeklyCount > 0 ? ` · 주간 요약 ${weeklyCount}건` : "";

  if (exceptionCount > 0 && alertCount === 0) {
    return {
      level: LEVEL.YELLOW,
      label: "알림 발송",
      detail: `이상 신호 리포트 ${exceptionCount}건인데 예외 알림 0건 — 발송 실패 또는 전원 알림 OFF${weeklyText}`,
    };
  }
  if (reports.length === 0) {
    return { level: LEVEL.INFO, label: "알림 발송", detail: `어제 리포트 0건 — 판정 대상 없음${weeklyText}` };
  }
  return {
    level: LEVEL.OK,
    label: "알림 발송",
    detail: `리포트 ${reports.length}건 중 이상 신호 ${exceptionCount}건 · 예외 알림 ${alertCount}건${weeklyText}`,
  };
}

/** 여러 판정 중 가장 심각한 등급. 이슈 제목 접두사를 정하는 데 쓴다. */
export function worstLevel(rows) {
  if (rows.some((r) => r.level === LEVEL.RED)) return LEVEL.RED;
  if (rows.some((r) => r.level === LEVEL.YELLOW)) return LEVEL.YELLOW;
  return LEVEL.OK;
}

/**
 * 운영 상태 섹션 전체를 만든다.
 * @returns {{rows: Array, worst: string, markdown: string}}
 */
export function buildOpsSection({ workflows, sessions, activeScheduleCount, consentedSeniorCount, reports, notifyLogs }, now) {
  const { ymd } = kstDayRange(now, -1);
  const rows = [
    judgeDispatch({ sessions, activeScheduleCount, consentedSeniorCount }),
    judgeNotify({ reports, notifyLogs }),
    ...judgeWorkflows(workflows, now),
  ];
  const worst = worstLevel(rows);

  const lines = [];
  lines.push(`## 🩺 운영 상태 (${ymd} KST 기준)`);
  lines.push("");
  lines.push("| 항목 | 상태 | 내용 |");
  lines.push("| --- | :---: | --- |");
  for (const r of rows) {
    lines.push(`| ${r.label} | ${ICON[r.level]} | ${r.detail} |`);
  }
  lines.push("");
  if (worst === LEVEL.RED) {
    lines.push("> 🔴 **조치 필요** — 위 빨간 항목은 자동 복구되지 않는다. 오늘 안에 확인할 것.");
  } else if (worst === LEVEL.YELLOW) {
    lines.push("> 🟡 확인 권장 — 정상일 수도 있으나 근거가 불충분해 판정을 보류한 항목이 있다.");
  } else {
    lines.push("> 🟢 파이프라인·워크플로 이상 없음.");
  }
  lines.push("");

  return { rows, worst, markdown: lines.join("\n") };
}

/** 이슈 제목 접두사. 메일 알림 제목만 보고도 고장을 알 수 있게 한다. */
export function titlePrefix(worst) {
  if (worst === LEVEL.RED) return "🔴 [점검 필요] ";
  if (worst === LEVEL.YELLOW) return "🟡 ";
  return "";
}
