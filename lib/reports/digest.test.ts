import { describe, expect, it } from "vitest";
import { buildDigest, renderShareText, type DigestInput } from "@/lib/reports/digest";

/** KST 기준 시각으로 리포트 항목 생성 헬퍼. */
function item(over: Partial<DigestInput> & { id: string }): DigestInput {
  return {
    id: over.id,
    sessionId: over.sessionId ?? `s-${over.id}`,
    createdAt: over.createdAt ?? "2026-07-28T09:00:00+09:00",
    status: over.status ?? "DONE",
    summary: over.summary ?? "약을 챙겨 드셨다고 하셨어요.",
    moodFlag: over.moodFlag ?? false,
    healthFlag: over.healthFlag ?? false,
    seniorName: over.seniorName ?? "어머님",
    seniorId: over.seniorId ?? "senior-1",
    title: over.title ?? "아침 혈압약",
  };
}

describe("buildDigest", () => {
  it("이상 신호가 없으면 CALM 톤", () => {
    const d = buildDigest("DAY", [item({ id: "1" }), item({ id: "2", status: "POSTPONED" })]);
    expect(d.tone).toBe("CALM");
    expect(d.stats.exception).toBe(0);
    expect(d.headline).toContain("이상 신호가 없었어요");
  });

  it("POSTPONED 는 예외로 세지 않는다 (부모님이 의사를 밝힌 상태)", () => {
    const d = buildDigest("DAY", [item({ id: "1", status: "POSTPONED" })]);
    expect(d.stats.postponed).toBe(1);
    expect(d.stats.exception).toBe(0);
  });

  it("예외 1건이면 ATTENTION, 2건이면 ALERT", () => {
    const one = buildDigest("DAY", [item({ id: "1", status: "UNCERTAIN" }), item({ id: "2" })]);
    expect(one.tone).toBe("ATTENTION");

    const two = buildDigest("DAY", [
      item({ id: "1", status: "UNCERTAIN" }),
      item({ id: "2", status: "NOT_DONE" }),
    ]);
    expect(two.tone).toBe("ALERT");
    expect(two.headline).toBe("확인이 필요한 일이 2건 있어요");
  });

  it("단발 MISSED 는 ALERT 로 올리지 않고, 2건부터 ALERT", () => {
    const single = buildDigest("DAY", [item({ id: "1", status: "MISSED" })]);
    expect(single.tone).toBe("ATTENTION");

    const twice = buildDigest("DAY", [
      item({ id: "1", status: "MISSED" }),
      item({ id: "2", status: "MISSED" }),
    ]);
    expect(twice.tone).toBe("ALERT");
  });

  it("이행률 분모에서 MISSED 를 제외한다 (부재는 이행 실패가 아님)", () => {
    const d = buildDigest("DAY", [
      item({ id: "1", status: "DONE" }),
      item({ id: "2", status: "MISSED" }),
    ]);
    // 성사된 통화 1건 중 1건 이행 → 100%
    expect(d.stats.adherenceRate).toBe(100);
  });

  it("통화가 하나도 성사되지 않으면 이행률은 null", () => {
    const d = buildDigest("DAY", [item({ id: "1", status: "MISSED" })]);
    expect(d.stats.adherenceRate).toBeNull();
  });

  it("항목이 비면 빈 다이제스트를 만든다", () => {
    const d = buildDigest("DAY", [], { startYmd: "2026-07-28", endYmd: "2026-07-28" });
    expect(d.stats.total).toBe(0);
    expect(d.tone).toBe("CALM");
    expect(d.headline).toContain("안내 전화가 없었어요");
    expect(d.subline).toBe("");
    expect(d.period.label).toBe("7월 28일 (화)");
  });

  it("항목은 예외 우선 → 시간순으로 정렬된다", () => {
    const d = buildDigest("DAY", [
      item({ id: "a", createdAt: "2026-07-28T08:00:00+09:00" }),
      item({ id: "b", createdAt: "2026-07-28T20:00:00+09:00", status: "NOT_DONE" }),
      item({ id: "c", createdAt: "2026-07-28T12:00:00+09:00" }),
    ]);
    expect(d.seniors[0].items.map((i) => i.reportId)).toEqual(["b", "a", "c"]);
  });

  it("피보호자는 이상 신호가 있는 쪽이 위, colorIndex 는 등장 순서 기준", () => {
    const d = buildDigest("DAY", [
      item({ id: "1", seniorId: "s1", seniorName: "어머님" }),
      item({ id: "2", seniorId: "s2", seniorName: "아버님", status: "NOT_DONE" }),
    ]);
    expect(d.seniors[0].name).toBe("아버님");
    expect(d.seniors[0].colorIndex).toBe(1); // 등장은 두 번째
    expect(d.seniors[1].colorIndex).toBe(0);
  });

  it("UTC 오프셋으로 들어와도 KST 달력·시각으로 변환한다", () => {
    // 2026-07-28T23:30+09:00 == 2026-07-28T14:30Z
    const d = buildDigest("DAY", [item({ id: "1", createdAt: "2026-07-28T14:30:00+00:00" })]);
    expect(d.seniors[0].items[0].ymd).toBe("2026-07-28");
    expect(d.seniors[0].items[0].time).toBe("23:30");
  });

  it("subline 의 예외 내역 합이 headline 의 건수와 일치한다 (종류 누락 금지)", () => {
    const d = buildDigest("DAY", [
      item({ id: "1", status: "NOT_DONE" }),
      item({ id: "2", status: "MISSED" }),
      item({ id: "3", status: "UNCERTAIN" }),
      item({ id: "4", status: "DONE" }),
    ]);
    expect(d.headline).toBe("확인이 필요한 일이 3건 있어요");
    expect(d.subline).toContain("미이행 1건");
    expect(d.subline).toContain("부재 1건");
    expect(d.subline).toContain("확인 필요 1건");

    const sum = ["미이행", "부재", "확인 필요"]
      .map((label) => Number(new RegExp(`${label} (\\d+)건`).exec(d.subline)?.[1] ?? 0))
      .reduce((a, b) => a + b, 0);
    expect(sum).toBe(d.stats.exception);
  });

  it("추이는 일자별 이행률(통화 없는 날 제외)을 오래된→최신 순으로 낸다", () => {
    const d = buildDigest("WEEK", [
      item({ id: "1", createdAt: "2026-07-27T09:00:00+09:00", status: "DONE" }),
      item({ id: "2", createdAt: "2026-07-28T09:00:00+09:00", status: "DONE" }),
      item({ id: "3", createdAt: "2026-07-28T18:00:00+09:00", status: "NOT_DONE" }),
    ]);
    expect(d.trend).toEqual([100, 50]);
  });

  // 회귀 방지: 가입 직후(리포트 0건) 대시보드가 range 없이 WEEK 다이제스트를 만들면
  // startYmd 가 "" 가 되어 날짜 포맷이 RangeError 로 터졌고, /app 이 통째로 500 이었다.
  it("리포트 0건 + 기간 미지정이어도 던지지 않고 '기록 없음' 으로 낸다", () => {
    const d = buildDigest("WEEK", []);
    expect(d.period.label).toBe("기록 없음");
    expect(d.stats.total).toBe(0);
    expect(d.stats.adherenceRate).toBeNull();
    expect(d.seniors).toEqual([]);
    expect(d.trend).toEqual([]);
  });

  it("리포트 0건이어도 기간이 주어지면 그 기간 라벨을 쓴다", () => {
    const d = buildDigest("DAY", [], { startYmd: "2026-07-31", endYmd: "2026-07-31" });
    expect(d.period.label).toBe("7월 31일 (금)");
    expect(d.tone).toBe("CALM");
  });

  it("공유 텍스트도 기록 0건에서 던지지 않는다", () => {
    expect(() => renderShareText(buildDigest("WEEK", []))).not.toThrow();
  });
});

describe("renderShareText", () => {
  it("예외만 항목으로 적고 정상은 건수로 접는다", () => {
    const d = buildDigest("DAY", [
      item({ id: "1", status: "DONE" }),
      item({ id: "2", status: "DONE", createdAt: "2026-07-28T13:00:00+09:00" }),
      item({
        id: "3",
        status: "UNCERTAIN",
        title: "저녁 약",
        createdAt: "2026-07-28T18:00:00+09:00",
      }),
    ]);
    const text = renderShareText(d, "https://example.com/app/reports");

    expect(text).toContain("확인이 필요한 일이 1건 있어요");
    expect(text).toContain("18:00 저녁 약 → 확인필요");
    expect(text).toContain("그 밖의 2건은 정상적으로 확인되었어요.");
    expect(text).toContain("https://example.com/app/reports");
  });

  it("전사·요약 본문은 공유 텍스트에 싣지 않는다 (민감 정보 확산 방지)", () => {
    const d = buildDigest("DAY", [
      item({ id: "1", status: "NOT_DONE", summary: "허리가 아프다고 하셨어요." }),
    ]);
    expect(renderShareText(d)).not.toContain("허리가 아프다고");
  });

  it("의료·긴급 고지를 항상 포함한다", () => {
    const text = renderShareText(buildDigest("DAY", [item({ id: "1" })]));
    expect(text).toContain("의료적 판단이나 조언이 아닙니다");
    expect(text).toContain("119");
  });
});
