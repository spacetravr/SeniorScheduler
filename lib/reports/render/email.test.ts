import { describe, expect, it } from "vitest";
import { buildDigest, type DigestInput } from "@/lib/reports/digest";
import { renderReportEmail, renderSubject, esc } from "@/lib/reports/render/email";
import { MEDICAL_DISCLAIMER } from "@/lib/contracts/domain";
import { EMERGENCY_DISCLAIMER } from "@/lib/contracts/report-view";

const links = {
  reportUrl: "https://example.test/app/reports",
  unsubscribeUrl: "https://example.test/app/settings",
};

function item(over: Partial<DigestInput> & { id: string }): DigestInput {
  return {
    id: over.id,
    sessionId: over.sessionId ?? `s-${over.id}`,
    createdAt: over.createdAt ?? "2026-07-27T09:00:00+09:00",
    status: over.status ?? "DONE",
    summary: over.summary ?? "약을 챙겨 드셨다고 하셨어요.",
    moodFlag: over.moodFlag ?? false,
    healthFlag: over.healthFlag ?? false,
    seniorName: over.seniorName ?? "어머님",
    seniorId: over.seniorId ?? "senior-1",
    title: over.title ?? "아침 혈압약",
  };
}

const range = { startYmd: "2026-07-21", endYmd: "2026-07-27" };

describe("renderSubject", () => {
  it("이상 신호 건수를 안도 프레이밍으로 담는다", () => {
    const d = buildDigest("WEEK", [item({ id: "1", status: "UNCERTAIN" }), item({ id: "2" })], range);
    expect(renderSubject(d)).toBe("[주간 리포트] 7월 21일 ~ 7월 27일 · 이상 신호 1건");
  });

  it("이상이 없으면 '이상 없음'", () => {
    const d = buildDigest("WEEK", [item({ id: "1" })], range);
    expect(renderSubject(d)).toBe("[주간 리포트] 7월 21일 ~ 7월 27일 · 이상 없음");
  });

  it("통화가 없으면 '안내 전화 없음'", () => {
    const d = buildDigest("WEEK", [], range);
    expect(renderSubject(d)).toContain("안내 전화 없음");
  });
});

describe("renderReportEmail", () => {
  const digest = buildDigest(
    "WEEK",
    [
      item({ id: "1", status: "DONE", createdAt: "2026-07-22T09:00:00+09:00" }),
      item({
        id: "2",
        status: "UNCERTAIN",
        title: "저녁 약",
        createdAt: "2026-07-23T18:00:00+09:00",
      }),
    ],
    range,
  );
  const mail = renderReportEmail(digest, links);

  it("고지 2종(의료·119)을 HTML·텍스트 모두에 포함한다", () => {
    for (const body of [mail.html, mail.text]) {
      expect(body).toContain(MEDICAL_DISCLAIMER);
      expect(body).toContain(EMERGENCY_DISCLAIMER);
    }
  });

  it("자세히 보기 링크와 수신거부 링크가 있다", () => {
    expect(mail.html).toContain(links.reportUrl);
    expect(mail.html).toContain(links.unsubscribeUrl);
    expect(mail.text).toContain(links.unsubscribeUrl);
  });

  it("예외 항목이 정상 항목보다 먼저 나온다 (L1 예외 우선)", () => {
    const exIdx = mail.html.indexOf("저녁 약");
    const okIdx = mail.html.indexOf("아침 혈압약");
    expect(exIdx).toBeGreaterThanOrEqual(0);
    expect(exIdx).toBeLessThan(okIdx);
    // 텍스트 폴백도 동일 순서
    expect(mail.text.indexOf("저녁 약")).toBeLessThan(mail.text.indexOf("아침 혈압약"));
  });

  it("폭 600px 고정 + 이미지·웹폰트 로드 없음", () => {
    expect(mail.html).toContain("max-width:600px");
    expect(mail.html).not.toContain("<img");
    expect(mail.html).not.toContain("@import");
    expect(mail.html).not.toContain("fonts.googleapis");
  });

  it("헤드라인·기간 라벨이 본문에 담긴다", () => {
    expect(mail.html).toContain(digest.headline);
    expect(mail.html).toContain(digest.period.label);
  });

  it("통화가 없으면 빈 상태 문구를 렌더한다", () => {
    const empty = renderReportEmail(buildDigest("WEEK", [], range), links);
    expect(empty.html).toContain("안내 전화가 없었어요");
  });
});

describe("esc", () => {
  it("사용자 데이터의 마크업을 이스케이프한다", () => {
    expect(esc(`<b>"김"&'</b>`)).toBe("&lt;b&gt;&quot;김&quot;&amp;&#39;&lt;/b&gt;");
  });

  it("피보호자 이름에 태그가 들어와도 HTML 로 새어 나가지 않는다", () => {
    const d = buildDigest("DAY", [item({ id: "1", seniorName: "<script>x</script>" })]);
    const html = renderReportEmail(d, links).html;
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
