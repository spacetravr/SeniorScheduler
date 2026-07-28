/**
 * 서비스 소개 (`/about`) — 랜딩보다 깊게 작동 방식·안심 설계를 설명하는 페이지.
 * 히어로 → 작동 방식 3단계 상세(상태 뱃지·재시도 규칙 포함) → 리포트 예시(공용 카드 재사용)
 * → 안심 설계 → CTA. 색·라운드·타이포는 토큰만 사용, 추적 없는 PreregisterLink 사용.
 */
import type { Metadata } from "next";
import { PageShell } from "@/components/marketing/PageShell";
import { PreregisterLink } from "@/components/marketing/PreregisterLink";
import { ReportPreviewCard } from "@/components/marketing/ReportPreviewCard";

const ABOUT_DESCRIPTION =
  "Senior Scheduler를 만든 이유와 지키는 원칙을 소개합니다. 작동 방식, 리포트 상태 뱃지의 의미, 억지로 판단하지 않는 안심 설계를 확인하세요.";

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
        url: "/images/hero-senior-couple.jpg",
        alt: "전화를 받으며 환하게 웃고 계신 부모님",
      },
    ],
  },
};

/** 작동 방식 3단계 — 랜딩보다 깊게: 화면 묘사 + 규칙 + 상태 의미. */
const STEPS = [
  {
    step: "1",
    title: "웹에서 일정을 등록해요",
    body: "보호자가 웹에서 부모님을 등록하고, 복약·병원·식사 같은 반복 일정을 추가합니다. 요일과 시간을 정해 두면 그 시간에 맞춰 전화가 준비돼요.",
    detail: [
      "부모님별로 전화번호와 일정을 각각 관리해요.",
      "일정마다 전화 발신을 켜고 끌 수 있어, 필요할 때만 걸리도록 조절할 수 있어요.",
    ],
  },
  {
    step: "2",
    title: "예약한 시간에 자동으로 전화해요",
    body: "부모님이 평소 쓰시던 일반 전화로 안내 전화가 걸려갑니다. 부모님은 걸려온 전화를 받아 편하게 대답만 하시면 돼요.",
    detail: [
      "짧고 또렷한 안내 멘트로 오늘의 일정을 여쭤봐요.",
      "받지 못하시면 1분 후, 다시 10분 후에 자동으로 재시도해요.",
      "그래도 연결되지 않으면 억지로 판단하지 않고 '부재'로 정리해 알려드려요.",
    ],
  },
  {
    step: "3",
    title: "결과를 리포트로 정리해 드려요",
    body: "통화가 끝나면 부모님의 응답을 요약해 보호자 웹에 리포트로 남겨 드립니다. 필요하면 대화 내용을 그대로 읽어 보실 수도 있어요.",
    detail: [
      "약을 드셨는지, 오늘 기분과 특이사항은 어땠는지 한눈에 확인해요.",
      "대답이 분명하지 않으면 한 번 더 여쭙고, 그래도 애매하면 '확인 필요'로 솔직하게 남겨요.",
    ],
  },
];

/** 리포트 상태 뱃지 의미 — 억지 판정 금지 원칙을 그대로 노출. */
const STATUS_BADGES = [
  {
    label: "완료",
    tone: "primary" as const,
    meaning: "일정을 챙기셨다고 확인된 경우예요.",
  },
  {
    label: "미완료",
    tone: "accent" as const,
    meaning: "아직 하지 않으셨다고 답하신 경우예요.",
  },
  {
    label: "나중에",
    tone: "muted" as const,
    meaning: "이따 하시겠다고 미루신 경우예요.",
  },
  {
    label: "확인 필요",
    tone: "muted" as const,
    meaning: "대답이 분명하지 않아 억지로 판단하지 않은 경우예요.",
  },
  {
    label: "부재",
    tone: "muted" as const,
    meaning: "재시도까지 했지만 전화를 받지 못하신 경우예요.",
  },
];

/** 안심 설계 포인트. */
const TRUST_POINTS = [
  {
    title: "녹음 원본을 저장하지 않아요",
    body: "통화 음성 파일은 보관하지 않습니다. 필요한 내용만 텍스트로 정리해 보호자에게 전달드려요.",
  },
  {
    title: "본인 동의 후에만 전화해요",
    body: "첫 통화에서 부모님 본인께 안내드리고 동의를 확인한 뒤에만 이후 안내 전화를 발신합니다. 동의 전에는 실제 전화가 걸려가지 않아요.",
  },
  {
    title: "억지로 판단하지 않아요",
    body: "대답이 애매하면 한 번 더 여쭙고, 그래도 불확실하면 '확인 필요'로 솔직하게 남겨요. 잘못된 안심을 드리지 않기 위해서예요.",
  },
  {
    title: "의료 조언은 하지 않아요",
    body: "Senior Scheduler는 진단이나 의료 조언을 제공하지 않습니다. 일정 안내와 안부 확인을 돕는 도구이며, 건강 판단은 전문가와 상의해 주세요.",
  },
];

function badgeToneClass(tone: "primary" | "accent" | "muted"): string {
  if (tone === "primary") return "bg-primary text-bg";
  if (tone === "accent") return "bg-accent text-bg";
  return "bg-surface text-text-muted";
}

export default function AboutPage() {
  return (
    <PageShell>
      {/* 히어로 */}
      <section className="bg-gradient-to-b from-surface to-bg">
        <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-5 py-16 text-center sm:px-8 sm:py-24">
          <span className="rounded-base bg-accent/15 px-3 py-1 text-sm font-semibold text-accent">
            소개
          </span>
          <h1 className="text-4xl font-bold leading-[1.15] tracking-tight sm:text-5xl">
            멀리 있어도, 매일
            <br />
            부모님을 챙길 수 있게
          </h1>
          <p className="max-w-xl text-lg font-medium leading-relaxed text-text-muted sm:text-xl">
            보호자가 부모님의 복약·병원 일정을 웹에 등록해 두면, 예약한 시간에
            부모님 일반 전화로 안부·확인 전화를 걸어 드리고 결과를 리포트로
            알려드립니다. 매일 챙기고 싶은 마음을 거들 뿐, 부모님은 앱도 배울
            것도 필요 없어요.
          </p>
        </div>
      </section>

      {/* 작동 방식 3단계 상세 */}
      <section className="mx-auto w-full max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            어떻게 작동하나요
          </h2>
          <p className="max-w-xl text-lg leading-relaxed text-text-muted">
            등록부터 리포트까지, 세 단계로 이어집니다.
          </p>
        </div>

        <div className="mt-12 flex flex-col gap-6">
          {STEPS.map((s) => (
            <div
              key={s.step}
              className="flex flex-col gap-4 rounded-base border border-border bg-bg p-6 shadow-card sm:flex-row sm:gap-6 sm:p-8"
            >
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary text-2xl font-bold text-bg shadow-sm">
                {s.step}
              </span>
              <div className="flex flex-col gap-3">
                <h3 className="text-xl font-bold">{s.title}</h3>
                <p className="leading-relaxed text-text-muted">{s.body}</p>
                <ul className="flex flex-col gap-2 pt-1">
                  {s.detail.map((d) => (
                    <li
                      key={d}
                      className="flex items-start gap-2 leading-relaxed text-text-muted"
                    >
                      <span className="mt-0.5 text-primary" aria-hidden>
                        ✓
                      </span>
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 리포트 예시 */}
      <section className="bg-surface">
        <div className="mx-auto w-full max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
          <div className="flex flex-col items-center gap-4 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              이런 리포트를 받아 보세요
            </h2>
            <p className="max-w-xl text-lg leading-relaxed text-text-muted">
              통화 요약과 기분·건강 표시, 그리고 대화 내용까지 한 화면에서
              확인하실 수 있어요.
            </p>
          </div>

          <div className="mt-12 grid items-start gap-8 lg:grid-cols-2">
            <div className="mx-auto w-full max-w-md">
              <ReportPreviewCard />
            </div>

            <div className="flex flex-col gap-4">
              <h3 className="text-xl font-bold">상태 뱃지가 알려주는 것</h3>
              <p className="leading-relaxed text-text-muted">
                리포트 상단의 상태 뱃지 하나로 오늘 일정을 챙기셨는지 빠르게
                파악하실 수 있어요. 애매한 경우 억지로 판단하지 않는 것이
                원칙입니다.
              </p>
              <ul className="flex flex-col gap-3">
                {STATUS_BADGES.map((b) => (
                  <li
                    key={b.label}
                    className="flex items-start gap-3 rounded-base border border-border bg-bg p-3.5"
                  >
                    <span
                      className={`inline-flex shrink-0 items-center rounded-base px-2.5 py-1 text-xs font-semibold leading-none ${badgeToneClass(
                        b.tone,
                      )}`}
                    >
                      {b.label}
                    </span>
                    <span className="text-sm leading-relaxed text-text-muted">
                      {b.meaning}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 안심 설계 */}
      <section className="mx-auto w-full max-w-4xl px-5 py-16 sm:px-8 sm:py-24">
        <div className="flex flex-col items-center gap-4 text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            안심하고 쓰실 수 있도록
          </h2>
          <p className="max-w-xl text-lg leading-relaxed text-text-muted">
            부모님과 보호자 모두 마음 편히 쓰실 수 있게 설계했어요.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2">
          {TRUST_POINTS.map((t) => (
            <div
              key={t.title}
              className="flex flex-col gap-2 rounded-base border border-border bg-bg p-6 shadow-card"
            >
              <h3 className="text-lg font-bold">{t.title}</h3>
              <p className="leading-relaxed text-text-muted">{t.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-20 sm:px-8">
        <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-6 rounded-base border border-primary/10 bg-primary-soft px-5 py-14 text-center shadow-card sm:px-8 sm:py-16">
          <h2 className="text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            오늘부터 부모님께
            <br className="sm:hidden" /> 따뜻한 전화를 시작해 보세요
          </h2>
          <p className="max-w-xl text-lg leading-relaxed text-text-muted">
            베타 기간에는 무료로 이용하실 수 있어요. 사전등록하시면 정식 출시
            소식을 가장 먼저 안내드릴게요.
          </p>
          <PreregisterLink />
        </div>
      </section>
    </PageShell>
  );
}
