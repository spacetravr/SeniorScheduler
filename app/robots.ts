import type { MetadataRoute } from "next";

/**
 * robots — 공개 마케팅 경로만 허용, 보호자 앱/관리자/로그인/API는 색인 차단.
 * 기준 URL은 NEXT_PUBLIC_SITE_URL(배포) → 로컬 폴백.
 */
const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/app", "/admin", "/login", "/api"],
    },
    sitemap: `${BASE_URL}/sitemap.xml`,
    host: BASE_URL,
  };
}
