/**
 * ReportDigest → 이메일(제목/HTML/텍스트) 렌더러.
 *
 * 규칙(docs/report-spec.md §2 "이메일 카드 규칙"):
 *  - 폭 600px 고정, **인라인 스타일만**(Gmail/네이버/아웃룩은 <style> 을 자주 지운다).
 *  - 이미지·웹폰트 없음(이미지 차단 환경에서도 100% 읽힌다). 다크모드 대응 없이 라이트 고정.
 *  - L0 헤드라인 + L1 항목 한 줄(예외 우선)까지만. L2 상세는 "자세히 보기" 링크로 넘긴다.
 *  - 제목은 안도/성취 프레이밍. 손실 프레임("놓쳤습니다") 금지.
 *  - 하단에 의료 고지 + 119 대체 아님 고지 + 수신거부 링크 (가드레일 1, THIRD-PLAN P0-7).
 *
 * 색상: 이메일 클라이언트는 CSS 변수를 지원하지 않으므로 app/globals.css 토큰의 **값**을
 * 하드코딩한다(프로젝트 전체에서 유일하게 허용되는 예외). 각 상수에 출처 토큰을 주석으로 남기고,
 * 리스킨 시 이 블록만 함께 갱신한다.
 */
import { MEDICAL_DISCLAIMER } from "@/lib/contracts/domain";
import { EMERGENCY_DISCLAIMER, type ReportDigest } from "@/lib/contracts/report-view";

// ── 디자인 토큰 값 미러 (출처: app/globals.css / CLAUDE.md `## 디자인 토큰`) ──
const C = {
  primary: "#1E3A5F", // --color-primary  (딥 네이비)
  primarySoft: "#EAF0F7", // --color-primary-soft
  accent: "#C2410B", // --color-accent   (웜 테라코타)
  bg: "#FBF7F0", // --color-bg
  surface: "#F0E7D8", // --color-surface
  border: "#E7DBC8", // --color-border
  text: "#263140", // --color-text
  textMuted: "#6B5D4F", // --color-text-muted
} as const;
const RADIUS = "14px"; // --radius-base
/** 웹폰트 금지 → 시스템 폰트 스택으로 폴백(--font-sans 의 Pretendard 는 로컬에 있으면 사용). */
const FONT = "'Pretendard Variable', Pretendard, -apple-system, 'Segoe UI', 'Malgun Gothic', sans-serif";

export type EmailRenderLinks = {
  /** L2 상세로 보내는 딥링크 (로그인 게이트 뒤) */
  reportUrl: string;
  /** 수신거부(설정) 링크 — 필수 */
  unsubscribeUrl: string;
};

export type RenderedEmail = { subject: string; html: string; text: string };

/** HTML escape — 요약·이름 등 사용자 데이터가 마크업을 깨거나 주입되지 않게. */
export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const KIND_LABEL: Record<ReportDigest["period"]["kind"], string> = {
  DAY: "오늘의 리포트",
  WEEK: "주간 리포트",
  MONTH: "월간 리포트",
};

/**
 * 제목 — 안도/성취 프레이밍.
 *   이상 0건: "[주간 리포트] 7월 21일 ~ 7월 27일 · 이상 없음"
 *   이상 있음: "… · 이상 신호 1건"
 */
export function renderSubject(digest: ReportDigest): string {
  const kind = KIND_LABEL[digest.period.kind];
  const tail =
    digest.stats.total === 0
      ? "안내 전화 없음"
      : digest.stats.exception === 0
        ? "이상 없음"
        : `이상 신호 ${digest.stats.exception}건`;
  return `[${kind}] ${digest.period.label} · ${tail}`;
}

/** 톤별 헤드라인 색 — CALM 은 차분한 네이비, ATTENTION/ALERT 는 테라코타. */
function toneColor(tone: ReportDigest["tone"]): string {
  return tone === "CALM" ? C.primary : C.accent;
}

/** 항목 한 줄 (L1). 예외는 상태 라벨을 강조색으로. */
function itemRow(item: ReportDigest["seniors"][number]["items"][number]): string {
  const statusColor = item.isException ? C.accent : C.textMuted;
  return [
    `<tr>`,
    `<td style="padding:8px 0;border-bottom:1px solid ${C.border};font-size:15px;color:${C.text};">`,
    `<span style="color:${C.textMuted};">${esc(item.time)}</span>`,
    `&nbsp;&nbsp;${esc(item.title)}`,
    `</td>`,
    `<td align="right" style="padding:8px 0;border-bottom:1px solid ${C.border};font-size:14px;color:${statusColor};white-space:nowrap;">`,
    `${esc(item.statusLabel)}`,
    `</td>`,
    `</tr>`,
  ].join("");
}

function seniorBlock(senior: ReportDigest["seniors"][number]): string {
  const rows = senior.items.map(itemRow).join("");
  return [
    `<tr><td style="padding:18px 0 6px 0;font-size:15px;font-weight:700;color:${C.text};">`,
    `${esc(senior.name)}`,
    senior.exceptionCount > 0
      ? ` <span style="font-weight:400;font-size:13px;color:${C.accent};">확인 ${senior.exceptionCount}건</span>`
      : "",
    `</td></tr>`,
    `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table></td></tr>`,
  ].join("");
}

/**
 * HTML 본문. 600px 고정 테이블 레이아웃(이메일 클라이언트 호환 최대치).
 * 항목은 이미 buildDigest 가 "예외 우선 → 시간순"으로 정렬해 전달한다(여기서 재정렬하지 않는다).
 */
export function renderEmailHtml(digest: ReportDigest, links: EmailRenderLinks): string {
  const headColor = toneColor(digest.tone);
  const seniorBlocks = digest.seniors.map(seniorBlock).join("");

  const body =
    digest.stats.total === 0
      ? `<tr><td style="padding:8px 0;font-size:15px;color:${C.textMuted};">이 기간에는 안내 전화가 없었어요.</td></tr>`
      : seniorBlocks;

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${esc(renderSubject(digest))}</title></head>
<body style="margin:0;padding:0;background-color:${C.bg};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.bg};">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;font-family:${FONT};">

    <!-- 헤더 -->
    <tr><td style="padding:0 0 12px 0;font-size:13px;color:${C.textMuted};letter-spacing:.02em;">
      시니어 스케줄러 · ${esc(KIND_LABEL[digest.period.kind])}
    </td></tr>

    <!-- L0 헤드라인 카드 -->
    <tr><td style="background-color:#FFFFFF;border:1px solid ${C.border};border-radius:${RADIUS};padding:22px 20px;">
      <div style="font-size:13px;color:${C.textMuted};margin:0 0 6px 0;">${esc(digest.period.label)}</div>
      <div style="font-size:21px;line-height:1.4;font-weight:700;color:${headColor};margin:0;">${esc(digest.headline)}</div>
      ${digest.subline ? `<div style="font-size:14px;color:${C.textMuted};margin:8px 0 0 0;">${esc(digest.subline)}</div>` : ""}
    </td></tr>

    <!-- L1 항목 -->
    <tr><td style="padding:6px 4px 0 4px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${body}</table>
    </td></tr>

    <!-- 자세히 보기 -->
    <tr><td style="padding:22px 0 0 0;">
      <a href="${esc(links.reportUrl)}" style="display:inline-block;background-color:${C.primary};color:#FFFFFF;text-decoration:none;font-size:15px;font-weight:700;padding:12px 22px;border-radius:${RADIUS};">자세히 보기</a>
    </td></tr>

    <!-- 푸터: 고지 2종 + 수신거부 -->
    <tr><td style="padding:26px 0 0 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.surface};border-radius:${RADIUS};">
        <tr><td style="padding:16px 18px;font-size:12px;line-height:1.7;color:${C.textMuted};">
          ${esc(MEDICAL_DISCLAIMER)}<br>
          ${esc(EMERGENCY_DISCLAIMER)}
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:14px 2px 0 2px;font-size:12px;color:${C.textMuted};">
      <a href="${esc(links.unsubscribeUrl)}" style="color:${C.textMuted};text-decoration:underline;">알림 수신 설정 · 수신거부</a>
    </td></tr>

  </table>
</td></tr></table>
</body></html>`;
}

/** 플레인 텍스트 폴백 — HTML 차단 환경에서도 동일 정보 계층을 유지한다. */
export function renderEmailText(digest: ReportDigest, links: EmailRenderLinks): string {
  const lines: string[] = [];
  lines.push(`[${KIND_LABEL[digest.period.kind]}] ${digest.period.label}`);
  lines.push(digest.headline);
  if (digest.subline) lines.push(digest.subline);

  for (const senior of digest.seniors) {
    lines.push("");
    lines.push(`· ${senior.name}`);
    for (const item of senior.items) {
      lines.push(`  - ${item.time} ${item.title} → ${item.statusLabel}`);
    }
  }
  if (digest.stats.total === 0) {
    lines.push("");
    lines.push("이 기간에는 안내 전화가 없었어요.");
  }

  lines.push("");
  lines.push(`자세히 보기: ${links.reportUrl}`);
  lines.push("");
  lines.push(MEDICAL_DISCLAIMER);
  lines.push(EMERGENCY_DISCLAIMER);
  lines.push(`알림 수신 설정 · 수신거부: ${links.unsubscribeUrl}`);
  return lines.join("\n");
}

/** 제목 + HTML + 텍스트 한 번에. */
export function renderReportEmail(digest: ReportDigest, links: EmailRenderLinks): RenderedEmail {
  return {
    subject: renderSubject(digest),
    html: renderEmailHtml(digest, links),
    text: renderEmailText(digest, links),
  };
}
