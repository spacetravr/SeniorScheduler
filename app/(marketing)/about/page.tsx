/**
 * 소개 (`/about`) — "이 서비스를 왜, 누가, 어떤 원칙으로 만들었는가".
 * docs/site-structure.md §1 역할 분담에 따라 **제품 사용법 설명(3단계·리포트 예시)은 `/service` 담당**이며,
 * 이 페이지는 만든 이유 → 지키는 원칙 → 하지 않는 것 → 팀·베타 현황 → 안내로 구성한다.
 * (이전 버전은 `/service` 와 콘텐츠가 겹쳐 중복 색인 위험이 있었음 — 제품 설명은 링크로만 연결.)
 *
 * [CTA 추적] 이 페이지는 **추적하지 않는 PreregisterLink**를 사용한다(무변경).
 *   이유: VIEW 는 `/` 와 `/service` 에서만 보낸다는 규칙(docs/site-structure.md §5-1) — 중복 집계 방지.
 *
 * 카피 규칙: "자녀를 대신/대체" 금지(→ 거들다·보완), 의료 효능 주장·미구현 기능·가격 숫자·창작 수치 금지.
 * 확인되지 않은 팀 정보(실명·소속·사진)는 쓰지 않는다.
 */
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Ban,
  BellOff,
  Bot,
  CircleQuestionMark,
  Mail,
  Megaphone,
  MicOff,
  PowerOff,
  ShieldCheck,
  Smartphone,
  Siren,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";
import { PageShell } from "@/components/marketing/PageShell";
import { PreregisterLink } from "@/components/marketing/PreregisterLink";
import { TrustBadges } from "@/components/marketing/TrustBadges";
import { EMERGENCY_DISCLAIMER } from "@/lib/contracts/report-view";

/** `/` `/service` 와 겹치지 않는 설명 — 제품 설명이 아니라 만든 이유·원칙을 다룬다. */
const ABOUT_DESCRIPTION =
  "Senior Scheduler를 왜 만들었는지, 그리고 부모님께 전화를 걸며 지키는 원칙을 밝힙니다. 억지로 판단하지 않기, 본인 동의 후에만 발신하기, 녹음을 남기지 않기 — 저희가 하지 않는 일까지 함께 적었습니다.";
const OG_IMAGE = "/images/hero-senior-couple.jpg";

export const metadata: Metadata = {
  title: "소개",
  description: ABOUT_DESCRIPTION,
  alternates: { canonical: "/about" },
  openGraph: {
    title: "소개 | Senior Scheduler",
    description: ABOUT_DESCRIPTION,
    type: "website",
    locale: "ko_KR",
    siteName: "Senior Scheduler",
    url: "/about",
    images: [
      {
        url: OG_IMAGE,
        alt: "전화를 받으며 환하게 웃고 계신 부모님",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "소개 | Senior Scheduler",
    description: ABOUT_DESCRIPTION,
    images: [OG_IMAGE],
  },
};

type Principle = {
  icon: LucideIcon;
  title: string;
  body: string;
};

/**
 * 지키는 원칙 — 이 페이지의 핵심 블록.
 * TrustBadges(4배지)가 요약이라면, 여기는 그 배경까지 서술하는 확장판이다.
 */
const PRINCIPLES: Principle[] = [
  {
    icon: CircleQuestionMark,
    title: "억지로 판단하지 않습니다",
    body: "대답이 분명하지 않으면 한 번 더 여쭙고, 그래도 확인이 안 되면 '확인 필요'라고 그대로 남깁니다. 어림짐작으로 '완료'를 만들어 드리면 보호자님은 안심하시겠지만, 그 안심은 사실이 아닙니다. 정직한 표시가 잘못된 안심보다 안전하다고 믿습니다.",
  },
  {
    icon: ShieldCheck,
    title: "부모님 본인 동의 없이는 전화하지 않습니다",
    body: "보호자님이 등록하셨더라도 그것만으로는 전화를 걸지 않습니다. 첫 통화에서 부모님께 어떤 서비스인지 직접 안내드리고, 부모님이 동의하신 뒤에야 이후 안내 전화가 시작됩니다. 받는 분이 모르는 전화는 걸지 않는다는 뜻입니다.",
  },
  {
    icon: MicOff,
    title: "통화 음성을 저장하지 않습니다",
    body: "통화 녹음 파일은 보관하지 않습니다. 보호자님께 전해 드릴 내용만 텍스트로 정리해 남기고, 음성 자체는 남기지 않습니다. 부모님의 목소리는 저희가 모아 둘 자산이 아닙니다.",
  },
  {
    icon: Bot,
    title: "AI가 거는 전화임을 먼저 밝힙니다",
    body: "통화가 시작되면 자동 안내 전화라는 점을 부모님께 가장 먼저 말씀드립니다. 사람인 척하지 않습니다. 사람이 통화를 엿듣지도 않습니다.",
  },
  {
    icon: BellOff,
    title: "불필요한 알림을 보내지 않습니다",
    body: "별일이 없으면 조용히 있는 것이 좋은 서비스라고 생각합니다. 평소와 다른 신호가 있을 때 알려드리고, 그렇지 않은 날의 기록은 보호자님이 원하실 때 확인하시면 됩니다. 매일 울리는 알림은 결국 보지 않게 되니까요.",
  },
  {
    icon: Stethoscope,
    title: "의료 조언을 하지 않습니다",
    body: "저희는 진단하거나 처방하거나 건강에 대해 판단하지 않습니다. 부모님이 말씀하신 내용을 그대로 정리해 전해 드릴 뿐이며, 건강에 관한 판단은 반드시 의료 전문가와 상의해 주세요.",
  },
  {
    icon: Siren,
    title: "긴급구조를 대신하지 않습니다",
    body: EMERGENCY_DISCLAIMER,
  },
];

/** 하지 않는 것 — 확인 가능한 사실만 적는다. */
const NOT_DOING: Principle[] = [
  {
    icon: PowerOff,
    title: "약정도, 위약금도 없습니다",
    body: "묶어 두는 방식으로 남아 계시게 하고 싶지 않습니다. 필요하지 않다고 느끼시면 언제든 발신을 끄실 수 있습니다.",
  },
  {
    icon: Smartphone,
    title: "부모님께 앱 설치를 요구하지 않습니다",
    body: "부모님께는 늘 쓰시던 일반 전화로 연락드립니다. 새로 배우실 것도, 설치하실 것도 없습니다.",
  },
  {
    icon: Megaphone,
    title: "부모님을 광고 대상으로 삼지 않습니다",
    body: "통화 중에 무언가를 권하거나 팔지 않습니다. 전화의 목적은 여쭙고 전해 드리는 것 하나입니다.",
  },
  {
    icon: Ban,
    title: "통화 내용을 광고에 쓰지 않습니다",
    body: "부모님과의 대화에서 정리된 내용은 보호자님께 전해 드리기 위한 것입니다. 광고 목적으로 활용하지 않습니다.",
  },
];

const CONTACT_EMAIL = "spacetr17@khu.ac.kr";

export default function AboutPage() {
  return (
    <PageShell>
      {/* 히어로 — 회사·팀의 자기소개 (제품 히어로와 구분) */}
      <section className="bg-gradient-to-b from-surface to-bg">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-5 py-16 text-center sm:px-8 sm:py-24">
          <span className="rounded-base bg-accent/15 px-3 py-1 text-sm font-semibold text-accent">
            소개
          </span>
          <h1 className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
            매일 여쭙고 싶은 마음을,
            <br />
            거들기 위해 만들었습니다
          </h1>
          <p className="max-w-xl text-lg font-medium leading-relaxed text-text-muted sm:text-xl">
            Senior Scheduler는 부모님께 걸려가는 전화를 다루는 서비스입니다.
            그래서 무엇을 지키고 무엇은 하지 않는지 먼저 밝히는 것이 맞다고
            생각했습니다. 이 페이지에는 저희가 이 서비스를 만든 이유와 지키는
            원칙을 적었습니다.
          </p>
        </div>
      </section>

      {/* 1. 왜 만들었나 — 죄책감 자극 금지, 상황을 담담히 */}
      <section className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-20">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          왜 만들었나
        </h2>
        <div className="mt-8 flex flex-col gap-5 text-lg leading-relaxed text-text-muted">
          <p>
            부모님과 떨어져 사는 3050 자녀에게 &lsquo;오늘 약 드셨어요?&rsquo;
            라는 한 통의 전화는 어렵지 않은 일처럼 보입니다. 그런데 회의가
            길어지고, 아이 하원 시간이 겹치고, 부모님이 주무실 시간이 되면 그
            전화는 오늘도 내일로 밀립니다. 마음이 부족해서가 아니라, 하루의
            모양이 그렇습니다.
          </p>
          <p>
            그렇다고 부모님께 새로운 기기나 앱을 드리는 방법도 잘 맞지
            않았습니다. 챙겨야 할 것이 하나 더 늘어나는 쪽은 대체로 부모님이고,
            결국 쓰지 않게 됩니다.
          </p>
          <p>
            그래서 반대로 접근했습니다. 어려운 조작은 익숙한 보호자님이 웹에서
            맡고, 부모님께는 늘 쓰시던 전화 한 통이 걸려가는 방식입니다.
            부모님의 하루는 그대로 두고, 확인만 저희가 거듭니다.
          </p>
          <p className="text-text">
            <strong className="font-bold">
              저희는 자녀분을 대체하려고 만들지 않았습니다.
            </strong>{" "}
            안부 전화의 따뜻함은 자녀분의 몫입니다. 저희는 그 사이사이, 놓치기
            쉬운 확인을 맡습니다.
          </p>
        </div>
      </section>

      {/* 2. 지키는 원칙 — 이 페이지의 핵심 */}
      <section className="bg-surface">
        <div className="mx-auto w-full max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="flex flex-col items-center gap-4 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              우리가 지키는 원칙
            </h2>
            <p className="max-w-xl text-lg leading-relaxed text-text-muted">
              부모님께 직접 걸려가는 전화이기에, 편의보다 먼저 정한 기준입니다.
            </p>
          </div>

          {/* 신뢰 4배지 축약형 — 아래 서술형 원칙의 요약 (공용 컴포넌트 재사용) */}
          <TrustBadges variant="compact" className="mt-10" />

          <ol className="mt-10 flex flex-col gap-4">
            {PRINCIPLES.map(({ icon: Icon, title, body }, index) => (
              <li
                key={title}
                className="flex flex-col gap-4 rounded-base border border-border bg-bg p-6 shadow-card sm:flex-row sm:gap-6 sm:p-8"
              >
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-base bg-primary-soft">
                  <Icon className="h-6 w-6 text-primary" aria-hidden />
                </span>
                <div className="flex flex-col gap-2">
                  <h3 className="text-xl font-bold leading-snug">
                    <span className="mr-2 text-base font-bold text-text-muted">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {title}
                  </h3>
                  <p className="leading-relaxed text-text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 3. 우리가 하지 않는 것 */}
      <section className="mx-auto w-full max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            우리가 하지 않는 것
          </h2>
          <p className="max-w-xl text-lg leading-relaxed text-text-muted">
            무엇을 하는지만큼 무엇을 하지 않는지도 약속드립니다.
          </p>
        </div>

        <ul className="mt-10 grid gap-5 sm:grid-cols-2">
          {NOT_DOING.map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="flex flex-col gap-3 rounded-base border border-border bg-bg p-6 shadow-card"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-base bg-accent/10">
                <Icon className="h-5 w-5 text-accent" aria-hidden />
              </span>
              <h3 className="text-lg font-bold leading-snug">{title}</h3>
              <p className="leading-relaxed text-text-muted">{body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* 4. 팀·베타 현황 — 확인되지 않은 정보는 쓰지 않는다 */}
      <section className="bg-surface">
        <div className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-20">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            지금 어디쯤 와 있나
          </h2>
          <div className="mt-8 flex flex-col gap-5 text-lg leading-relaxed text-text-muted">
            <p>
              Senior Scheduler는 아직 정식 출시 전, 베타를 준비하는 단계입니다.
              화면과 통화 흐름을 만들어 두고 실제 통화 품질을 다듬고 있습니다.
              부풀려 말씀드리기보다 지금 상태 그대로 알려드리는 편이 낫다고
              생각합니다.
            </p>
            <p>
              만드는 사람은 아직 소수입니다. 팀과 회사 정보는 정식 출시에 맞춰 이
              자리에 정확히 밝히겠습니다. 그전까지는 확인되지 않은 이야기를 적지
              않겠습니다.
            </p>
            <p>
              지금 필요한 것은 &lsquo;정말 이런 게 필요한가&rsquo;에 대한
              보호자님들의 답입니다. 사전등록해 주시면 준비되는 대로 이메일로
              가장 먼저 안내드리고, 의견도 여쭙겠습니다.
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-2 rounded-base border border-border bg-bg p-6 shadow-card">
            <span className="flex items-center gap-2 text-base font-bold text-text">
              <Mail className="h-5 w-5 text-primary" aria-hidden />
              문의·제휴·취재
            </span>
            <p className="leading-relaxed text-text-muted">
              어떤 의견이든 환영합니다.{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-semibold text-primary underline underline-offset-4"
              >
                {CONTACT_EMAIL}
              </a>
              로 보내 주세요.
            </p>
          </div>
        </div>
      </section>

      {/* 5. 서비스 상세 안내 + 사전등록 CTA */}
      <section className="px-5 py-16 sm:px-8 sm:py-20">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 rounded-base border border-primary/10 bg-primary-soft px-5 py-14 text-center shadow-card sm:px-8 sm:py-16">
          <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            어떻게 작동하는지
            <br className="sm:hidden" /> 궁금하시다면
          </h2>
          <p className="max-w-xl text-lg leading-relaxed text-text-muted">
            일정 등록부터 통화, 리포트까지의 흐름과 실제 리포트 예시는 서비스
            안내 페이지에 자세히 담았습니다.
          </p>
          <Link
            href="/service"
            className="inline-flex w-full items-center justify-center gap-2 rounded-base border border-primary/40 bg-bg px-6 py-4 text-base font-semibold text-primary transition-colors hover:bg-primary-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:w-auto sm:min-w-56"
          >
            서비스 알아보기
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <div className="w-full pt-2 sm:w-auto">
            {/* 비추적 CTA — VIEW·CLICK 집계는 `/`·`/service` 에서만 (§5-1) */}
            <PreregisterLink />
          </div>
        </div>
      </section>
    </PageShell>
  );
}
