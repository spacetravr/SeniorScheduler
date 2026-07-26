/**
 * 자주 묻는 질문 (`/faq`) — 전용 페이지.
 * 문답은 랜딩과 동일한 FaqSection(FAQ_ITEMS 단일 소스)을 재사용해 항상 동기화된다.
 * FAQPage 구조화 데이터도 같은 소스에서 생성한다.
 */
import type { Metadata } from "next";
import { PageShell } from "@/components/marketing/PageShell";
import { FaqSection } from "@/components/marketing/FaqSection";
import { PreregisterLink } from "@/components/marketing/PreregisterLink";
import { FAQ_ITEMS } from "@/components/marketing/faqData";

const FAQ_DESCRIPTION =
  "부모님 복약·안부 전화 서비스 Senior Scheduler에 대해 자주 묻는 질문을 모았습니다. 앱 설치, 비용, 녹음, 집전화 이용, 해지 방법까지 궁금한 점을 확인하세요.";

export const metadata: Metadata = {
  title: "자주 묻는 질문",
  description: FAQ_DESCRIPTION,
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "자주 묻는 질문 | Senior Scheduler",
    description: FAQ_DESCRIPTION,
    type: "website",
    locale: "ko_KR",
    siteName: "Senior Scheduler",
    url: "/faq",
  },
};

/** FAQPage 구조화 데이터(JSON-LD) — 화면 FAQ와 동일한 단일 소스에서 생성. */
const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS.map((item) => ({
    "@type": "Question",
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: item.answer,
    },
  })),
};

export default function FaqPage() {
  return (
    <PageShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      <FaqSection />

      {/* 하단 CTA */}
      <section className="px-5 pb-20 sm:px-8">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-5 rounded-base border border-primary/10 bg-primary-soft px-5 py-12 text-center shadow-card sm:px-8">
          <h2 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            더 궁금한 점이 있으신가요?
          </h2>
          <p className="max-w-md text-lg leading-relaxed text-text-muted">
            사전등록하시면 정식 출시 소식과 함께 안내를 가장 먼저 받아보실 수
            있어요.
          </p>
          <PreregisterLink />
        </div>
      </section>
    </PageShell>
  );
}
