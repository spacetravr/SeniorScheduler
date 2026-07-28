import { describe, expect, it } from "vitest";
import { buildDigest, type DigestInput } from "@/lib/reports/digest";
import { renderReportAlimtalk, renderItemLines } from "@/lib/reports/render/alimtalk";
import { AlimtalkNotifyAdapter, resolveAlimtalkConfig } from "@/lib/notify/alimtalk";

function item(over: Partial<DigestInput> & { id: string }): DigestInput {
  return {
    id: over.id,
    sessionId: `s-${over.id}`,
    createdAt: over.createdAt ?? "2026-07-28T09:00:00+09:00",
    status: over.status ?? "DONE",
    summary: over.summary ?? "통화 요약 본문",
    moodFlag: false,
    healthFlag: false,
    seniorName: over.seniorName ?? "어머님",
    seniorId: over.seniorId ?? "senior-1",
    title: over.title ?? "아침 혈압약",
  };
}

describe("renderReportAlimtalk", () => {
  const digest = buildDigest("DAY", [
    item({ id: "1", status: "NOT_DONE", title: "아침 혈압약" }),
    item({ id: "2", status: "DONE", title: "점심 약", createdAt: "2026-07-28T13:00:00+09:00" }),
  ]);

  it("템플릿 변수와 버튼 2개를 만든다", () => {
    const r = renderReportAlimtalk(digest, {
      reportUrl: "https://example.test/app/reports",
      seniorPhone: "010-1234-5678",
    });
    expect(r.templateVars.기간).toBe(digest.period.label);
    expect(r.templateVars.헤드라인).toBe(digest.headline);
    expect(r.buttons.map((b) => b.name)).toEqual(["리포트 보기", "전화 걸기"]);
    expect(r.buttons[1].url).toBe("tel:01012345678");
  });

  it("전화번호가 없으면 전화 버튼을 넣지 않는다", () => {
    const r = renderReportAlimtalk(digest, { reportUrl: "https://x.test", seniorPhone: null });
    expect(r.buttons).toHaveLength(1);
  });

  it("통화 요약 본문(전사·상세)은 싣지 않는다 — 재전달 확산 방지", () => {
    const r = renderReportAlimtalk(digest, { reportUrl: "https://x.test" });
    expect(JSON.stringify(r)).not.toContain("통화 요약 본문");
  });

  it("예외 항목만 줄로 나열하고, 정상만 있으면 건수로 접는다", () => {
    expect(renderItemLines(digest)).toContain("아침 혈압약");
    expect(renderItemLines(digest)).not.toContain("점심 약");

    const calm = buildDigest("DAY", [item({ id: "1" }), item({ id: "2" })]);
    expect(renderItemLines(calm)).toBe("통화 2건 모두 정상 확인");
  });
});

describe("AlimtalkNotifyAdapter (스텁)", () => {
  it("env 미설정이면 비활성 → skipped", async () => {
    expect(resolveAlimtalkConfig({})).toBeNull();
    const a = new AlimtalkNotifyAdapter(null);
    expect(a.isEnabled()).toBe(false);
    const r = await a.send({ kind: "EXCEPTION_ALERT", to: "01000000000", subject: "s", text: "t" });
    expect(r).toEqual({
      channel: "ALIMTALK",
      status: "skipped",
      reason: "alimtalk_not_configured",
    });
  });

  it("env 가 모두 있으면 활성 + 종류별 템플릿 코드를 고른다 (실발송은 아직 미구현)", async () => {
    const cfg = resolveAlimtalkConfig({
      KAKAO_ALIMTALK_SENDER_KEY: "sk",
      KAKAO_ALIMTALK_API_KEY: "ak",
      KAKAO_ALIMTALK_API_BASE_URL: "https://vendor.test",
      KAKAO_ALIMTALK_TEMPLATE_EXCEPTION: "TPL_EX",
      KAKAO_ALIMTALK_TEMPLATE_WEEKLY: "TPL_WK",
    });
    expect(cfg).not.toBeNull();
    const a = new AlimtalkNotifyAdapter(cfg);
    expect(a.isEnabled()).toBe(true);
    expect(a.templateCodeFor("EXCEPTION_ALERT")).toBe("TPL_EX");
    expect(a.templateCodeFor("WEEKLY_DIGEST")).toBe("TPL_WK");
    const r = await a.send({ kind: "WEEKLY_DIGEST", to: "01000000000", subject: "s", text: "t" });
    // 가짜 sent 를 만들지 않는다 — 벤더 연동 전까지 정직하게 skipped.
    expect(r.status).toBe("skipped");
    expect(r.reason).toBe("vendor_not_implemented");
  });
});
