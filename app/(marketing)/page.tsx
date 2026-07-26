/**
 * 랜딩 v2 (`/`) — 설문과 함께 배포되는 출시 직전형 홈페이지.
 * 글 최소화 · 큰 글씨 · 넓은 여백. 데스크톱 풀블리드 히어로 + max-w-6xl 섹션, 모바일 완전 반응형.
 * 인터랙션·추적은 클라이언트 컴포넌트(PreregisterButton)에 위임하고, 나머지는 서버 렌더.
 * 브랜드: Senior Scheduler.
 */
import Image from "next/image";
import { PreregisterButton } from "@/components/marketing/PreregisterButton";
import { FaqSection } from "@/components/marketing/FaqSection";
import { FAQ_ITEMS } from "@/components/marketing/faqData";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { ReportPreviewCard } from "@/components/marketing/ReportPreviewCard";

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

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* FAQPage 구조화 데이터 */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* 헤더 */}
      <SiteHeader cta={<PreregisterButton size="sm" />} />

      <main className="flex flex-col">
        {/* 히어로 */}
        <section className="bg-gradient-to-b from-surface to-bg">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-10 px-5 py-16 sm:px-8 lg:flex-row lg:gap-14 lg:py-24">
            <div className="flex flex-1 flex-col items-center gap-6 text-center">
              <span className="rounded-base bg-accent/15 px-3 py-1 text-sm font-semibold text-accent">
                Senior Scheduler
              </span>
              <h1 className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl">
                부모님의 하루,
                <br />
                전화 한 통으로
                <br />
                대신 챙겨 드려요
              </h1>
              <p className="max-w-xl text-lg font-medium leading-relaxed text-text-muted sm:text-xl">
                매일 전화로 &lsquo;약 드셨어요?&rsquo; 확인하기, 언제까지
                이어갈 수 있을까요? 일정을 등록해 두면 예약한 시간에 저희가
                대신 안부 전화를 걸어 확인하고 결과를 알려드립니다.
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

        {/* 리포트 미리보기 */}
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

          <div className="mx-auto mt-12 w-full max-w-md">
            <ReportPreviewCard />
          </div>
        </section>

        {/* 자주 묻는 질문 (FAQ) */}
        <section className="bg-surface">
          <FaqSection />
        </section>

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
          </div>
        </section>
      </main>

      {/* 푸터 */}
      <SiteFooter />
    </div>
  );
}
