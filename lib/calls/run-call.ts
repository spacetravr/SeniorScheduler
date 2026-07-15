import type { Senior, Schedule } from "@/lib/contracts/domain";
import type { Clock, CollectedTurn, ScriptIO, TelephonyAdapter } from "@/lib/telephony/types";
import { MOCK_COST } from "@/lib/telephony/mock-adapter";
import { classify, classifyByRules, classifyConsent, type SeniorResponse } from "@/lib/ai/classifier";
import { generateReport, type GeneratedReport } from "@/lib/ai/report";
import type { LlmClient } from "@/lib/ai/llm";
import { scheduleScript, CONSENT_SCRIPT } from "./scripts";
import {
  transition,
  retryDelayMs,
  MAX_ATTEMPTS,
  type CallState,
  type CallStatus,
} from "./state-machine";

/**
 * ARS+ 통화 실행 오케스트레이터 (CLAUDE.md `## 전화 발신`).
 *
 * 어댑터(발신·전사) + classifier(분류) + report(리포트) 를 묶어 한 통화를 끝까지 돌린다.
 * 부수효과(DB write)는 하지 않고, 저장에 필요한 결과 객체만 반환한다 → 라우트가 persist.
 * 시각은 주입된 clock 기준(Date.now 직접 호출 금지, KST 명시는 상위 스케줄링 계층 책임).
 *
 * 재시도(1분·10분)는 mock 단계에서 clock 을 전진시켜 인라인으로 소진한다
 * (deterministic mock 은 시도마다 동일 결과이므로 결과가 바뀌진 않지만, attempt·상태
 *  전이·타임스탬프를 정확히 기록한다). 실벤더 도입 시 크로스-인보케이션 스케줄로 대체.
 */

/** SENIOR 응답 턴만 뽑아 분류 입력으로 변환. */
export function toResponses(turns: CollectedTurn[]): SeniorResponse[] {
  return turns
    .filter((t) => t.role === "SENIOR")
    .map((t) => ({ text: t.text, input_kind: t.input_kind }));
}

/**
 * 수집된 턴 → 분류·리포트 생성 (SCHEDULE 콜의 "두뇌" 재사용 단일 지점).
 *
 * mock 동기 경로(runScheduleCall)와 실벤더 비동기 콜백 경로(telephony/callback)가 모두
 * 이 함수를 재사용해 중복 구현을 막는다. 규칙:
 *   - 마지막 SENIOR 응답은 기분 질문 답(판정 제외) → classify 입력에서 뺀다.
 *     (mock 시나리오는 항상 기분 응답이 마지막 SENIOR 턴이므로 동작 불변.)
 *   - flag 감지(mood/health)는 전체 SENIOR 텍스트를 대상으로 한다(기분 답 포함).
 *   - LLM 원가는 classify 소비분만 합산한다(리포트 요약 호출은 기존 동작대로 미합산).
 *
 * @returns report 와 LLM 사용 원가(KRW). 회선/STT/TTS 원가는 어댑터/콜백이 별도 합산.
 */
export async function classifyAndReportSchedule(args: {
  turns: CollectedTurn[];
  scheduleTitle: string;
  answered: boolean;
  attempts: number;
  llm: LlmClient;
}): Promise<{ report: GeneratedReport; llmCostKrw: number }> {
  const { turns, scheduleTitle, answered, attempts, llm } = args;
  const responses = toResponses(turns);

  // 마지막 SENIOR 응답 = 기분 답(있으면). 판정 입력에서 분리.
  const moodText = answered && responses.length > 0 ? responses[responses.length - 1].text : null;
  const classifyInput = answered && responses.length > 0 ? responses.slice(0, -1) : [];

  const classification = answered
    ? await classify(classifyInput.length > 0 ? classifyInput : responses, llm)
    : { status: "UNCERTAIN" as const, method: "NONE" as const };

  // LLM 사용분 원가(가드레일 3 상한 내) — classify 직후 관측(기존 순서 보존).
  const llmCostKrw = llm.callsUsed() * MOCK_COST.LLM_PER_CALL;

  const report = await generateReport(
    {
      answered,
      adherenceStatus: classification.status,
      scheduleTitle,
      moodText,
      attempts,
      seniorTexts: responses.map((r) => r.text),
    },
    llm,
  );

  return { report, llmCostKrw };
}

/** 수집된 턴 → 본인 동의 성사 여부. 마지막 SENIOR 응답으로 판정(GRANTED 만 성사). */
export function evaluateConsentGranted(turns: CollectedTurn[], answered: boolean): boolean {
  if (!answered) return false;
  const seniorResp = turns.filter((t) => t.role === "SENIOR").at(-1);
  return (
    seniorResp != null &&
    classifyConsent({ text: seniorResp.text, input_kind: seniorResp.input_kind }) === "GRANTED"
  );
}

export type ScheduleCallResult = {
  status: Extract<CallStatus, "COMPLETED" | "MISSED">;
  attempt: number;
  startedAt: string | null;
  endedAt: string | null;
  costKrw: number;
  /** 성사된(마지막) 시도의 전 턴. MISSED 면 빈 배열. */
  turns: CollectedTurn[];
  report: GeneratedReport;
};

/**
 * SCHEDULE(일정 확인) 콜 실행. 발신 가드는 호출 전(dispatch 라우트)에서 검증한다.
 */
export async function runScheduleCall(args: {
  sessionId: string;
  senior: Senior;
  schedule: Schedule;
  adapter: TelephonyAdapter;
  llm: LlmClient;
  clock: Clock;
}): Promise<ScheduleCallResult> {
  const { sessionId, senior, schedule, adapter, llm, clock } = args;
  const script = scheduleScript(schedule.script_template);

  let state: CallState = { status: "SCHEDULED", attempt: 1 };
  let totalCost = 0;
  let lastTurns: CollectedTurn[] = [];
  let startedAt: string | null = null;
  let endedAt: string | null = null;

  // 재시도 소진까지 시도. clock 은 시도마다 지연만큼 전진.
  let baseMs = clock().getTime();
  for (let guard = 0; guard < MAX_ATTEMPTS; guard++) {
    const attemptClock: Clock = () => new Date(baseMs);
    state = transition(state, { type: "DIAL_START" });

    // runScript: 도입 → 응답 → (애매하면 재질문) → 기분 1턴 → 종료.
    const runScript = async (io: ScriptIO): Promise<void> => {
      await io.say(script.intro);
      const first = await io.collect(script.ask);

      // 룰로 즉시 확정되지 않으면 1회 재질문(ARS+ 규칙).
      const firstRuled = first ? classifyByRules({ text: first.text, input_kind: first.input_kind }) : null;
      if (first && !firstRuled) {
        await io.say(script.reask);
        await io.collect(script.reask);
      }

      // 기분 질문 1턴(저장만, 판정 안 함).
      await io.say(script.mood);
      await io.collect(script.mood);

      await io.say(script.closing);
    };

    const result = await adapter.initiateCall(
      { sessionId, seniorId: senior.id, to: senior.phone, purpose: "SCHEDULE", runScript },
      attemptClock,
    );
    totalCost += result.costKrw;

    if (result.outcome === "ANSWERED") {
      state = transition(state, { type: "ANSWERED" });
      state = transition(state, { type: "COMPLETE" });
      lastTurns = result.turns;
      startedAt = result.startedAt;
      endedAt = result.endedAt;
      break;
    }

    // 무응답 → 재시도 판단.
    state = transition(state, { type: "NO_ANSWER" });
    if (state.status === "MISSED") break;
    const delay = retryDelayMs(state.attempt - 1); // 방금 실패한 attempt 기준 지연
    baseMs += delay ?? 0;
  }

  const answered = state.status === "COMPLETED";

  // 분류·리포트는 콜백 경로와 공유하는 단일 지점(classifyAndReportSchedule)에 위임.
  const { report, llmCostKrw } = await classifyAndReportSchedule({
    turns: lastTurns,
    scheduleTitle: schedule.title,
    answered,
    attempts: state.attempt,
    llm,
  });
  totalCost += llmCostKrw;

  return {
    status: answered ? "COMPLETED" : "MISSED",
    attempt: state.attempt,
    startedAt,
    endedAt,
    costKrw: Math.round(totalCost * 100) / 100,
    turns: answered ? lastTurns : [],
    report,
  };
}

export type ConsentCallResult = {
  status: Extract<CallStatus, "COMPLETED" | "MISSED">;
  attempt: number;
  startedAt: string | null;
  endedAt: string | null;
  costKrw: number;
  turns: CollectedTurn[];
  /** 본인 동의 성사 여부 — true 면 self_consent_at 을 endedAt 으로 기록. */
  consentGranted: boolean;
};

/** CONSENT(본인 동의) 콜 실행. 동의/거부/무응답 판정 → self_consent 기록 여부 결정. */
export async function runConsentCall(args: {
  sessionId: string;
  senior: Senior;
  adapter: TelephonyAdapter;
  clock: Clock;
}): Promise<ConsentCallResult> {
  const { sessionId, senior, adapter, clock } = args;

  let state: CallState = { status: "SCHEDULED", attempt: 1 };
  let totalCost = 0;
  let lastTurns: CollectedTurn[] = [];
  let startedAt: string | null = null;
  let endedAt: string | null = null;
  let baseMs = clock().getTime();

  for (let guard = 0; guard < MAX_ATTEMPTS; guard++) {
    const attemptClock: Clock = () => new Date(baseMs);
    state = transition(state, { type: "DIAL_START" });

    const runScript = async (io: ScriptIO): Promise<void> => {
      await io.say(CONSENT_SCRIPT.intro);
      const resp = await io.collect(CONSENT_SCRIPT.ask);
      const decision = resp
        ? classifyConsent({ text: resp.text, input_kind: resp.input_kind })
        : "UNCERTAIN";
      await io.say(decision === "GRANTED" ? CONSENT_SCRIPT.grantedClosing : CONSENT_SCRIPT.deniedClosing);
    };

    const result = await adapter.initiateCall(
      { sessionId, seniorId: senior.id, to: senior.phone, purpose: "CONSENT", runScript },
      attemptClock,
    );
    totalCost += result.costKrw;

    if (result.outcome === "ANSWERED") {
      state = transition(state, { type: "ANSWERED" });
      state = transition(state, { type: "COMPLETE" });
      lastTurns = result.turns;
      startedAt = result.startedAt;
      endedAt = result.endedAt;
      break;
    }
    state = transition(state, { type: "NO_ANSWER" });
    if (state.status === "MISSED") break;
    baseMs += retryDelayMs(state.attempt - 1) ?? 0;
  }

  const answered = state.status === "COMPLETED";
  // 성사 시 마지막 SENIOR 응답으로 동의 여부 재판정(콜백 경로와 공유 함수).
  const consentGranted = evaluateConsentGranted(lastTurns, answered);

  return {
    status: answered ? "COMPLETED" : "MISSED",
    attempt: state.attempt,
    startedAt,
    endedAt,
    costKrw: Math.round(totalCost * 100) / 100,
    turns: answered ? lastTurns : [],
    consentGranted,
  };
}
