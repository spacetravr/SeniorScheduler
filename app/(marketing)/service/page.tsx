/**
 * 서비스 상세 (`/service`) — 제품 설명의 본진 (docs/site-structure.md §2).
 * 기존 랜딩(`/`)의 제품 콘텐츠를 이관하고 심화: 히어로(수정 카피) → 3단계 → 진짜 전화 →
 * 리포트 미리보기 2종(+억지 판정 금지 카피) → 안전·신뢰 원칙 → FAQ → 마지막 CTA.
 *
 * [CTA 추적] 이 페이지는 **추적되는 PreregisterButton**을 사용한다.
 *   이유: 광고·검색 유입이 도착하는 전환 경로이며, VIEW는 `/`와 `/service`에서만 보낸다는 규칙(§5-1).
 *   (VIEW는 useCtaTracking이 sessionStorage 플래그로 세션당 1회만 전송 — 중복 집계 없음.)
 */
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { PreregisterButton } from "@/components/marketing/PreregisterButton";
import { FaqSection } from "@/components/marketing/FaqSection";
import { FAQ_ITEMS } from "@/components/marketing/faqData";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { ReportPreviewCard } from "@/components/marketing/ReportPreviewCard";
import { TrustBadges } from "@/components/marketing/TrustBadges";
import { EMERGENCY_DISCLAIMER } from "@/lib/contracts/report-view";

const SERVICE_TITLE = "서비스 안내";
const SERVICE_DESCRIPTION =
  "등록한 시간에 부모님 일반 전화로 복약·병원 일정을 여쭙고, 응답을 정리해 리포트로 알려드립니다. 3단계 작동 방식, 리포트 예시 2종, 안전·신뢰 원칙을 자세히 확인하세요.";
const OG_IMAGE = "/images/hero-senior-couple.jpg";

export const metadata: Metadata = {
  title: SERVICE_TITLE,
  description: SERVICE_DESCRIPTION,
  alternates: { canonical: "/service" },
  openGraph: {
    title: `${SERVICE_TITLE} | Senior Scheduler`,
    description: SERVICE_DESCRIPTION,
    type: "website",
    locale: "ko_KR",
    siteName: "Senior Scheduler",
    url: "/service",
    images: [
      {
        url: OG_IMAGE,
        alt: "전화를 받으며 환하게 웃고 계신 어머님과 아버님",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SERVICE_TITLE} | Senior Scheduler`,
    description: SERVICE_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

/** FAQPage 구조화 데이터(JSON-LD). 화면 FAQ와 동일한 FAQ_ITEMS 단일 소스에서 생성. */
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

const STEPS = [
  {
    step: "1",
    title: "웹에서 일정 등록",
    body: "복약·병원 등 일정을 보호자가 웹에서 간단히 등록해요.",
  },
  {
    step: "2",
    title: "예약 시간에 자동 전화",
    body: "부모님의 평소 쓰던 일반 전화로 안내 전화가 걸려가요.",
  },
  {
    step: "3",
    title: "결과를 리포트로",
    body: "부모님의 응답을 정리해 보호자에게 결과를 알려드려요.",
  },
];

const BENEFITS = [
  {
    label: "보호자(자녀)",
    tagline: "어려운 조작은 익숙한 보호자가 맡습니다.",
    points: [
      "웹에서 복약·병원 일정을 등록",
      "통화가 끝나면 결과 리포트 도착",
      "부모님의 이행률을 한눈에 확인",
    ],
  },
  {
    label: "부모님(시니어)",
    tagline: "배울 것이 하나도 없습니다.",
    points: [
      "설치할 것도, 조작할 것도 없어요",
      "전화가 울리면 받으시면 돼요",
      "편하게 대답하시면 그걸로 끝",
    ],
  },
];

export default function ServicePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* FAQPage 구조화 데이터 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* 헤더 — 추적 CTA */}
      <SiteHeader cta={<PreregisterButton size="sm" />} />

      <main className="flex flex-col">
        {/* 히어로 (제품형) */}
        <section className="bg-gradient-to-b from-surface to-bg">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-10 px-5 py-16 sm:px-8 lg:flex-row lg:gap-14 lg:py-24">
            <div className="flex flex-1 flex-col items-center gap-6 text-center">
              <span className="rounded-base bg-accent/15 px-3 py-1 text-sm font-semibold text-accent">
                서비스 안내
              </span>
              <h1 className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl">
                매일 챙기고 싶은
                <br />
                마음은 그대로,
                <br />
                확인 전화만 맡겨 주세요
              </h1>
              <p className="max-w-xl text-lg font-medium leading-relaxed text-text-muted sm:text-xl">
                매일 전화로 &lsquo;약 드셨어요?&rsquo; 여쭤보는 일, 바쁜 하루
                속에서 이어가기 쉽지 않죠. 일정을 등록해 두면 예약한 시간에
                저희가 확인 전화를 걸어 여쭙고, 결과를 정리해 알려드립니다.
              </p>
              <div className="w-full pt-2 sm:w-auto">
                <PreregisterButton />
              </div>
              <p className="text-sm text-text-muted">
                앱 설치 없이, 부모님은 걸려온 전화만 받으시면 됩니다.
              </p>
            </div>

            <div className="w-full flex-1">
              <div className="relative mx-auto aspect-[4/5] w-full max-w-md overflow-hidden rounded-base border border-border shadow-card sm:max-w-lg">
                <Image
                  src="/images/hero-senior-couple.jpg"
                  alt="전화를 받으며 환하게 웃고 계신 어머님과 아버님"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover object-[62%_center]"
                />
              </div>
            </div>
          </div>
        </section>

        {/* 3단계 프로세스 */}
        <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
            이렇게 작동합니다
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-3">
            {STEPS.map((s) => (
              <div
                key={s.step}
                className="flex flex-col items-center gap-4 rounded-base border border-border bg-bg p-8 text-center shadow-card"
              >
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-2xl font-bold text-bg shadow-sm">
                  {s.step}
                </span>
                <h3 className="text-xl font-bold">{s.title}</h3>
                <p className="leading-relaxed text-text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 보호자 / 시니어 관점 혜택 */}
        <section className="bg-surface">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div className="order-2 grid gap-6 lg:order-1">
                {BENEFITS.map((b) => (
                  <div
                    key={b.label}
                    className="flex flex-col gap-3 rounded-base border border-border bg-bg p-6 shadow-card"
                  >
                    <span className="text-sm font-bold text-primary">
                      {b.label}
                    </span>
                    <p className="text-lg font-semibold leading-snug">
                      {b.tagline}
                    </p>
                    <ul className="flex flex-col gap-2">
                      {b.points.map((p) => (
                        <li
                          key={p}
                          className="flex items-start gap-2 leading-relaxed text-text-muted"
                        >
                          <span className="mt-0.5 text-primary" aria-hidden>
                            ✓
                          </span>
                          <span>{p}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>

              <div className="order-1 flex flex-col gap-6 lg:order-2">
                <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
                  앱이 아니라,
                  <br />
                  진짜 전화입니다
                </h2>
                <p className="text-lg leading-relaxed text-text-muted">
                  두 분의 경험은 이렇게 다릅니다. 보호자는 웹으로 챙기고,
                  부모님은 늘 쓰시던 전화를 받기만 하시면 됩니다.
                </p>
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-base border border-border shadow-card">
                  <Image
                    src="/images/family.jpg"
                    alt="손녀와 함께 사진을 찍으며 웃는 할머니"
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 리포트 미리보기 2종 + 억지 판정 금지 카피 */}
        <section className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="flex flex-col items-center gap-4 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              통화가 끝나면,
              <br className="sm:hidden" /> 이런 리포트가 도착해요
            </h2>
            <p className="max-w-xl text-lg leading-relaxed text-text-muted">
              부모님과의 통화를 요약해 보호자에게 알려드리고, 필요하면 대화
              내용까지 그대로 읽어 보실 수 있어요.
            </p>
          </div>

          <div className="mt-12 grid items-start gap-8 lg:grid-cols-2">
            <div className="flex flex-col gap-4">
              <span className="text-sm font-bold text-primary">
                확인이 된 날
              </span>
              <ReportPreviewCard variant="done" />
            </div>
            <div className="flex flex-col gap-4">
              <span className="text-sm font-bold text-accent">
                확인이 안 된 날
              </span>
              <ReportPreviewCard variant="uncertain" />
            </div>
          </div>

          {/* 억지 판정 금지 — 우리의 축 */}
          <div className="mt-12 flex flex-col gap-4 rounded-base border border-accent/25 bg-accent/[0.06] p-6 sm:p-10">
            <h3 className="text-2xl font-bold leading-snug tracking-tight sm:text-3xl">
              억지로 판단하지 않습니다
            </h3>
            <p className="max-w-2xl text-lg leading-relaxed text-text-muted">
              대답이 분명하지 않으면 한 번 더 여쭙고, 그래도 확인이 안 되면
              <strong className="font-bold text-text">
                {" "}
                &lsquo;확인 필요&rsquo;라고 그대로 알려드립니다.
              </strong>{" "}
              어림짐작으로 &lsquo;완료&rsquo;를 만들어 드리지 않아요. 잘못된
              안심보다 정직한 표시가 부모님께 더 안전하다고 믿기 때문입니다.
            </p>
          </div>
        </section>

        {/* 안전·신뢰 원칙 */}
        <section className="bg-surface">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-24">
            <div className="flex flex-col items-center gap-4 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                안전하게, 투명하게
              </h2>
              <p className="max-w-xl text-lg leading-relaxed text-text-muted">
                부모님께 걸려가는 전화이기에, 지키는 원칙을 먼저 밝힙니다.
              </p>
            </div>

            <TrustBadges className="mt-12" />

            <div className="mt-8 flex flex-col gap-3 rounded-base border border-border bg-bg p-6 text-sm leading-relaxed text-text-muted shadow-card">
              <p>
                통화가 시작되면 부모님께 &lsquo;자동 안내 전화&rsquo;라는 점을
                먼저 말씀드립니다. 사람이 통화를 엿듣거나 녹음을 보관하지
                않습니다.
              </p>
              <p>
                Senior Scheduler는 의료 조언이나 진단을 제공하지 않습니다.
                건강에 관한 판단은 반드시 의료 전문가와 상의해 주세요.
              </p>
              {/* 119 고지 — lib/contracts 단일 소스 */}
              <p>{EMERGENCY_DISCLAIMER}</p>
            </div>
          </div>
        </section>

        {/* 자주 묻는 질문 (FAQ) */}
        <FaqSection />

        {/* 마지막 CTA 배너 */}
        <section className="px-5 py-16 sm:px-8 sm:py-20">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 rounded-base border border-primary/10 bg-primary-soft px-5 py-14 text-center shadow-card sm:px-8 sm:py-16">
            <h2 className="text-3xl font-bold leading-tight tracking-tight text-text sm:text-4xl">
              오늘부터 부모님께
              <br className="sm:hidden" /> 따뜻한 전화를 시작해 보세요
            </h2>
            <p className="max-w-xl text-lg leading-relaxed text-text-muted">
              정식 출시되면 이메일로 가장 먼저 안내드릴게요.
            </p>
            <div className="w-full sm:w-auto">
              <PreregisterButton />
            </div>
            <p className="text-sm text-text-muted">
              더 궁금하시면{" "}
              <Link href="/faq" className="font-semibold text-primary underline">
                자주 묻는 질문
              </Link>
              도 살펴보세요.
            </p>
          </div>
        </section>
      </main>

      {/* 푸터 */}
      <SiteFooter />
    </div>
  );
}
