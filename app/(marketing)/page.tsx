/**
 * 랜딩 페이지 (PLAN.md Phase 0-3, 0-4)
 * 히어로 → 문제 공감 → 작동 3단계 → 가격 티저 → CTA 2개 + 대기자 모달.
 * 대부분 서버 컴포넌트, 인터랙션·추적은 CtaSection(클라이언트)에 위임.
 */
import { CtaSection } from "@/components/marketing/CtaSection";
import { PRICING } from "@/lib/contracts/pricing";

const PROBLEMS = [
  {
    icon: "📍",
    title: "멀리 계셔서 챙기기 어려워요",
    body: "매일 전화로 복약이나 병원 일정을 여쭤보기엔 서로 부담이 됩니다.",
  },
  {
    icon: "💊",
    title: "약을 드셨는지 알 수 없어요",
    body: "제때 챙겨 드셨는지 확인할 방법이 없어 늘 마음이 쓰입니다.",
  },
  {
    icon: "📱",
    title: "새 앱은 설치가 어려워요",
    body: "부모님께 앱 설치와 사용법을 알려드리는 일부터가 큰 벽입니다.",
  },
];

const STEPS = [
  {
    step: "1",
    title: "웹에서 일정 등록",
    body: "보호자가 복약·병원 등 일정을 웹에서 간단히 등록합니다.",
  },
  {
    step: "2",
    title: "부모님께 자동 전화",
    body: "예약한 시간에 부모님의 일반 전화로 안내 전화가 걸려갑니다.",
  },
  {
    step: "3",
    title: "결과를 리포트로",
    body: "부모님의 응답을 정리해 보호자에게 결과를 알려드립니다.",
  },
];

export default function LandingPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-16 px-5 pb-24 pt-12 sm:gap-24 sm:pt-20">
      {/* 히어로 */}
      <section className="flex flex-col items-center gap-5 text-center">
        <span className="rounded-base bg-surface px-3 py-1 text-sm font-medium text-text-muted">
          부모님을 위한 안부·복약 전화 서비스
        </span>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
          앱 설치 없이,
          <br />
          전화 한 통으로
        </h1>
        <p className="max-w-md text-base leading-relaxed text-text-muted sm:text-lg">
          보호자가 부모님의 일정을 등록하면, 예약한 시간에 부모님의 일반
          전화로 자동으로 안내하고 확인해 드립니다. 부모님은 걸려온 전화만
          받으시면 됩니다.
        </p>
        <div className="w-full pt-2">
          <CtaSection />
        </div>
        <p className="text-sm text-text-muted">{PRICING.betaLabel}</p>
      </section>

      {/* 문제 공감 */}
      <section className="flex flex-col gap-6">
        <h2 className="text-center text-2xl font-bold">
          멀리 사는 부모님,
          <br className="sm:hidden" /> 이런 걱정 있으셨나요?
        </h2>
        <div className="flex flex-col gap-4">
          {PROBLEMS.map((p) => (
            <div
              key={p.title}
              className="flex items-start gap-4 rounded-base bg-surface p-5"
            >
              <span className="text-2xl" aria-hidden>
                {p.icon}
              </span>
              <div className="flex flex-col gap-1">
                <h3 className="font-semibold">{p.title}</h3>
                <p className="text-sm leading-relaxed text-text-muted">
                  {p.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 작동 3단계 */}
      <section className="flex flex-col gap-6">
        <h2 className="text-center text-2xl font-bold">이렇게 작동합니다</h2>
        <div className="flex flex-col gap-4 sm:flex-row">
          {STEPS.map((s) => (
            <div
              key={s.step}
              className="flex flex-1 flex-col items-center gap-3 rounded-base border border-surface p-6 text-center"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-lg font-bold text-bg">
                {s.step}
              </span>
              <h3 className="font-semibold">{s.title}</h3>
              <p className="text-sm leading-relaxed text-text-muted">
                {s.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 가격 티저 */}
      <section className="flex flex-col items-center gap-4 rounded-base bg-surface p-8 text-center">
        <span className="rounded-base bg-accent px-3 py-1 text-sm font-semibold text-bg">
          {PRICING.betaLabel}
        </span>
        <p className="text-lg font-bold">{PRICING.plannedLabel}</p>
        <p className="text-sm text-text-muted">{PRICING.basis}</p>
        <p className="max-w-sm text-base font-medium text-primary">
          {PRICING.betaHook}
        </p>
      </section>

      {/* 마무리 CTA */}
      <section className="flex flex-col items-center gap-5 text-center">
        <h2 className="text-2xl font-bold">
          지금 부모님께
          <br className="sm:hidden" /> 따뜻한 전화를 시작해 보세요
        </h2>
        <div className="w-full">
          <CtaSection />
        </div>
      </section>

      <footer className="border-t border-surface pt-6 text-center text-xs text-text-muted">
        본 서비스는 의료 조언을 제공하지 않으며, 안부·일정 안내를 돕는
        도구입니다.
      </footer>
    </main>
  );
}
