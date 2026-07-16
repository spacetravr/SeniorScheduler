import { FREE_FORM_PROMPTS } from "@/lib/calls/warm-talk";
import { MAX_LLM_CALLS_PER_SESSION } from "@/lib/ai/llm";
import type { CallbackTurn } from "./callback";

/**
 * 전사 백필 유틸 — 통화 후 뒤늦게 도착하는 ClawOps 전사를 분류에 맞게 위치·재분류한다.
 *
 * ── 배경(2026-07-16 실콜 확정) ──
 * ClawOps 는 (1) Gather 의 speech 입력으로 action 을 트리거하지 않고, (2) 전사 생성이 통화 종료
 * 후 수십 초 걸린다. 따라서 시니어 발화는 통화 중 SENIOR 턴으로 실시간 저장되지 못하고, 오직
 * 통화 후 전사(transcript)로만 확보된다. 콜백 시점(30초 재시도)에 전사가 준비되면 그때 반영하고,
 * 못 하면 디스패치 크론의 백필 단계가 최근 COMPLETED 세션을 다시 훑어 전사를 채운다.
 *
 * ── 위치 부여(positionTranscriptTurns) ──
 * 분류 두뇌(lib/calls/run-call splitAtFreeForm)는 "기분·일상 질문 SYSTEM 마커" 경계를 기준으로
 * 그 앞 SENIOR 발화 = 이행 판정 대상, 그 뒤 = 자유 발화(판정 제외)로 나눈다. VoiceML 단일 문서가
 * 이 SYSTEM 마커들을 통화 중 저장하지만, 전사 SENIOR 턴은 콜백/백필 시점(마커보다 늦음)에
 * 삽입되므로 그대로 두면 **전부 경계 뒤**로 몰려 이행 판정 입력이 비어 항상 UNCERTAIN 이 된다.
 * 이를 막기 위해 전사의 **첫 SENIOR 발화(일정 확인 답)를 경계 직전**에, 나머지(기분·일상 답)는
 * 경계 뒤로 위치시킨다(created_at 조정). ARS+ 설계상 통화 첫 발화는 항상 일정 확인 답이다.
 * 이미 경계 앞에 SENIOR 턴(예: 실시간 DTMF)이 있으면 이행 답은 확보된 것이므로 전사는 전부
 * 경계 뒤(자유 발화)로 둔다.
 *
 * ── 순수성(테스트) ──
 * 이 파일은 순수하다: DB·네트워크·시계 없음. 입력 턴 배열 → 재배치/판단만. 라우트·크론이 주입.
 */

/** 첫 FREE_FORM 질문(기분·일상) SYSTEM 마커의 인덱스. 없으면 -1. */
function freeFormBoundaryIndex(turns: readonly CallbackTurn[]): number {
  return turns.findIndex(
    (t) => t.role === "SYSTEM" && FREE_FORM_PROMPTS.some((p) => t.text.includes(p)),
  );
}

/** ISO instant 파싱(밀리초). 실패 시 fallback. */
function parseMs(iso: string, fallback: number): number {
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : fallback;
}

/**
 * 전사 SENIOR 턴에 created_at 을 재부여해 splitAtFreeForm 경계에 맞게 위치시킨다.
 *
 * @param transcript 삽입할 전사 SENIOR 턴(전사 순서 유지 — 첫 원소 = 일정 확인 답).
 * @param existing   세션에 이미 저장된 전 턴(SYSTEM 마커 포함, created_at 오름차순 권장).
 * @returns created_at 이 조정된 전사 턴(순서·개수 불변, 원본 불변).
 *
 * 규칙:
 *   - 경계 마커 없음 → 원본 그대로 반환(구형/무마커 — 상위 휴리스틱에 위임).
 *   - 경계 앞에 이미 SENIOR 턴 존재(실시간 DTMF 등) → 전사 전부 경계 뒤(자유 발화)로.
 *   - 아니면 → 첫 전사 턴을 경계 직전(이행 답)으로, 나머지는 경계 뒤로.
 */
export function positionTranscriptTurns(
  transcript: readonly CallbackTurn[],
  existing: readonly CallbackTurn[],
): CallbackTurn[] {
  if (transcript.length === 0) return [];
  const boundary = freeFormBoundaryIndex(existing);
  if (boundary < 0) return [...transcript]; // 경계 없음 → 위치 조정 불가(원본 유지).

  const boundaryMs = parseMs(existing[boundary].at, Date.now());
  // 경계 앞에 이미 저장된 SENIOR 턴(실시간 DTMF 등)이 있으면 이행 답은 확보됨.
  const adherenceAlready = existing
    .slice(0, boundary)
    .some((t) => t.role === "SENIOR");
  // 자유 발화 턴을 놓을 기준 시각: 기존 마지막 턴 이후(경계 뒤 보장).
  const maxExistingMs = existing.reduce((mx, t) => Math.max(mx, parseMs(t.at, mx)), boundaryMs);

  const out: CallbackTurn[] = [];
  let freeSeq = 0;
  const placeFree = (t: CallbackTurn) => {
    freeSeq += 1;
    out.push({ ...t, at: new Date(maxExistingMs + freeSeq).toISOString() });
  };

  transcript.forEach((t, i) => {
    if (i === 0 && !adherenceAlready) {
      // 첫 발화 = 일정 확인 답 → 경계 직전(이행 판정 대상).
      out.push({ ...t, at: new Date(boundaryMs - 1).toISOString() });
    } else {
      placeFree(t);
    }
  });
  return out;
}

/**
 * 백필 재분류에 허용할 LLM 호출 예산(가드레일 3: 통화당 총 2회 상한).
 *
 * 세션이 지금까지 소비한 LLM 호출 수(call_sessions.llm_calls_used)를 빼서 남은 예산을 준다.
 * 0 이면 룰 분류만(LLM 미호출). 재분류도 이 예산 안에서만 LLM 을 쓴다.
 */
export function backfillLlmBudget(llmCallsUsed: number): number {
  return Math.max(0, MAX_LLM_CALLS_PER_SESSION - (Number.isFinite(llmCallsUsed) ? llmCallsUsed : 0));
}

/**
 * 백필로 새 SENIOR 턴이 생겼을 때 리포트를 재생성할지 판단.
 *
 * 기존 리포트가 UNCERTAIN 이고(억지 판정을 미룬 상태) 새 SENIOR 발화가 실제로 생겼을 때만
 * 재분류한다. 그 외(이미 DONE/NOT_DONE/POSTPONED, 또는 새 발화 없음)는 그대로 둔다(멱등).
 */
export function shouldReclassifyOnBackfill(
  currentStatus: string | null | undefined,
  newSeniorTurnCount: number,
): boolean {
  return currentStatus === "UNCERTAIN" && newSeniorTurnCount > 0;
}
