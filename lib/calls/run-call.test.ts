import { describe, it, expect } from "vitest";
import type { Senior, Schedule } from "@/lib/contracts/domain";
import type { CollectedTurn } from "@/lib/telephony/types";
import { MockAdapter } from "@/lib/telephony/mock-adapter";
import { createLlmClient } from "@/lib/ai/llm";
import {
  runScheduleCall,
  runConsentCall,
  splitAtFreeForm,
  classifyAndReportSchedule,
} from "./run-call";
import { MOOD_LEAD, MOOD_QUESTION, CHAT_TURNS } from "./warm-talk";

const CLOCK = () => new Date("2026-07-15T00:00:00.000Z"); // 09:00 KST 고정 앵커
const stubLlm = () => createLlmClient(undefined); // 키 없음 → 룰/템플릿만

const senior: Senior = {
  id: "a0000000-0000-4000-8000-000000000001",
  name: "김순자",
  phone: "010-1234-5678",
  relationship: "모",
  birth_year: 1948,
  consent_at: "2026-06-20T10:00:00+09:00",
  consent_by: "11111111-1111-4111-8111-111111111111",
  self_consent_at: "2026-06-20T10:00:00+09:00",
  created_at: "2026-06-20T09:58:00+09:00",
};

const schedule: Schedule = {
  id: "b0000000-0000-4000-8000-000000000001",
  senior_id: senior.id,
  type: "MEDICATION",
  title: "혈압약",
  script_template: "혈압약 드실 시간이에요",
  call_time: "09:00",
  rrule: "FREQ=DAILY",
  active: true,
  created_at: "2026-06-20T10:00:00+09:00",
};

function runSchedule(scenarioId: string) {
  return runScheduleCall({
    sessionId: "c0000000-0000-4000-8000-000000000001",
    senior,
    schedule,
    adapter: new MockAdapter(scenarioId),
    llm: stubLlm(),
    clock: CLOCK,
  });
}

describe("runScheduleCall — 시나리오별 판정", () => {
  it("명확 긍정 → COMPLETED / DONE, 턴·원가 기록", async () => {
    const r = await runSchedule("clear_positive");
    expect(r.status).toBe("COMPLETED");
    expect(r.report.adherence_status).toBe("DONE");
    expect(r.turns.length).toBeGreaterThan(0);
    expect(r.costKrw).toBeGreaterThan(0);
    expect(r.startedAt).not.toBeNull();
  });

  it("DTMF 1 → DONE", async () => {
    const r = await runSchedule("dtmf_positive");
    expect(r.report.adherence_status).toBe("DONE");
  });

  it("명확 부정 → NOT_DONE", async () => {
    const r = await runSchedule("clear_negative");
    expect(r.report.adherence_status).toBe("NOT_DONE");
  });

  it("연기 → POSTPONED", async () => {
    const r = await runSchedule("postpone");
    expect(r.report.adherence_status).toBe("POSTPONED");
  });

  it("모호/웅얼(재질문 후에도 모호) → UNCERTAIN (억지 판정 금지)", async () => {
    const r = await runSchedule("ambiguous_mumble");
    expect(r.report.adherence_status).toBe("UNCERTAIN");
    expect(r.report.mood_flag).toBe(true); // 기분 응답 "외롭네"
  });

  it("사투리 부정 → NOT_DONE, 건강 언급 감지", async () => {
    const r = await runSchedule("dialect_negative");
    expect(r.report.adherence_status).toBe("NOT_DONE");
    expect(r.report.health_flag).toBe(true); // 기분 응답 "무릎이 아파"
  });

  it("무응답 → MISSED, attempt 3, 원가 0, 턴 없음", async () => {
    const r = await runSchedule("no_answer");
    expect(r.status).toBe("MISSED");
    expect(r.attempt).toBe(3);
    expect(r.costKrw).toBe(0);
    expect(r.turns).toHaveLength(0);
    expect(r.report.adherence_status).toBe("MISSED");
  });
});

function runConsent(scenarioId: string) {
  return runConsentCall({
    sessionId: "c0000000-0000-4000-8000-000000000002",
    senior: { ...senior, self_consent_at: null },
    adapter: new MockAdapter(scenarioId),
    clock: CLOCK,
  });
}

describe("runConsentCall — 본인 동의 판정", () => {
  it("DTMF 1 동의 → granted", async () => {
    const r = await runConsent("consent_dtmf_yes");
    expect(r.status).toBe("COMPLETED");
    expect(r.consentGranted).toBe(true);
  });
  it("음성 동의 → granted", async () => {
    const r = await runConsent("consent_voice_yes");
    expect(r.consentGranted).toBe(true);
  });
  it("거부 → not granted", async () => {
    const r = await runConsent("consent_refuse");
    expect(r.consentGranted).toBe(false);
  });
  it("무응답 → MISSED, not granted", async () => {
    const r = await runConsent("consent_no_answer");
    expect(r.status).toBe("MISSED");
    expect(r.consentGranted).toBe(false);
  });
});

// ── 따뜻한 대화 확장: 자유 발화가 이행 판정을 오염시키지 않아야 한다 ────────────────
let seq = 0;
function turn(role: "SYSTEM" | "SENIOR", text: string, input_kind: "VOICE" | "DTMF" = "VOICE"): CollectedTurn {
  return { role, input_kind, text, at: new Date(Date.UTC(2026, 6, 15, 0, 0, seq++)).toISOString() };
}
/** VoiceML 실경로 모사: intro → 일정응답 → (기분+일상 SYSTEM) → 전사 자유발화 SENIOR 턴. */
function warmScheduleTurns(scheduleAnswer: CollectedTurn, freeForm: string[]): CollectedTurn[] {
  seq = 0;
  return [
    turn("SYSTEM", "혈압약 확인 전화예요."),
    scheduleAnswer,
    turn("SYSTEM", `${MOOD_LEAD} ${MOOD_QUESTION}`),
    turn("SYSTEM", `${CHAT_TURNS[0].ack} ${CHAT_TURNS[0].question}`),
    turn("SYSTEM", `${CHAT_TURNS[1].ack} ${CHAT_TURNS[1].question}`),
    // 전사로 뒤늦게 붙는 자유 발화(종결부 SYSTEM 턴 이후 순서).
    ...freeForm.map((t) => turn("SENIOR", t)),
  ];
}

describe("splitAtFreeForm — 자유 발화 경계 분리", () => {
  it("기분 질문(마커) 이전 SENIOR = adherence, 이후 = free-form", () => {
    const turns = warmScheduleTurns(turn("SENIOR", "어 잘 모르겠네"), ["그냥 그래", "밥 먹었어요"]);
    const split = splitAtFreeForm(turns);
    expect(split).not.toBeNull();
    expect(split!.adherence.map((r) => r.text)).toEqual(["어 잘 모르겠네"]);
    expect(split!.freeForm.map((r) => r.text)).toEqual(["그냥 그래", "밥 먹었어요"]);
  });

  it("경계 마커 없으면 null(구형/테스트 턴 → 호출자 폴백)", () => {
    seq = 0;
    const turns = [turn("SYSTEM", "기분은?"), turn("SENIOR", "좋아요")];
    expect(splitAtFreeForm(turns)).toBeNull();
  });
});

describe("classifyAndReportSchedule — 자유 발화 오염 차단(억지 판정 금지)", () => {
  const stub = () => createLlmClient(undefined);

  it("모호한 일정 응답 + '밥 먹었어요' 자유 발화 → DONE 아님(UNCERTAIN), flag 는 감지", async () => {
    // "밥 먹었어요"는 POSITIVE_MARKERS('먹었')를 포함 — 판정에 섞이면 DONE 오염.
    const turns = warmScheduleTurns(turn("SENIOR", "어 잘 모르겠네"), [
      "그냥 좀 외롭고 그래", // 기분(mood_flag)
      "네 밥 잘 먹었어요", // 일상(오염 유발 후보)
      "요즘 무릎이 좀 아파", // 일상(health_flag)
    ]);
    const { report } = await classifyAndReportSchedule({
      turns,
      scheduleTitle: "혈압약",
      answered: true,
      attempts: 1,
      llm: stub(),
    });
    expect(report.adherence_status).toBe("UNCERTAIN"); // 오염 없음
    expect(report.mood_flag).toBe(true); // "외롭"
    expect(report.health_flag).toBe(true); // "무릎", "아파"
    // 일상 대화가 요약에 반영(템플릿 경로).
    expect(report.summary).toContain("일상 대화");
  });

  it("DTMF 1 일정 응답 → DONE (자유 발화의 부정 키워드에 흔들리지 않음)", async () => {
    const turns = warmScheduleTurns(turn("SENIOR", "1", "DTMF"), [
      "아직 산책은 안 했어", // '안했' 부정 — 판정에 섞이면 NOT_DONE 오염
    ]);
    const { report } = await classifyAndReportSchedule({
      turns,
      scheduleTitle: "혈압약",
      answered: true,
      attempts: 1,
      llm: stub(),
    });
    expect(report.adherence_status).toBe("DONE");
  });
});
