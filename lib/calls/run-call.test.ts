import { describe, it, expect } from "vitest";
import type { Senior, Schedule } from "@/lib/contracts/domain";
import { MockAdapter } from "@/lib/telephony/mock-adapter";
import { createLlmClient } from "@/lib/ai/llm";
import { runScheduleCall, runConsentCall } from "./run-call";

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
