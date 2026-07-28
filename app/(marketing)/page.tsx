/**
 * 홈페이지 (`/`) — 회사·서비스의 얼굴 (docs/site-structure.md §2).
 * 무엇을 하는 곳인지 30초 안에. 팔지 않고 소개한다 — 스크롤 3~4화면.
 * 제품 설명의 본진은 `/service` 로 이관됨. 이 경로는 외부 링크가 살아 있으므로 200 유지·리다이렉트 금지.
 *
 * [CTA 추적] 이 페이지는 **추적되는 PreregisterButton**을 사용한다.
 *   이유: 검색·직접 유입의 원 진입점이며, VIEW는 `/`와 `/service`에서만 보낸다는 규칙(§5-1).
 *   (VIEW는 useCtaTracking이 sessionStorage 플래그로 세션당 1회만 전송 — 중복 집계 없음.)
 */
import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { PreregisterButton } from "@/components/marketing/PreregisterButton";
import { SiteHeader } from "@/components/marketing/SiteHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { TrustBadges } from "@/components/marketing/TrustBadges";

const HOME_TITLE = "부모님 복약·안부 전화 자동으로 | Senior Scheduler";
const HOME_DESCRIPTION =
  "Senior Scheduler는 보호자가 등록한 시간에 부모님 일반 전화로 안부·복약 확인 전화를 걸고, 결과를 정직한 리포트로 전해 드리는 서비스입니다. 앱 설치 없이, 동의하신 뒤에만 전화드립니다.";
const OG_IMAGE = "/images/hero-senior-couple.jpg";

export const metadata: Metadata = {
  title: {
    absolute: HOME_TITLE,
  },
  description: HOME_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    type: "website",
    locale: "ko_KR",
    siteName: "Senior Scheduler",
    url: "/",
    images: [
      {
        url: OG_IMAGE,
        alt: "전화를 받으며 환하게 웃고 계신 어머님과 아버님",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

/** 리포트 미리보기 요약 2종 — 자세한 예시 카드는 `/service` 에 있다. */
const REPORT_GLANCE = [
  {
    status: "복약 완료",
    tone: "primary" as const,
    summary:
      "혈압약을 방금 챙겨 드셨다고 하셨어요. 오늘은 경로당에 다녀오실 예정이래요.",
  },
  {
    status: "확인 필요",
    tone: "accent" as const,
    summary:
      "여쭤봤지만 확실한 답을 듣지 못했어요. 확인이 필요해요.",
  },
];

const CONTACT_EMAIL = "spacetr17@khu.ac.kr";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* 헤더 — 추적 CTA */}
      <SiteHeader cta={<PreregisterButton size="sm" />} />

      <main className="flex flex-col">
        {/* 1. 히어로 */}
        <section className="bg-gradient-to-b from-surface to-bg">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-10 px-5 py-16 sm:px-8 lg:flex-row lg:gap-14 lg:py-24">
            <div className="flex flex-1 flex-col items-center gap-6 text-center lg:items-start lg:text-left">
              <span className="font-brand text-sm font-bold tracking-tight text-primary">
                Senior Scheduler
              </span>
              <h1 className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl lg:text-6xl">
                부모님의 하루는
                <br />
                그대로, 확인은 저희가
              </h1>
              <p className="max-w-xl text-lg font-medium leading-relaxed text-text-muted sm:text-xl">
                등록해 두신 시간에 부모님의 일반 전화로 안부와 일정을 여쭙고,
                결과를 보호자님께 정리해 전해 드립니다.
              </p>
              <div className="flex w-full flex-col gap-3 pt-2 sm:w-auto sm:flex-row sm:items-center">
                {/* 주 CTA는 사전등록(추적), 보조는 서비스 알아보기(내부 이동) */}
                <PreregisterButton label="사전등록하기" />
                <Link
                  href="/service"
                  className="inline-flex w-full items-center justify-center rounded-base border border-primary/40 px-6 py-4 text-base font-semibold text-primary transition-colors hover:bg-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto sm:min-w-48"
                >
                  서비스 알아보기
                </Link>
              </div>
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

        {/* 2. 한 문단 소개 */}
        <section className="mx-auto w-full max-w-3xl px-5 py-16 text-center sm:px-8 sm:py-20">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            저희가 하는 일
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-text-muted sm:text-xl">
            멀리 계신 부모님께 매일 전화로 여쭙고 싶은 마음은 누구나 같습니다.
            저희는 그 마음을 거들어, 보호자님이 등록해 두신 일정에 맞춰 부모님께
            확인 전화를 걸어 드립니다. 부모님은 앱도 설치도 필요 없이 걸려온
            전화를 받으시면 되고, 보호자님은 결과를 리포트로 확인하시면 됩니다.
          </p>
        </section>

        {/* 3. 신뢰 배지 — 홈에서 가장 중요한 블록 */}
        <section className="bg-surface">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 sm:px-8 sm:py-20">
            <div className="flex flex-col items-center gap-3 text-center">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                지키는 원칙
              </h2>
              <p className="max-w-xl leading-relaxed text-text-muted">
                부모님께 걸려가는 전화이기에, 무엇을 지키는지 먼저 밝힙니다.
              </p>
            </div>
            <TrustBadges className="mt-10" />
          </div>
        </section>

        {/* 4. 리포트 미리보기 2종 요약 */}
        <section className="mx-auto w-full max-w-4xl px-5 py-16 sm:px-8 sm:py-20">
          <div className="flex flex-col items-center gap-3 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              통화 결과는 이렇게 전해 드려요
            </h2>
            <p className="max-w-xl leading-relaxed text-text-muted">
              확인이 안 되면 억지로 판단하지 않고,{" "}
              <strong className="font-bold text-text">
                &lsquo;확인 필요&rsquo;라고 그대로
              </strong>{" "}
              알려드립니다.
            </p>
          </div>

          <ul className="mt-10 grid gap-4 sm:grid-cols-2">
            {REPORT_GLANCE.map((r) => (
              <li
                key={r.status}
                className="flex flex-col gap-3 rounded-base border border-border bg-bg p-6 shadow-card"
              >
                <span
                  className={`inline-flex w-fit items-center rounded-base px-2.5 py-1 text-xs font-semibold leading-none text-bg ${
                    r.tone === "primary" ? "bg-primary" : "bg-accent"
                  }`}
                >
                  {r.status}
                </span>
                <p className="leading-relaxed text-text-muted">{r.summary}</p>
              </li>
            ))}
          </ul>

          <p className="mt-8 text-center">
            <Link
              href="/service"
              className="font-semibold text-primary underline underline-offset-4"
            >
              리포트 예시 자세히 보기
            </Link>
          </p>
        </section>

        {/* 5. 소식·문의 */}
        <section className="bg-surface">
          <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-5 px-5 py-16 text-center sm:px-8 sm:py-20">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              지금은 베타를 준비하고 있습니다
            </h2>
            <p className="max-w-xl text-lg leading-relaxed text-text-muted">
              정식 출시를 준비 중이며, 사전등록해 주시면 준비되는 대로 이메일로
              가장 먼저 안내드릴게요. 제휴·취재·문의도 언제든 환영합니다.
            </p>
            <div className="w-full sm:w-auto">
              <PreregisterButton label="사전등록하기" />
            </div>
            <p className="text-sm text-text-muted">
              문의:{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-semibold text-primary underline underline-offset-4"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </div>
        </section>
      </main>

      {/* 6. 푸터 */}
      <SiteFooter />
    </div>
  );
}
