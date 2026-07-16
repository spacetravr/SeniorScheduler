import type { LlmClient } from "./llm";
import { PROMPT_VERSION } from "./llm";
import type { AdherenceRuleStatus } from "./classifier";

/**
 * 통화 리포트 생성 — 자체 두뇌 (CLAUDE.md `## 데이터 모델`, 가드레일 1).
 *
 * adherence_status, 3줄 요약(템플릿 기반, LLM 있으면 LLM 요약으로 대체),
 * mood_flag/health_flag(키워드 감지)를 만든다.
 * MEDICAL_DISCLAIMER 는 UI 렌더 몫이므로 여기서 저장하지 않는다(계약: call_reports 에 없음).
 */

export type AdherenceStatus = AdherenceRuleStatus | "UNCERTAIN" | "MISSED";

export type ReportInput = {
  /** 통화 성사 여부 — false 면 MISSED 리포트. */
  answered: boolean;
  /** 성사 시 분류 결과(억지 판정 금지 — 애매하면 UNCERTAIN). */
  adherenceStatus: AdherenceRuleStatus | "UNCERTAIN";
  /** 일정 제목(예: "혈압약"). 요약 문구용. */
  scheduleTitle: string;
  /** 기분 질문 응답 텍스트(있으면). 판정엔 쓰지 않고 flag/요약에만 사용. */
  moodText: string | null;
  /**
   * 일상 대화(식사·하루 일과 등) 자유 발화 텍스트. 판정엔 쓰지 않고 요약에만 반영한다
   * (의료 조언 금지 불변). 없으면 빈 배열.
   */
  dailyChatTexts?: string[];
  /** 성사 시 총 시도 횟수(재시도 포함). MISSED 요약에 표기. */
  attempts: number;
  /** 전체 SENIOR 응답 텍스트(flag 감지 대상 — 기분·일상 자유 발화 포함). */
  seniorTexts: string[];
};

export type GeneratedReport = {
  adherence_status: AdherenceStatus;
  summary: string;
  mood_flag: boolean;
  health_flag: boolean;
  prompt_version: string;
};

// ── flag 키워드 감지 ──────────────────────────────────────────────────────────
const HEALTH_MARKERS = [
  "아파", "아프", "아픈", "안좋", "어지러", "열이", "기침", "무릎", "허리", "쑤시", "쓰리", "속이", "숨차",
];
const MOOD_MARKERS = ["외롭", "우울", "심심", "쓸쓸", "짜증", "슬프", "속상", "힘들", "적적"];

function anyMarker(texts: string[], markers: string[]): boolean {
  const joined = texts.join(" ").replace(/\s+/g, "");
  return markers.some((m) => joined.includes(m));
}

const STATUS_PHRASE: Record<AdherenceStatus, string> = {
  DONE: "완료하셨다고 답하셨습니다.",
  NOT_DONE: "아직 하지 않으셨다고 답하셨습니다.",
  POSTPONED: "나중에 하겠다고 답하셨습니다.",
  UNCERTAIN: "응답이 명확하지 않아 확인이 필요합니다.",
  MISSED: "통화 연결이 되지 않았습니다.",
};

/** 템플릿 요약(LLM 없을 때 기본 경로). 최대 3줄, 의료 조언 없음. */
function templateSummary(input: ReportInput, status: AdherenceStatus): string {
  if (status === "MISSED") {
    return [
      `${input.scheduleTitle} 확인 통화가 연결되지 않았습니다.`,
      `총 ${input.attempts}회 시도했습니다.`,
    ].join("\n");
  }
  const lines = [`${input.scheduleTitle}: ${STATUS_PHRASE[status]}`];
  if (input.moodText && input.moodText.trim() !== "") {
    lines.push(`기분 질문에 "${input.moodText.trim()}"라고 답하셨습니다.`);
  }
  const daily = (input.dailyChatTexts ?? []).map((t) => t.trim()).filter((t) => t !== "");
  if (daily.length > 0) {
    lines.push(`일상 대화에서 "${daily.join(" ")}"라고 말씀하셨습니다.`);
  }
  return lines.slice(0, 3).join("\n");
}

const LLM_SUMMARY_SYSTEM =
  "다음 통화 요약 정보를 보호자에게 전달할 3줄 이내 한국어 요약으로 만드세요. " +
  "이행 여부와 함께, 기분·일상 대화 내용이 있으면 한 줄로 따뜻하게 반영하세요. " +
  "의료적 판단·조언은 절대 넣지 마세요. 관찰된 사실만, 따뜻하고 담백하게.";

/**
 * 리포트 생성. llm 미지정(스텁) 시 템플릿 요약으로 결정적 동작.
 * summary 는 계약 상한(500자)에 맞춰 잘라낸다.
 */
export async function generateReport(
  input: ReportInput,
  llm?: LlmClient,
): Promise<GeneratedReport> {
  const status: AdherenceStatus = input.answered ? input.adherenceStatus : "MISSED";

  const health_flag = input.answered && anyMarker(input.seniorTexts, HEALTH_MARKERS);
  const mood_flag = input.answered && anyMarker(input.seniorTexts, MOOD_MARKERS);

  let summary = templateSummary(input, status);

  if (llm && input.answered) {
    const daily = (input.dailyChatTexts ?? []).map((t) => t.trim()).filter((t) => t !== "");
    const user = [
      `일정: ${input.scheduleTitle}`,
      `이행 판정: ${status}`,
      input.moodText ? `기분 응답: ${input.moodText}` : "기분 응답: (없음)",
      daily.length > 0 ? `일상 대화: ${daily.join(" / ")}` : "",
      health_flag ? "건강 관련 언급 감지됨" : "",
    ]
      .filter(Boolean)
      .join("\n");
    const llmSummary = await llm.complete(LLM_SUMMARY_SYSTEM, user);
    if (llmSummary) summary = llmSummary;
  }

  return {
    adherence_status: status,
    summary: summary.slice(0, 500),
    mood_flag,
    health_flag,
    prompt_version: PROMPT_VERSION,
  };
}
