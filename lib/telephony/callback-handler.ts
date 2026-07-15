import type { Senior, Schedule } from "@/lib/contracts/domain";
import type { LlmClient } from "@/lib/ai/llm";
import {
  canRetry,
  retryDelayMs,
  isTerminal,
  type CallStatus,
} from "@/lib/calls/state-machine";
import { classifyAndReportSchedule, evaluateConsentGranted } from "@/lib/calls/run-call";
import type { GeneratedReport } from "@/lib/ai/report";
import type { CallbackTurn, TelephonyCallbackPayload } from "./callback";

/**
 * 벤더 중립 콜백 처리 (CLAUDE.md `## 전화 발신` 상태 기계·재시도, 가드레일 5).
 *
 * 실벤더 콜백(ANSWERED/NO_ANSWER/COMPLETED/FAILED)을 받아 call_sessions 상태를 전이하고,
 * COMPLETED 면 기존 분류·리포트 로직(lib/calls)을 재사용해 리포트/동의를 기록한다.
 *
 * 순수 판정부(planCallbackAction)와 부수효과부(processCallback)를 분리한다:
 *   - planCallbackAction: 상태 전이·재시도·멱등 결정을 순수 함수로 → 유닛 테스트 대상.
 *   - processCallback: 주입된 store 로 DB 반영. 라우트가 Supabase admin 구현을 주입.
 *
 * 시간대(CLAUDE.md): 재시도 예정 시각은 now(주입) 기준 절대 instant(ISO). 처리부는 Asia/Seoul
 * 명시가 필요한 표시 계층이 아니라 instant 비교만 하므로 오프셋 있는 ISO 로 일관 처리.
 */

// ── 순수 판정: 콜백 이벤트 → 세션에 취할 액션 ────────────────────────────────────
export type CallbackAction =
  /** 이미 종결(COMPLETED/MISSED)된 세션 — 중복 콜백. 아무것도 하지 않음(멱등). */
  | { kind: "IGNORE_TERMINAL" }
  /** 상대 응답 통지 — 진행중(IN_PROGRESS)으로. */
  | { kind: "MARK_IN_PROGRESS" }
  /** 무응답/실패 + 재시도 여지 있음 — SCHEDULED 로 되돌리고 next_attempt_at 예약. */
  | { kind: "RETRY"; nextAttempt: number; nextAttemptAtIso: string }
  /** 무응답/실패 + 재시도 소진 — MISSED. */
  | { kind: "MARK_MISSED" }
  /** 통화 정상 종료 — 전사 저장 + 분류/리포트/동의 기록. */
  | { kind: "COMPLETE" };

/**
 * 세션 현재 상태 + 콜백 이벤트 + now → 취할 액션.
 * 멱등: 이미 종결된 세션이면 어떤 이벤트든 IGNORE_TERMINAL(이중 리포트/이중 전이 방지).
 * 재시도: NO_ANSWER/FAILED 에서 canRetry(attempt) 면 지연(1분/10분) 후 재시도 예약.
 */
export function planCallbackAction(
  session: { status: CallStatus; attempt: number },
  event: TelephonyCallbackPayload["event"],
  now: Date,
): CallbackAction {
  if (isTerminal(session.status)) return { kind: "IGNORE_TERMINAL" };

  switch (event) {
    case "ANSWERED":
      return { kind: "MARK_IN_PROGRESS" };
    case "COMPLETED":
      return { kind: "COMPLETE" };
    case "NO_ANSWER":
    case "FAILED": {
      if (!canRetry(session.attempt)) return { kind: "MARK_MISSED" };
      const delay = retryDelayMs(session.attempt) ?? 0;
      return {
        kind: "RETRY",
        nextAttempt: session.attempt + 1,
        nextAttemptAtIso: new Date(now.getTime() + delay).toISOString(),
      };
    }
    default:
      // 도달 불가(zod enum) — 방어적으로 무시.
      return { kind: "IGNORE_TERMINAL" };
  }
}

/** 전사 턴에서 통화 시작/종료 instant 추정. 턴 없으면 now 로 대체. */
export function deriveCallWindow(
  turns: readonly CallbackTurn[],
  now: Date,
): { startedAt: string; endedAt: string } {
  if (turns.length === 0) {
    const iso = now.toISOString();
    return { startedAt: iso, endedAt: iso };
  }
  return { startedAt: turns[0].at, endedAt: turns[turns.length - 1].at };
}

// ── 부수효과: 주입 store 로 DB 반영 ──────────────────────────────────────────────
export type CallbackSessionRow = {
  id: string;
  purpose: "SCHEDULE" | "CONSENT";
  schedule_id: string | null;
  senior_id: string;
  status: CallStatus;
  attempt: number;
};

export type SessionPatch = {
  status?: CallStatus;
  attempt?: number;
  started_at?: string | null;
  ended_at?: string | null;
  cost_krw?: number | null;
  next_attempt_at?: string | null;
};

/** 콜백 처리에 필요한 저장소 추상화 — 라우트가 Supabase admin 구현을 주입(테스트는 mock). */
export interface CallbackStore {
  getSession(sessionId: string): Promise<CallbackSessionRow | null>;
  getSenior(seniorId: string): Promise<Senior | null>;
  getSchedule(scheduleId: string): Promise<Schedule | null>;
  updateSession(sessionId: string, patch: SessionPatch): Promise<void>;
  insertTurns(sessionId: string, turns: readonly CallbackTurn[]): Promise<void>;
  /** 세션에 리포트가 이미 있는지(멱등 보조). */
  reportExists(sessionId: string): Promise<boolean>;
  insertReport(sessionId: string, report: GeneratedReport): Promise<void>;
  setSelfConsent(seniorId: string, atIso: string): Promise<void>;
  /**
   * 세션에 이미 저장된 턴 조회(created_at 오름차순) — 선택적.
   *
   * ClawOps 등 "웹훅에 전사가 실리지 않는" 벤더 모델용: DTMF 턴은 VoiceML 스텝에서, 전사는
   * 콜백이 별도 API 로 확보해 call_turns 에 먼저 적재한다. 이 경우 COMPLETE 처리는 payload.turns
   * 대신 DB 에 적재된 턴으로 분류한다(중복 insert 방지). 미구현(generic/clova 모델)이면 undefined.
   */
  getExistingTurns?(sessionId: string): Promise<CallbackTurn[]>;
}

export type CallbackResult =
  | { status: "ok"; action: CallbackAction["kind"] }
  | { status: "not_found" }
  | { status: "ignored"; reason: "terminal" };

/**
 * 콜백 1건 처리(멱등). now/llm 주입(테스트 재현성·가드레일 3).
 * 반환값은 라우트가 그대로 응답 바디로 쓸 수 있는 간단한 결과.
 */
export async function processCallback(
  payload: TelephonyCallbackPayload,
  deps: { store: CallbackStore; llm: LlmClient; now: Date },
): Promise<CallbackResult> {
  const { store, llm, now } = deps;

  const session = await store.getSession(payload.session_id);
  if (!session) return { status: "not_found" };

  const action = planCallbackAction(session, payload.event, now);

  switch (action.kind) {
    case "IGNORE_TERMINAL":
      return { status: "ignored", reason: "terminal" };

    case "MARK_IN_PROGRESS":
      await store.updateSession(session.id, { status: "IN_PROGRESS" });
      return { status: "ok", action: action.kind };

    case "RETRY":
      // scheduled_at 은 건드리지 않는다(dedup 안정). status/attempt/next_attempt_at 만 갱신.
      await store.updateSession(session.id, {
        status: "SCHEDULED",
        attempt: action.nextAttempt,
        next_attempt_at: action.nextAttemptAtIso,
      });
      return { status: "ok", action: action.kind };

    case "MARK_MISSED": {
      await store.updateSession(session.id, { status: "MISSED", next_attempt_at: null });
      // SCHEDULE 콜은 MISSED 리포트를 남긴다(대시보드 일관성). CONSENT 는 리포트 없음.
      if (session.purpose === "SCHEDULE" && !(await store.reportExists(session.id))) {
        const { report } = await classifyAndReportSchedule({
          turns: [],
          scheduleTitle: await scheduleTitleOf(store, session),
          answered: false,
          attempts: session.attempt,
          llm,
        });
        await store.insertReport(session.id, report);
      }
      return { status: "ok", action: action.kind };
    }

    case "COMPLETE":
      return completeCall(payload, session, deps);

    default:
      return { status: "ignored", reason: "terminal" };
  }
}

/** 스케줄 제목 조회(없으면 빈 문자열 — 리포트 문구는 방어적으로 처리). */
async function scheduleTitleOf(store: CallbackStore, session: CallbackSessionRow): Promise<string> {
  if (!session.schedule_id) return "";
  const schedule = await store.getSchedule(session.schedule_id);
  return schedule?.title ?? "";
}

/** COMPLETED 처리 — 전사 저장 + (SCHEDULE)분류/리포트 or (CONSENT)동의 기록. */
async function completeCall(
  payload: TelephonyCallbackPayload,
  session: CallbackSessionRow,
  deps: { store: CallbackStore; llm: LlmClient; now: Date },
): Promise<CallbackResult> {
  const { store, llm, now } = deps;
  const vendorCost = payload.cost_krw ?? 0; // 회선+STT+TTS(벤더 산정). LLM 은 아래서 합산.

  // 턴 소스 결정:
  //   - 웹훅에 전사가 실려온 모델(generic/clova/mock): payload.turns 를 저장 + 분류에 사용.
  //   - 전사 별도 확보 모델(clawops): payload.turns 는 비어 있고, DTMF·전사는 이미 call_turns 에
  //     적재됨 → getExistingTurns 로 읽어 분류(중복 insert 방지, 재삽입 안 함).
  let turns: readonly CallbackTurn[];
  if (payload.turns.length > 0) {
    await store.insertTurns(session.id, payload.turns);
    turns = payload.turns;
  } else if (store.getExistingTurns) {
    turns = await store.getExistingTurns(session.id);
  } else {
    turns = [];
  }
  const { startedAt, endedAt } = deriveCallWindow(turns, now);

  if (session.purpose === "SCHEDULE") {
    const { report, llmCostKrw } = await classifyAndReportSchedule({
      turns: [...turns],
      scheduleTitle: await scheduleTitleOf(store, session),
      answered: true,
      attempts: session.attempt,
      llm,
    });
    if (!(await store.reportExists(session.id))) {
      await store.insertReport(session.id, report);
    }
    await store.updateSession(session.id, {
      status: "COMPLETED",
      started_at: startedAt,
      ended_at: endedAt,
      cost_krw: roundKrw(vendorCost + llmCostKrw),
      next_attempt_at: null,
    });
    return { status: "ok", action: "COMPLETE" };
  }

  // CONSENT 콜: 동의 성사 판정 → self_consent_at 기록. 리포트 없음(가드레일: 판정 대상 아님).
  const granted = evaluateConsentGranted([...turns], true);
  await store.updateSession(session.id, {
    status: "COMPLETED",
    started_at: startedAt,
    ended_at: endedAt,
    cost_krw: roundKrw(vendorCost),
    next_attempt_at: null,
  });
  if (granted) {
    await store.setSelfConsent(session.senior_id, endedAt);
  }
  return { status: "ok", action: "COMPLETE" };
}

function roundKrw(v: number): number {
  return Math.round(v * 100) / 100;
}
