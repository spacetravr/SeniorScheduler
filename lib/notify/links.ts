/**
 * 알림·리포트 딥링크 단일 소스.
 * 링크는 항상 로그인 게이트 뒤(/app/*)로 보낸다 — 공개 토큰 링크는 이번 범위가 아니다
 * (report-spec §2 공유 텍스트 규칙).
 */

/** 배포 기준 URL. 미설정 시 로컬 폴백(개발 편의) — 끝 슬래시 제거. */
export function siteBaseUrl(env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env): string {
  return (env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "");
}

/** 리포트 상세(L2) 링크 + 수신거부(알림 설정) 링크. */
export function reportLinks(base: string = siteBaseUrl()): {
  reportUrl: string;
  unsubscribeUrl: string;
} {
  return { reportUrl: `${base}/app/reports`, unsubscribeUrl: `${base}/app/settings` };
}
