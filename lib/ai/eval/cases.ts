import type { SeniorResponse, ClassifyResult } from "../classifier";

/**
 * 분류 회귀 케이스셋 — 룰 기반 결정적 판정의 골든셋.
 * LLM 없이(스텁) 돌리므로, 룰로 확정 불가한 애매/모호 케이스는 **UNCERTAIN 이 정답**이다.
 * (CLAUDE.md 최우선 규칙: 억지 DONE/NOT_DONE 금지 — UNCERTAIN 케이스 다수 포함.)
 *
 * responses 배열은 "원 응답 + (있으면) 재질문 응답" 순서. classify() 가 순서대로 룰 적용.
 */

export type EvalCase = {
  name: string;
  responses: SeniorResponse[];
  expect: ClassifyResult["status"];
};

const V = (text: string): SeniorResponse => ({ text, input_kind: "VOICE" });
const D = (text: string): SeniorResponse => ({ text, input_kind: "DTMF" });

export const ADHERENCE_CASES: EvalCase[] = [
  // ── DTMF (최우선) ──
  { name: "DTMF 1 → DONE", responses: [D("1")], expect: "DONE" },
  { name: "DTMF 2 → NOT_DONE", responses: [D("2")], expect: "NOT_DONE" },
  { name: "DTMF 3 → POSTPONED", responses: [D("3")], expect: "POSTPONED" },
  { name: "DTMF 9(무의미) → UNCERTAIN", responses: [D("9")], expect: "UNCERTAIN" },

  // ── 명확 긍정 ──
  { name: "먹었어요 → DONE", responses: [V("응 먹었어요")], expect: "DONE" },
  { name: "방금 먹었지 → DONE", responses: [V("방금 먹었지")], expect: "DONE" },
  { name: "약 챙겼어 → DONE", responses: [V("약 챙겼어")], expect: "DONE" },
  { name: "다 먹었음 → DONE", responses: [V("다 먹었음")], expect: "DONE" },

  // ── 명확 부정 ──
  { name: "아직 안 먹었어 → NOT_DONE", responses: [V("아직 안 먹었어")], expect: "NOT_DONE" },
  { name: "깜빡했네 → NOT_DONE", responses: [V("아이고 깜빡했네")], expect: "NOT_DONE" },
  { name: "못 먹었어 → NOT_DONE", responses: [V("바빠서 못 먹었어")], expect: "NOT_DONE" },
  { name: "오늘은 걸렀어 → NOT_DONE", responses: [V("오늘은 걸렀어")], expect: "NOT_DONE" },

  // ── 사투리 ──
  { name: "사투리: 약 안 묵었다 → NOT_DONE", responses: [V("약 안 묵었다")], expect: "NOT_DONE" },
  { name: "사투리: 밥 묵었다 → DONE", responses: [V("밥 묵었다 아이가")], expect: "DONE" },

  // ── 연기 ──
  { name: "이따 먹을게 → POSTPONED", responses: [V("이따 먹을게")], expect: "POSTPONED" },
  { name: "저녁에 먹을게 → POSTPONED", responses: [V("저녁에 먹을게")], expect: "POSTPONED" },
  { name: "조금 있다 → POSTPONED", responses: [V("조금 있다 할게")], expect: "POSTPONED" },
  { name: "나중에 → POSTPONED", responses: [V("나중에 하지 뭐")], expect: "POSTPONED" },

  // ── 애매/모호 → UNCERTAIN (억지 판정 금지) ──
  { name: "웅얼: 어어 뭐라고 → UNCERTAIN", responses: [V("어어 뭐라고")], expect: "UNCERTAIN" },
  { name: "그래 그래(모호) → UNCERTAIN", responses: [V("어 그래 그래")], expect: "UNCERTAIN" },
  { name: "여보세요?(무관) → UNCERTAIN", responses: [V("여보세요 누구세요")], expect: "UNCERTAIN" },
  { name: "빈 응답 → UNCERTAIN", responses: [V("")], expect: "UNCERTAIN" },
  { name: "날씨 얘기(무관) → UNCERTAIN", responses: [V("오늘 날씨가 좋네")], expect: "UNCERTAIN" },

  // ── 재질문 흐름 ──
  {
    name: "모호 → 재질문 후 명확 긍정 → DONE",
    responses: [V("어어 뭐라고"), V("아 먹었어")],
    expect: "DONE",
  },
  {
    name: "모호 → 재질문도 모호 → UNCERTAIN",
    responses: [V("어어"), V("그래 그래")],
    expect: "UNCERTAIN",
  },
  {
    name: "모호 → 재질문 부정 → NOT_DONE",
    responses: [V("응?"), V("아직 안 했어")],
    expect: "NOT_DONE",
  },

  // ── 혼합 우선순위 ──
  {
    name: "부정 우선: 안 먹었지만 먹 포함 → NOT_DONE",
    responses: [V("아직 안 먹었어 이따 먹을게")],
    expect: "NOT_DONE",
  },
];
