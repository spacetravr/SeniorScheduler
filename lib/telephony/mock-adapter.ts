import type {
  Clock,
  CollectedTurn,
  InitiateCallParams,
  CallResult,
  ScriptIO,
  TelephonyAdapter,
} from "./types";

/**
 * MockAdapter — 벤더 확정 전 발신 시뮬레이터 (CLAUDE.md `## 전화 발신`).
 *
 * senior_id 해시 기반으로 시나리오를 **결정적으로** 선택(테스트 재현성)한다.
 * Date.now 직접 호출 금지 — clock 을 주입받아 턴 타임스탬프를 증분 생성한다.
 *
 * 시나리오 세트(설계 요구): 명확 긍정("먹었어요")·DTMF 1·명확 부정·연기("이따")·
 * 모호/웅얼·사투리("약 안 묵었다")·무응답(→MISSED). 분류/판정은 어댑터가 하지 않고
 * lib/ai/ 가 담당 — 어댑터는 전사 텍스트/DTMF 만 생성한다.
 */

// ── Mock 가상 단가 (KRW) — cost_krw 합산 근거 (벤더 확정 시 교체) ──────────────
export const MOCK_COST = {
  /** 회선 연결(발신 성공) 고정비. */
  CONNECT: 30,
  /** SENIOR 응답 1건당 STT 비용. */
  STT_PER_RESPONSE: 8,
  /** SYSTEM 멘트 1건당 TTS 비용. */
  TTS_PER_PROMPT: 5,
  /** LLM 호출 1회당 비용 — 어댑터 밖(lib/calls)에서 합산해 cost_krw 에 더한다. */
  LLM_PER_CALL: 12,
} as const;

type SeniorResponse = { input_kind: "VOICE" | "DTMF"; text: string };

type Scenario = {
  id: string;
  outcome: "ANSWERED" | "NO_ANSWER";
  /** collect() 호출 순서대로 소비되는 응답 큐. 재질문 대비 여분 포함. */
  responses: SeniorResponse[];
};

// SCHEDULE(일정 확인) 시나리오 — 마지막 응답은 기분 질문(1턴, 판정 안 함)용.
const SCHEDULE_SCENARIOS: Scenario[] = [
  {
    id: "clear_positive",
    outcome: "ANSWERED",
    responses: [
      { input_kind: "VOICE", text: "응 먹었어요" },
      { input_kind: "VOICE", text: "그냥 그래" }, // mood
    ],
  },
  {
    id: "dtmf_positive",
    outcome: "ANSWERED",
    responses: [
      { input_kind: "DTMF", text: "1" },
      { input_kind: "VOICE", text: "기분 좋아" }, // mood
    ],
  },
  {
    id: "clear_negative",
    outcome: "ANSWERED",
    responses: [
      { input_kind: "VOICE", text: "아직 안 먹었어" },
      { input_kind: "VOICE", text: "몸이 좀 안 좋네" }, // mood (health_flag 유도)
    ],
  },
  {
    id: "dtmf_negative",
    outcome: "ANSWERED",
    responses: [
      { input_kind: "DTMF", text: "2" },
      { input_kind: "VOICE", text: "괜찮아" }, // mood
    ],
  },
  {
    id: "postpone",
    outcome: "ANSWERED",
    responses: [
      { input_kind: "VOICE", text: "이따 먹을게" },
      { input_kind: "VOICE", text: "심심해" }, // mood
    ],
  },
  {
    id: "ambiguous_mumble",
    outcome: "ANSWERED",
    responses: [
      { input_kind: "VOICE", text: "어어 뭐라고" }, // main → UNCERTAIN
      { input_kind: "VOICE", text: "어 그래 그래" }, // re-ask → 여전히 UNCERTAIN
      { input_kind: "VOICE", text: "외롭네" }, // mood
    ],
  },
  {
    id: "dialect_negative",
    outcome: "ANSWERED",
    responses: [
      { input_kind: "VOICE", text: "약 안 묵었다" }, // 사투리 부정
      { input_kind: "VOICE", text: "무릎이 아파" }, // mood (health_flag)
    ],
  },
  {
    id: "no_answer",
    outcome: "NO_ANSWER",
    responses: [],
  },
];

// CONSENT(본인 동의) 시나리오 — 첫 응답이 동의 여부.
const CONSENT_SCENARIOS: Scenario[] = [
  {
    id: "consent_dtmf_yes",
    outcome: "ANSWERED",
    responses: [{ input_kind: "DTMF", text: "1" }],
  },
  {
    id: "consent_voice_yes",
    outcome: "ANSWERED",
    responses: [{ input_kind: "VOICE", text: "네 좋아요" }],
  },
  {
    id: "consent_refuse",
    outcome: "ANSWERED",
    responses: [{ input_kind: "VOICE", text: "아니 싫어요" }],
  },
  {
    id: "consent_no_answer",
    outcome: "NO_ANSWER",
    responses: [],
  },
];

/** 결정적 문자열 해시(FNV-1a 32bit). 테스트 재현성 보장. */
export function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** senior_id + purpose 로 시나리오를 결정적으로 선택. */
export function pickScenario(seniorId: string, purpose: "SCHEDULE" | "CONSENT"): Scenario {
  const set = purpose === "CONSENT" ? CONSENT_SCENARIOS : SCHEDULE_SCENARIOS;
  return set[hashString(`${purpose}:${seniorId}`) % set.length];
}

export class MockAdapter implements TelephonyAdapter {
  /** 시나리오 강제 지정(테스트용). 미지정 시 senior_id 해시로 선택. */
  constructor(private readonly forcedScenarioId?: string) {}

  async initiateCall(params: InitiateCallParams, clock: Clock): Promise<CallResult> {
    const { sessionId, seniorId, purpose, runScript } = params;

    const scenario = this.resolveScenario(seniorId, purpose);
    const baseMs = clock().getTime();
    let stepIndex = 0;
    const turns: CollectedTurn[] = [];

    // 무응답 → 대화 없음. 엔진이 재시도/ MISSED 를 판단.
    if (scenario.outcome === "NO_ANSWER") {
      return {
        sessionId,
        outcome: "NO_ANSWER",
        turns,
        startedAt: null,
        endedAt: null,
        costKrw: 0, // 연결 실패 → 청구 없음
      };
    }

    // 각 스텝을 5초 간격 가상 진행(clock 은 고정 앵커, 오프셋은 결정적).
    const nextAt = (): string => new Date(baseMs + stepIndex++ * 5000).toISOString();
    const queue = [...scenario.responses];

    const io: ScriptIO = {
      say: async (text: string): Promise<CollectedTurn> => {
        const turn: CollectedTurn = { role: "SYSTEM", input_kind: "VOICE", text, at: nextAt() };
        turns.push(turn);
        return turn;
      },
      collect: async (): Promise<CollectedTurn | null> => {
        const next = queue.shift();
        if (!next) return null;
        const turn: CollectedTurn = {
          role: "SENIOR",
          input_kind: next.input_kind,
          text: next.text,
          at: nextAt(),
        };
        turns.push(turn);
        return turn;
      },
    };

    await runScript(io);

    const startedAt = turns.length > 0 ? turns[0].at : new Date(baseMs).toISOString();
    const endedAt = turns.length > 0 ? turns[turns.length - 1].at : startedAt;

    const systemTurns = turns.filter((t) => t.role === "SYSTEM").length;
    const seniorTurns = turns.filter((t) => t.role === "SENIOR").length;
    const costKrw =
      MOCK_COST.CONNECT +
      systemTurns * MOCK_COST.TTS_PER_PROMPT +
      seniorTurns * MOCK_COST.STT_PER_RESPONSE;

    return { sessionId, outcome: "ANSWERED", turns, startedAt, endedAt, costKrw };
  }

  private resolveScenario(seniorId: string, purpose: "SCHEDULE" | "CONSENT"): Scenario {
    if (this.forcedScenarioId) {
      const all = [...SCHEDULE_SCENARIOS, ...CONSENT_SCENARIOS];
      const found = all.find((s) => s.id === this.forcedScenarioId);
      if (found) return found;
    }
    return pickScenario(seniorId, purpose);
  }
}
