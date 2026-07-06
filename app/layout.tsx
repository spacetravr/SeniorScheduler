import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "전화 한 통으로 부모님 일정 챙기기",
  description:
    "앱 설치 없이, 예약된 시간에 부모님 일반 전화로 복약·병원 일정을 안내하고 결과를 알려드립니다.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-screen bg-bg text-text font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
