import { describe, it, expect } from "vitest";
import type { Senior, Schedule } from "@/lib/contracts/domain";
import type { LlmClient } from "@/lib/ai/llm";
import type { GeneratedReport } from "@/lib/ai/report";
import {
  planCallbackAction,
  processCallback,
  deriveCallWindow,
  type CallbackStore,
  type CallbackSessionRow,
  type SessionPatch,
} from "./callback-handler";
import type { CallbackTurn, TelephonyCallbackPayload } from "./callback";

const NOW = new Date("2026-07-15T09:00:00+09:00");

// ── planCallbackAction (순수) ─────────────────────────────────────────────────
describe("planCallbackAction — 멱등(종결 세션)", () => {
  it("COMPLETED/MISSED 세션은 어떤 이벤트든 IGNORE_TERMINAL", () => {
    for (const status of ["COMPLETED", "MISSED"] as const) {
      for (const ev of ["ANSWERED", "NO_ANSWER", "COMPLETED", "FAILED"] as const) {
        expect(planCallbackAction({ status, attempt: 1 }, ev, NOW)).toEqual({
          kind: "IGNORE_TERMINAL",
        });
      }
    }
  });
});

describe("planCallbackAction — 상태 전이", () => {
  it("ANSWERED → MARK_IN_PROGRESS", () => {
    expect(planCallbackAction({ status: "DIALING", attempt: 1 }, "ANSWERED", NOW)).toEqual({
      kind: "MARK_IN_PROGRESS",
    });
  });
  it("COMPLETED → COMPLETE", () => {
    expect(planCallbackAction({ status: "IN_PROGRESS", attempt: 1 }, "COMPLETED", NOW)).toEqual({
      kind: "COMPLETE",
    });
  });
});

describe("planCallbackAction — 무응답/실패 재시도(1분/10분→MISSED)", () => {
  it("attempt 1 무응답 → RETRY nextAttempt 2, +1분", () => {
    const a = planCallbackAction({ status: "DIALING", attempt: 1 }, "NO_ANSWER", NOW);
    expect(a).toEqual({
      kind: "RETRY",
      nextAttempt: 2,
      nextAttemptAtIso: new Date(NOW.getTime() + 60_000).toISOString(),
    });
  });
  it("attempt 2 실패 → RETRY nextAttempt 3, +10분", () => {
    const a = planCallbackAction({ status: "DIALING", attempt: 2 }, "FAILED", NOW);
    expect(a).toEqual({
      kind: "RETRY",
      nextAttempt: 3,
      nextAttemptAtIso: new Date(NOW.getTime() + 600_000).toISOString(),
    });
  });
  it("attempt 3(마지막) 무응답 → MARK_MISSED", () => {
    expect(planCallbackAction({ status: "DIALING", attempt: 3 }, "NO_ANSWER", NOW)).toEqual({
      kind: "MARK_MISSED",
    });
  });
});

describe("deriveCallWindow", () => {
  it("턴 없으면 now 로 대체", () => {
    const w = deriveCallWindow([], NOW);
    expect(w.startedAt).toBe(NOW.toISOString());
    expect(w.endedAt).toBe(NOW.toISOString());
  });
  it("첫/마지막 턴 시각 사용", () => {
    const turns: CallbackTurn[] = [
      { role: "SYSTEM", input_kind: "VOICE", text: "a", at: "2026-07-15T09:00:00+09:00" },
      { role: "SENIOR", input_kind: "VOICE", text: "b", at: "2026-07-15T09:00:10+09:00" },
    ];
    expect(deriveCallWindow(turns, NOW)).toEqual({
      startedAt: "2026-07-15T09:00:00+09:00",
      endedAt: "2026-07-15T09:00:10+09:00",
    });
  });
});

// ── processCallback (주입 store) ──────────────────────────────────────────────
const STUB_LLM: LlmClient = { complete: async () => null, callsUsed: () => 0 };

function makeSenior(over: Partial<Senior> = {}): Senior {
  return {
    id: "senior-1",
    name: "김부모",
    phone: "010-1234-5678",
    relationship: "모",
    birth_year: 1950,
    consent_at: "2026-07-01T00:00:00+09:00",
    consent_by: "guardian-1",
    self_consent_at: null,
    created_at: "2026-07-01T00:00:00+09:00",
    ...over,
  };
}

function makeSchedule(): Schedule {
  return {
    id: "sched-1",
    senior_id: "senior-1",
    type: "MEDICATION",
    title: "혈압약",
    script_template: "혈압약",
    call_time: "09:00",
    rrule: "FREQ=DAILY",
    active: true,
    created_at: "2026-07-01T00:00:00+09:00",
  };
}

class FakeStore implements CallbackStore {
  session: CallbackSessionRow | null;
  senior: Senior;
  schedule: Schedule | null;
  turns: CallbackTurn[] = [];
  report: GeneratedReport | null = null;
  selfConsentAt: string | null = null;
  patches: SessionPatch[] = [];

  constructor(session: CallbackSessionRow | null, senior: Senior, schedule: Schedule | null) {
    this.session = session;
    this.senior = senior;
    this.schedule = schedule;
  }
  async getSession(): Promise<CallbackSessionRow | null> {
    return this.session;
  }
  async getSenior(): Promise<Senior | null> {
    return this.senior;
  }
  async getSchedule(): Promise<Schedule | null> {
    return this.schedule;
  }
  async updateSession(_id: string, patch: SessionPatch): Promise<void> {
    this.patches.push(patch);
    if (this.session) this.session = { ...this.session, ...patch } as CallbackSessionRow;
  }
  async insertTurns(_id: string, turns: readonly CallbackTurn[]): Promise<void> {
    this.turns.push(...turns);
  }
  async reportExists(): Promise<boolean> {
    return this.report != null;
  }
  async insertReport(_id: string, report: GeneratedReport): Promise<void> {
    this.report = report;
  }
  async setSelfConsent(_seniorId: string, atIso: string): Promise<void> {
    this.selfConsentAt = atIso;
  }
}

const scheduleSession = (over: Partial<CallbackSessionRow> = {}): CallbackSessionRow => ({
  id: "sess-1",
  purpose: "SCHEDULE",
  schedule_id: "sched-1",
  senior_id: "senior-1",
  status: "DIALING",
  attempt: 1,
  ...over,
});

const completeTurns: CallbackTurn[] = [
  { role: "SYSTEM", input_kind: "VOICE", text: "혈압약 확인", at: "2026-07-15T09:00:00+09:00" },
  { role: "SENIOR", input_kind: "DTMF", text: "1", at: "2026-07-15T09:00:05+09:00" },
  { role: "SYSTEM", input_kind: "VOICE", text: "기분은?", at: "2026-07-15T09:00:10+09:00" },
  { role: "SENIOR", input_kind: "VOICE", text: "좋아요", at: "2026-07-15T09:00:15+09:00" },
];

function payload(over: Partial<TelephonyCallbackPayload>): TelephonyCallbackPayload {
  return {
    session_id: "sess-1",
    event: "COMPLETED",
    turns: [],
    ...over,
  } as TelephonyCallbackPayload;
}

describe("processCallback — 세션 없음", () => {
  it("not_found", async () => {
    const store = new FakeStore(null, makeSenior(), makeSchedule());
    const r = await processCallback(payload({ event: "COMPLETED" }), { store, llm: STUB_LLM, now: NOW });
    expect(r).toEqual({ status: "not_found" });
  });
});

describe("processCallback — COMPLETED(SCHEDULE)", () => {
  it("전사 저장 + DONE 리포트 + COMPLETED + cost(vendor+LLM)", async () => {
    const store = new FakeStore(scheduleSession(), makeSenior(), makeSchedule());
    const r = await processCallback(
      payload({ event: "COMPLETED", turns: completeTurns, cost_krw: 40 }),
      { store, llm: STUB_LLM, now: NOW },
    );
    expect(r).toEqual({ status: "ok", action: "COMPLETE" });
    expect(store.turns).toHaveLength(4);
    expect(store.report?.adherence_status).toBe("DONE");
    const last = store.patches.at(-1)!;
    expect(last.status).toBe("COMPLETED");
    expect(last.cost_krw).toBe(40); // LLM 스텁 0원
    expect(last.ended_at).toBe("2026-07-15T09:00:15+09:00");
  });
});

describe("processCallback — COMPLETED(CONSENT)", () => {
  it("동의(DTMF 1) → self_consent_at 기록, 리포트 없음", async () => {
    const session = scheduleSession({ purpose: "CONSENT", schedule_id: null });
    const store = new FakeStore(session, makeSenior(), null);
    const consentTurns: CallbackTurn[] = [
      { role: "SYSTEM", input_kind: "VOICE", text: "동의?", at: "2026-07-15T09:00:00+09:00" },
      { role: "SENIOR", input_kind: "DTMF", text: "1", at: "2026-07-15T09:00:05+09:00" },
    ];
    await processCallback(payload({ event: "COMPLETED", turns: consentTurns, cost_krw: 20 }), {
      store,
      llm: STUB_LLM,
      now: NOW,
    });
    expect(store.report).toBeNull();
    expect(store.selfConsentAt).toBe("2026-07-15T09:00:05+09:00");
    expect(store.patches.at(-1)!.cost_krw).toBe(20);
  });

  it("거부(DTMF 2) → self_consent 미기록", async () => {
    const session = scheduleSession({ purpose: "CONSENT", schedule_id: null });
    const store = new FakeStore(session, makeSenior(), null);
    const turns: CallbackTurn[] = [
      { role: "SENIOR", input_kind: "DTMF", text: "2", at: "2026-07-15T09:00:05+09:00" },
    ];
    await processCallback(payload({ event: "COMPLETED", turns }), { store, llm: STUB_LLM, now: NOW });
    expect(store.selfConsentAt).toBeNull();
  });
});

describe("processCallback — 무응답 재시도/멱등", () => {
  it("NO_ANSWER attempt1 → SCHEDULED, attempt2, next_attempt_at +1분", async () => {
    const store = new FakeStore(scheduleSession({ status: "DIALING", attempt: 1 }), makeSenior(), makeSchedule());
    const r = await processCallback(payload({ event: "NO_ANSWER" }), { store, llm: STUB_LLM, now: NOW });
    expect(r).toEqual({ status: "ok", action: "RETRY" });
    const p = store.patches.at(-1)!;
    expect(p.status).toBe("SCHEDULED");
    expect(p.attempt).toBe(2);
    expect(p.next_attempt_at).toBe(new Date(NOW.getTime() + 60_000).toISOString());
  });

  it("attempt3 실패 → MISSED + MISSED 리포트(SCHEDULE)", async () => {
    const store = new FakeStore(scheduleSession({ status: "DIALING", attempt: 3 }), makeSenior(), makeSchedule());
    const r = await processCallback(payload({ event: "FAILED" }), { store, llm: STUB_LLM, now: NOW });
    expect(r).toEqual({ status: "ok", action: "MARK_MISSED" });
    expect(store.patches.at(-1)!.status).toBe("MISSED");
    expect(store.report?.adherence_status).toBe("MISSED");
  });

  it("이미 COMPLETED 세션에 중복 콜백 → ignored, 이중 리포트/전이 없음", async () => {
    const store = new FakeStore(scheduleSession({ status: "COMPLETED" }), makeSenior(), makeSchedule());
    const r = await processCallback(payload({ event: "COMPLETED", turns: completeTurns }), {
      store,
      llm: STUB_LLM,
      now: NOW,
    });
    expect(r).toEqual({ status: "ignored", reason: "terminal" });
    expect(store.turns).toHaveLength(0);
    expect(store.report).toBeNull();
    expect(store.patches).toHaveLength(0);
  });
});
