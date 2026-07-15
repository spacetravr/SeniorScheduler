import type { LlmClient } from "./llm";

/**
 * 응답 분류 — 자체 두뇌 (CLAUDE.md `## 전화 발신`, 최우선 규칙: 억지 판정 금지).
 *
 * 파이프라인:
 *   ① DTMF 우선 (1=DONE, 2=NOT_DONE, 3=POSTPONED)
 *   ② 키워드 룰 (긍정/부정/연기 사전 — 사투리 변형 포함)
 *   ③ 룰로 확정 불가 시 LLM 호출
 *   ④ LLM 불가·불확실하면 **UNCERTAIN** (절대 억지 DONE/NOT_DONE 금지)
 */

export type AdherenceRuleStatus = "DONE" | "NOT_DONE" | "POSTPONED";
export type ClassifyMethod = "DTMF" | "KEYWORD" | "LLM" | "NONE";

export type SeniorResponse = { text: string; input_kind: "VOICE" | "DTMF" };

export type ClassifyResult = {
  status: AdherenceRuleStatus | "UNCERTAIN";
  method: ClassifyMethod;
};

// ── 사전 (공백 제거 후 substring 매칭) ────────────────────────────────────────
// 순서 중요: 부정 → 연기 → 긍정.
//  - 부정이 연기보다 우선: "안 먹었어 이따 먹을게"는 지금 미이행(NOT_DONE)이 핵심.
//  - 부정/연기가 긍정보다 우선: "안 먹었어"는 '먹었' 긍정 토큰을 포함하나 부정이 맞음.
const POSTPONE_MARKERS = [
  "이따", "이따가", "나중", "저녁에", "아침에먹을", "조금있", "좀있", "다음에", "곧먹", "있다먹", "뒤에먹",
];
const NEGATIVE_MARKERS = [
  "안먹", "못먹", "안묵", "못묵", "아직", "깜빡", "잊었", "잊어", "안했", "못했", "안챙",
  "거르", "걸렀", "걸러", "건너뛰", "빼먹",
];
const POSITIVE_MARKERS = [
  "먹었", "묵었", "챙겼", "복용했", "다먹", "방금먹", "먹었어", "먹었지", "먹었음",
];

function normalize(text: string): string {
  return text.replace(/\s+/g, "");
}

/** DTMF 단일 키 → 판정 (1/2/3만 의미, 그 외 null). */
export function classifyDtmf(text: string): AdherenceRuleStatus | null {
  const key = text.trim();
  if (key === "1") return "DONE";
  if (key === "2") return "NOT_DONE";
  if (key === "3") return "POSTPONED";
  return null;
}

/** 키워드 룰 → 판정. 확정 불가면 null(→ UNCERTAIN 후보). */
export function classifyKeywords(text: string): AdherenceRuleStatus | null {
  const n = normalize(text);
  if (n === "") return null;
  if (NEGATIVE_MARKERS.some((m) => n.includes(m))) return "NOT_DONE";
  if (POSTPONE_MARKERS.some((m) => n.includes(m))) return "POSTPONED";
  if (POSITIVE_MARKERS.some((m) => n.includes(m))) return "DONE";
  return null;
}

/** 단일 응답에 대한 룰 판정 (DTMF 우선 → 키워드). null = 룰로 확정 불가. */
export function classifyByRules(resp: SeniorResponse): { status: AdherenceRuleStatus; method: ClassifyMethod } | null {
  if (resp.input_kind === "DTMF") {
    const d = classifyDtmf(resp.text);
    if (d) return { status: d, method: "DTMF" };
    return null;
  }
  const k = classifyKeywords(resp.text);
  if (k) return { status: k, method: "KEYWORD" };
  return null;
}

const LLM_CLASSIFY_SYSTEM =
  "다음 통화 응답이 '오늘 할 일(복약/식사/병원 등)을 했는지'에 대한 답인지 분류하세요. " +
  "정확히 다음 중 하나의 단어만 출력: DONE(했음), NOT_DONE(안 함), POSTPONED(나중에), UNCERTAIN(불명확). " +
  "조금이라도 불확실하면 반드시 UNCERTAIN. 추측 금지.";

/** LLM 판정 — 애매한 응답 텍스트를 넘겨 라벨 1개를 얻는다. 실패/불명확 시 null. */
export async function classifyByLlm(
  text: string,
  llm: LlmClient,
): Promise<AdherenceRuleStatus | null> {
  const out = await llm.complete(LLM_CLASSIFY_SYSTEM, `응답: "${text}"`);
  if (!out) return null;
  const label = out.toUpperCase();
  if (label.includes("DONE") && !label.includes("NOT_DONE")) return "DONE";
  if (label.includes("NOT_DONE")) return "NOT_DONE";
  if (label.includes("POSTPONED")) return "POSTPONED";
  return null; // UNCERTAIN 또는 파싱 불가 → 억지 판정 금지
}

/**
 * 전체 분류 파이프라인. 이미 수집된 SENIOR 응답들(원 응답 + 재질문 응답)을 순서대로
 * 룰 적용 → 첫 확정 채택 → 없으면 마지막 응답으로 LLM → 그래도 안 되면 UNCERTAIN.
 *
 * llm 미지정(스텁) 시 LLM 단계는 건너뛰고 룰/ UNCERTAIN 으로만 판정 → 결정적.
 */
export async function classify(
  responses: SeniorResponse[],
  llm?: LlmClient,
): Promise<ClassifyResult> {
  const meaningful = responses.filter((r) => r.text.trim() !== "");
  if (meaningful.length === 0) {
    return { status: "UNCERTAIN", method: "NONE" };
  }

  for (const resp of meaningful) {
    const ruled = classifyByRules(resp);
    if (ruled) return ruled;
  }

  // 룰로 확정 불가 → 마지막(가장 최근 재질문) 응답으로 LLM 시도.
  if (llm) {
    const last = meaningful[meaningful.length - 1];
    const llmStatus = await classifyByLlm(last.text, llm);
    if (llmStatus) return { status: llmStatus, method: "LLM" };
  }

  return { status: "UNCERTAIN", method: "NONE" };
}

// ── 동의(CONSENT) 콜 분류 — 본인 동의 여부만 판정 ─────────────────────────────
export type ConsentDecision = "GRANTED" | "DENIED" | "UNCERTAIN";

const CONSENT_DENY_MARKERS = ["아니", "싫", "안할", "안돼", "거부", "관두", "필요없", "하지마"];
const CONSENT_GRANT_MARKERS = ["네", "예", "좋아", "동의", "할게", "그래", "응", "괜찮", "해줘", "해도"];

/** 동의 응답 판정 (DTMF 1=동의, 2=거부 우선 → 키워드). 애매하면 UNCERTAIN(미기록). */
export function classifyConsent(resp: SeniorResponse): ConsentDecision {
  if (resp.input_kind === "DTMF") {
    const key = resp.text.trim();
    if (key === "1") return "GRANTED";
    if (key === "2") return "DENIED";
    return "UNCERTAIN";
  }
  const n = normalize(resp.text);
  if (n === "") return "UNCERTAIN";
  // 거부를 먼저 검사("아니 싫어요"에 긍정 토큰이 섞여도 거부 우선).
  if (CONSENT_DENY_MARKERS.some((m) => n.includes(m))) return "DENIED";
  if (CONSENT_GRANT_MARKERS.some((m) => n.includes(m))) return "GRANTED";
  return "UNCERTAIN";
}
