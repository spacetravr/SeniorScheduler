import { describe, it, expect } from "vitest";
import type { Senior, Schedule } from "@/lib/contracts/domain";
import type { LlmClient } from "@/lib/ai/llm";
import type { GeneratedReport } from "@/lib/ai/report";
import {
  processCallback,
  type CallbackStore,
  type CallbackSessionRow,
  type SessionPatch,
} from "./callback-handler";
import type { CallbackTurn, TelephonyCallbackPayload } from "./callback";

/**
 * ClawOps 모델: 웹훅에 전사가 없다. DTMF 는 VoiceML 이 call_turns 에 저장했고, 전사는 콜백이
 * 별도 확보해 먼저 적재한다. 따라서 COMPLETE 는 payload.turns(빈 배열) 대신 getExistingTurns
 * (DB 적재분)로 분류하고, 재삽입하지 않는다.
 */

const NOW = new Date("2026-07-16T09:00:00+09:00");
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

class DbTurnStore implements CallbackStore {
  inserted: CallbackTurn[] = [];
  report: GeneratedReport | null = null;
  selfConsentAt: string | null = null;
  patches: SessionPatch[] = [];
  constructor(
    private session: CallbackSessionRow | null,
    private senior: Senior,
    private schedule: Schedule | null,
    private existing: CallbackTurn[],
  ) {}
  async getSession() {
    return this.session;
  }
  async getSenior() {
    return this.senior;
  }
  async getSchedule() {
    return this.schedule;
  }
  async updateSession(_id: string, patch: SessionPatch) {
    this.patches.push(patch);
    if (this.session) this.session = { ...this.session, ...patch } as CallbackSessionRow;
  }
  async insertTurns(_id: string, turns: readonly CallbackTurn[]) {
    this.inserted.push(...turns);
  }
  async reportExists() {
    return this.report != null;
  }
  async insertReport(_id: string, report: GeneratedReport) {
    this.report = report;
  }
  async setSelfConsent(_id: string, atIso: string) {
    this.selfConsentAt = atIso;
  }
  async getExistingTurns() {
    return this.existing;
  }
}

const scheduleSession = (over: Partial<CallbackSessionRow> = {}): CallbackSessionRow => ({
  id: "sess-1",
  purpose: "SCHEDULE",
  schedule_id: "sched-1",
  senior_id: "senior-1",
  status: "IN_PROGRESS",
  attempt: 1,
  ...over,
});

function payload(over: Partial<TelephonyCallbackPayload>): TelephonyCallbackPayload {
  return { session_id: "sess-1", event: "COMPLETED", turns: [], ...over } as TelephonyCallbackPayload;
}

describe("processCallback(ClawOps) — DB 턴 소스 + 재삽입 없음", () => {
  it("SCHEDULE COMPLETED: getExistingTurns(DTMF 1 + 기분)로 DONE 분류, 재삽입 안 함, cost=vendor", async () => {
    const existing: CallbackTurn[] = [
      { role: "SYSTEM", input_kind: "VOICE", text: "혈압약 확인", at: "2026-07-16T09:00:00+09:00" },
      { role: "SENIOR", input_kind: "DTMF", text: "1", at: "2026-07-16T09:00:05+09:00" },
      { role: "SYSTEM", input_kind: "VOICE", text: "기분은?", at: "2026-07-16T09:00:10+09:00" },
      { role: "SENIOR", input_kind: "VOICE", text: "좋아요", at: "2026-07-16T09:00:15+09:00" },
    ];
    const store = new DbTurnStore(scheduleSession(), makeSenior(), makeSchedule(), existing);
    const r = await processCallback(payload({ cost_krw: 70 }), { store, llm: STUB_LLM, now: NOW });

    expect(r).toEqual({ status: "ok", action: "COMPLETE" });
    expect(store.inserted).toHaveLength(0); // 재삽입 없음(이미 DB 에 있음)
    expect(store.report?.adherence_status).toBe("DONE");
    const last = store.patches.at(-1)!;
    expect(last.status).toBe("COMPLETED");
    expect(last.cost_krw).toBe(70);
    expect(last.started_at).toBe("2026-07-16T09:00:00+09:00");
    expect(last.ended_at).toBe("2026-07-16T09:00:15+09:00");
  });

  it("전사 미확보(DTMF 2만): NOT_DONE 분류 가능(DTMF 우선)", async () => {
    const existing: CallbackTurn[] = [
      { role: "SENIOR", input_kind: "DTMF", text: "2", at: "2026-07-16T09:00:05+09:00" },
    ];
    const store = new DbTurnStore(scheduleSession(), makeSenior(), makeSchedule(), existing);
    await processCallback(payload({ cost_krw: 60 }), { store, llm: STUB_LLM, now: NOW });
    expect(store.report?.adherence_status).toBe("NOT_DONE");
  });

  it("CONSENT COMPLETED: getExistingTurns(DTMF 1) → self_consent 기록", async () => {
    const existing: CallbackTurn[] = [
      { role: "SENIOR", input_kind: "DTMF", text: "1", at: "2026-07-16T09:00:05+09:00" },
    ];
    const store = new DbTurnStore(
      scheduleSession({ purpose: "CONSENT", schedule_id: null }),
      makeSenior(),
      null,
      existing,
    );
    await processCallback(payload({ cost_krw: 60 }), { store, llm: STUB_LLM, now: NOW });
    expect(store.report).toBeNull();
    expect(store.selfConsentAt).toBe("2026-07-16T09:00:05+09:00");
  });
});
