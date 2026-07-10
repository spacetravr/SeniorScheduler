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

const COMPARISON = {
  legacy: {
    label: "기존 돌봄 앱",
    points: [
      "부모님 폰에도 앱을 설치해야 해요",
      "데이터·와이파이가 켜져 있어야 해요",
      "작은 글씨와 복잡한 화면을 조작해야 해요",
    ],
  },
  ours: {
    label: "이 서비스",
    points: [
      "설치할 것이 없어요 — 폴더폰도 괜찮아요",
      "일반 전화망으로 걸려오는 진짜 전화예요",
      "부모님은 전화를 받기만 하시면 돼요",
    ],
  },
} as const;

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

      {/* 차별점: 진짜 전화 */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 text-center">
          <h2 className="text-2xl font-bold">
            앱이 아니라,
            <br className="sm:hidden" /> 진짜 전화입니다
          </h2>
          <p className="mx-auto max-w-md text-base leading-relaxed text-text-muted">
            기존 돌봄 서비스는 부모님 휴대폰에도 앱을 설치하고, 데이터를 켜
            두고, 작은 화면을 조작해야 했습니다. 이 서비스는 부모님이 평소
            쓰시던 전화기로 걸려온 전화를 받기만 하면 됩니다.
          </p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex flex-1 flex-col gap-3 rounded-base border border-surface p-6">
            <span className="text-sm font-semibold text-text-muted">
              {COMPARISON.legacy.label}
            </span>
            <ul className="flex flex-col gap-3">
              {COMPARISON.legacy.points.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-2 text-sm leading-relaxed text-text-muted"
                >
                  <span aria-hidden>✕</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-1 flex-col gap-3 rounded-base bg-surface p-6">
            <span className="text-sm font-semibold text-primary">
              {COMPARISON.ours.label}
            </span>
            <ul className="flex flex-col gap-3">
              {COMPARISON.ours.points.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-2 text-sm font-medium leading-relaxed text-text"
                >
                  <span className="text-primary" aria-hidden>
                    ✓
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
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

      {/* 리포트 미리보기 */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 text-center">
          <h2 className="text-2xl font-bold">
            통화가 끝나면,
            <br className="sm:hidden" /> 이런 리포트가 도착합니다
          </h2>
          <p className="mx-auto max-w-md text-base leading-relaxed text-text-muted">
            부모님과의 통화 내용을 정리해 보호자에게 알려드립니다. 아래는
            보호자가 받아 보실 리포트의 예시입니다.
          </p>
        </div>

        {/* 목업 카드 1: 정상 케이스 */}
        <div className="flex flex-col gap-4 rounded-base border border-surface p-6">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold">
              오전 9:00 · 어머님 안부 전화 완료
            </span>
            <span className="shrink-0 rounded-base bg-surface px-2 py-1 text-xs text-text-muted">
              예시 화면입니다
            </span>
          </div>
          <div className="flex items-start gap-3 rounded-base bg-surface p-4">
            <span
              className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-bg"
              aria-hidden
            >
              ✓
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold">복약</span>
              <p className="text-sm leading-relaxed text-text-muted">
                혈압약을 잘 챙겨 드셨다고 답하셨어요.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-base bg-surface p-4">
            <span className="mt-0.5 text-lg" aria-hidden>
              🙂
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold">기분</span>
              <p className="text-sm leading-relaxed text-text-muted">
                오늘 컨디션이 좋다고 하셨어요.
              </p>
            </div>
          </div>
        </div>

        {/* 목업 카드 2: 확인 필요 — 정직성 포인트 */}
        <div className="flex flex-col gap-3 rounded-base bg-surface p-6">
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-base bg-accent px-3 py-1 text-xs font-semibold text-bg">
              확인이 필요해요
            </span>
            <span className="shrink-0 text-xs text-text-muted">
              예시 화면입니다
            </span>
          </div>
          <p className="text-sm leading-relaxed text-text">
            답변이 명확하지 않을 때는 억지로 판단하지 않고 &lsquo;확인이
            필요해요&rsquo;로 알려드립니다. 보호자가 직접 확인하실 수 있도록요.
          </p>
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
