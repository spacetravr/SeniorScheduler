import { describe, it, expect } from "vitest";
import {
  positionTranscriptTurns,
  backfillLlmBudget,
  shouldReclassifyOnBackfill,
} from "./transcript-backfill";
import { MOOD_QUESTION, CHAT_TURNS } from "@/lib/calls/warm-talk";
import { splitAtFreeForm } from "@/lib/calls/run-call";
import type { CallbackTurn } from "./callback";

/**
 * VoiceML 단일 문서가 통화 중 저장하는 SYSTEM 경계 마커(기분·일상 질문). 시니어 발화 SENIOR 턴은
 * 통화 후 전사로만 오므로(콜백/백필 시점) 마커보다 늦게 삽입된다. positionTranscriptTurns 가
 * 첫 발화(일정 확인 답)를 경계 앞으로, 나머지를 경계 뒤로 위치시켜 splitAtFreeForm 이 올바로
 * 분리하는지 검증한다.
 */
function introMarkers(baseIso = "2026-07-16T09:00:00.000+09:00"): CallbackTurn[] {
  const base = Date.parse(baseIso);
  const at = (i: number) => new Date(base + i).toISOString();
  return [
    { role: "SYSTEM", input_kind: "VOICE", text: "안녕하세요. 혈압약 확인 전화예요.", at: at(0) },
    { role: "SYSTEM", input_kind: "VOICE", text: MOOD_QUESTION, at: at(1) },
    { role: "SYSTEM", input_kind: "VOICE", text: CHAT_TURNS[0].question, at: at(2) },
    { role: "SYSTEM", input_kind: "VOICE", text: CHAT_TURNS[1].question, at: at(3) },
  ];
}

function transcript(texts: string[], atIso = "2026-07-16T09:05:00.000+09:00"): CallbackTurn[] {
  const base = Date.parse(atIso);
  return texts.map((text, i) => ({
    role: "SENIOR" as const,
    input_kind: "VOICE" as const,
    text,
    at: new Date(base + i).toISOString(),
  }));
}

describe("positionTranscriptTurns", () => {
  it("첫 발화는 경계 앞(이행 답), 나머지는 경계 뒤(자유 발화)로 위치", () => {
    const existing = introMarkers();
    const t = transcript(["네 먹었어요", "그냥 그래요", "밥 먹었어요"]);
    const positioned = positionTranscriptTurns(t, existing);
    expect(positioned).toHaveLength(3);

    // splitAtFreeForm 은 배열 순서(=created_at 순서)를 기준으로 분리하므로 정렬해 확인.
    const merged = [...existing, ...positioned].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const split = splitAtFreeForm(merged);
    expect(split).not.toBeNull();
    // 첫 발화만 이행 판정 대상.
    expect(split!.adherence.map((r) => r.text)).toEqual(["네 먹었어요"]);
    // 기분·일상 답은 자유 발화(판정 제외).
    expect(split!.freeForm.map((r) => r.text)).toEqual(["그냥 그래요", "밥 먹었어요"]);
  });

  it("경계 앞에 이미 SENIOR 턴(실시간 DTMF)이 있으면 전사는 전부 경계 뒤(자유 발화)", () => {
    const markers = introMarkers();
    // DTMF 턴이 intro 와 기분 마커 사이(경계 앞)에 이미 저장된 상태.
    const dtmfAt = new Date(Date.parse(markers[0].at) + 0.5).toISOString();
    const existing: CallbackTurn[] = [
      markers[0],
      { role: "SENIOR", input_kind: "DTMF", text: "1", at: dtmfAt },
      markers[1],
      markers[2],
      markers[3],
    ];
    const t = transcript(["오늘 기분 좋아요", "산책했어요"]);
    const positioned = positionTranscriptTurns(t, existing);
    const merged = [...existing, ...positioned].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const split = splitAtFreeForm(merged);
    // DTMF 가 이행 답. 전사는 전부 자유 발화.
    expect(split!.adherence.map((r) => r.text)).toEqual(["1"]);
    expect(split!.freeForm.map((r) => r.text)).toEqual(["오늘 기분 좋아요", "산책했어요"]);
  });

  it("경계 마커 없으면 원본 그대로(구형/무마커 — 상위 휴리스틱에 위임)", () => {
    const existing: CallbackTurn[] = [
      { role: "SYSTEM", input_kind: "VOICE", text: "안내 멘트", at: "2026-07-16T09:00:00+09:00" },
    ];
    const t = transcript(["네 먹었어요", "좋아요"]);
    expect(positionTranscriptTurns(t, existing)).toEqual(t);
  });

  it("빈 전사 → 빈 배열", () => {
    expect(positionTranscriptTurns([], introMarkers())).toEqual([]);
  });

  it("발화 1개(일정 답만 하고 끊음): 경계 앞 이행 답, 자유 발화 없음", () => {
    const existing = introMarkers();
    const positioned = positionTranscriptTurns(transcript(["아직 안 먹었어"]), existing);
    const merged = [...existing, ...positioned].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const split = splitAtFreeForm(merged);
    expect(split!.adherence.map((r) => r.text)).toEqual(["아직 안 먹었어"]);
    expect(split!.freeForm).toHaveLength(0);
  });

  it("원본 턴을 변형하지 않는다(순수 — created_at 만 새 객체로)", () => {
    const t = transcript(["네 먹었어요", "좋아요"]);
    const snapshot = JSON.parse(JSON.stringify(t));
    positionTranscriptTurns(t, introMarkers());
    expect(t).toEqual(snapshot);
  });
});

describe("backfillLlmBudget — 통화당 총 2회 상한", () => {
  it("남은 예산 = 2 - 기소비", () => {
    expect(backfillLlmBudget(0)).toBe(2);
    expect(backfillLlmBudget(1)).toBe(1);
    expect(backfillLlmBudget(2)).toBe(0);
  });
  it("이미 2회 이상 썼으면 0(룰 분류만)", () => {
    expect(backfillLlmBudget(3)).toBe(0);
  });
  it("비정상 값 방어", () => {
    expect(backfillLlmBudget(NaN)).toBe(2);
  });
});

describe("shouldReclassifyOnBackfill", () => {
  it("UNCERTAIN + 새 SENIOR 턴 있음 → 재분류", () => {
    expect(shouldReclassifyOnBackfill("UNCERTAIN", 1)).toBe(true);
  });
  it("UNCERTAIN 이지만 새 SENIOR 턴 없음 → 유지", () => {
    expect(shouldReclassifyOnBackfill("UNCERTAIN", 0)).toBe(false);
  });
  it("이미 확정 판정(DONE/NOT_DONE/POSTPONED) → 유지(멱등)", () => {
    for (const s of ["DONE", "NOT_DONE", "POSTPONED", "MISSED"]) {
      expect(shouldReclassifyOnBackfill(s, 2)).toBe(false);
    }
  });
  it("리포트 없음(null) → 유지", () => {
    expect(shouldReclassifyOnBackfill(null, 2)).toBe(false);
  });
});
