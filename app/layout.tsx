import type { Metadata } from "next";
import { Chakra_Petch } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

/** 브랜드 워드마크 전용 폰트 (각진·뾰족한 타이포). CSS 변수 --font-brand 로 노출. 본문 미사용. */
const brandFont = Chakra_Petch({
  subsets: ["latin"],
  weight: "700",
  variable: "--font-brand",
  display: "swap",
});

const SITE_NAME = "Senior Scheduler";
const SITE_TITLE = "부모님 복약·안부 전화 자동으로 | Senior Scheduler";
const SITE_DESCRIPTION =
  "앱 설치 없이, 예약한 시간에 부모님 일반 전화로 복약·병원 일정을 안내하고 안부를 확인해 결과 리포트를 알려드립니다. 시니어 안부 전화 서비스 Senior Scheduler.";
/** OG 카드용 이미지 — 기존 히어로 자산 재사용(신규 생성 없음). */
const OG_IMAGE = "/images/hero-senior-couple.jpg";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  ),
  title: {
    default: SITE_TITLE,
    template: "%s | Senior Scheduler",
  },
  description: SITE_DESCRIPTION,
  keywords: [
    "부모님 복약 전화",
    "시니어 안부 전화",
    "복약 알림",
    "부모님 안부 확인",
    "노인 돌봄 서비스",
    "병원 일정 알림",
    "Senior Scheduler",
  ],
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    type: "website",
    locale: "ko_KR",
    siteName: SITE_NAME,
    url: "/",
    images: [
      {
        url: OG_IMAGE,
        alt: "전화를 받으며 환하게 웃고 계신 부모님",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={brandFont.variable}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-screen bg-bg text-text font-sans antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
