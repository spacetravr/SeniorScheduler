/**
 * 랜딩 페이지 (PLAN.md Phase 0-3, 0-4)
 * 히어로 → 문제 공감 → 작동 3단계 → 가격 티저 → 사전등록 CTA + 이메일 수집 모달.
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

const HERO_POINTS = [
  "보호자가 웹에서 일정을 등록하면",
  "예약한 시간에 부모님 전화로 자동 안내",
  "부모님은 걸려온 전화만 받으시면 됩니다",
];

const PERSPECTIVES = {
  guardian: {
    label: "보호자(자녀)",
    tagline: "스마트폰이 익숙한 보호자가 모든 설정을 대신합니다.",
    points: [
      "웹에서 복약·병원 일정을 등록해요",
      "통화가 끝나면 결과 리포트를 받아요",
      "부모님의 이행률을 한눈에 확인해요",
    ],
  },
  senior: {
    label: "부모님(시니어)",
    tagline: "배울 것이 하나도 없습니다.",
    points: [
      "설치할 것도, 조작할 것도 없어요",
      "평소 쓰던 전화가 울리면 받으시면 돼요",
      "편하게 대답하시면 그걸로 끝이에요",
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
        <p className="text-base font-semibold leading-relaxed text-text sm:text-lg">
          일정 등록 <span className="text-primary" aria-hidden>→</span> 예약
          시간에 자동 전화 <span className="text-primary" aria-hidden>→</span>{" "}
          결과 리포트 도착
        </p>
        <ul className="flex w-full max-w-md flex-col gap-2 text-left">
          {HERO_POINTS.map((point) => (
            <li
              key={point}
              className="flex items-start gap-2 text-sm leading-relaxed text-text-muted sm:text-base"
            >
              <span className="mt-0.5 text-primary" aria-hidden>
                ✓
              </span>
              <span>{point}</span>
            </li>
          ))}
        </ul>
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

      {/* 차별점: 두 사람 모두 편한 이유 (보호자 vs 시니어 관점) */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-3 text-center">
          <h2 className="text-2xl font-bold">
            앱이 아니라,
            <br className="sm:hidden" /> 진짜 전화입니다
          </h2>
          <p className="mx-auto max-w-md text-base leading-relaxed text-text-muted">
            보호자와 부모님, 두 분의 경험은 이렇게 다릅니다. 어려운 조작은
            익숙한 보호자가 맡고, 부모님은 전화만 받으시면 됩니다.
          </p>
        </div>
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex flex-1 flex-col gap-3 rounded-base border border-surface p-6">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-primary">
                {PERSPECTIVES.guardian.label}
              </span>
              <p className="text-sm font-medium leading-relaxed text-text">
                {PERSPECTIVES.guardian.tagline}
              </p>
            </div>
            <ul className="flex flex-col gap-3">
              {PERSPECTIVES.guardian.points.map((point) => (
                <li
                  key={point}
                  className="flex items-start gap-2 text-sm leading-relaxed text-text-muted"
                >
                  <span className="text-primary" aria-hidden>
                    ✓
                  </span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-1 flex-col gap-3 rounded-base bg-surface p-6">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold text-primary">
                {PERSPECTIVES.senior.label}
              </span>
              <p className="text-sm font-medium leading-relaxed text-text">
                {PERSPECTIVES.senior.tagline}
              </p>
            </div>
            <ul className="flex flex-col gap-3">
              {PERSPECTIVES.senior.points.map((point) => (
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
            부모님과의 통화 내용을 요약해 보호자에게 알려드리고, 필요하면
            대화 내용까지 그대로 확인하실 수 있습니다. 아래는 보호자가 받아
            보실 리포트의 예시입니다.
          </p>
        </div>

        {/* 목업 카드 1: 실제 앱 리포트 화면 느낌 */}
        <div className="overflow-hidden rounded-base border border-surface">
          {/* 상단 헤더 */}
          <div className="flex items-center justify-between gap-2 border-b border-surface p-5">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-text-muted">
                7월 10일 (목) · 오전 9:00
              </span>
              <span className="font-semibold">어머님 안부 전화 완료</span>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-base bg-primary px-2.5 py-1 text-xs font-semibold leading-none text-bg">
              복약 완료
            </span>
          </div>

          {/* 항목 행 */}
          <div className="flex flex-col gap-3 p-5">
            <div className="flex items-center gap-3 rounded-base bg-surface p-4">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-bg"
                aria-hidden
              >
                ✓
              </span>
              <div className="flex flex-1 items-center justify-between gap-2">
                <span className="text-sm font-semibold">복약</span>
                <span className="text-sm text-text-muted">
                  혈압약 챙겨 드심
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-base bg-surface p-4">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center text-lg" aria-hidden>
                🙂
              </span>
              <div className="flex flex-1 items-center justify-between gap-2">
                <span className="text-sm font-semibold">기분</span>
                <span className="text-sm text-text-muted">
                  컨디션 좋음
                </span>
              </div>
            </div>

            {/* 통화 요약 블록 */}
            <div className="flex flex-col gap-2 rounded-base border border-surface p-4">
              <span className="text-xs font-semibold text-primary">
                통화 요약
              </span>
              <p className="text-sm leading-relaxed text-text">
                오전 9시에 통화했어요. 혈압약을 방금 챙겨 드셨다고 하셨고,
                오늘은 경로당에 다녀오실 예정이라고 하셨어요.
              </p>
            </div>
          </div>

          {/* 하단 예시 라벨 */}
          <div className="border-t border-surface px-5 py-3">
            <span className="text-xs text-text-muted">예시 화면입니다</span>
          </div>
        </div>

        {/* 목업 카드 2: 대화 내용 직접 확인 포인트 */}
        <div className="flex flex-col gap-4 rounded-base bg-surface p-6">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-snug">
              부모님과 나눈 대화,
              <br className="sm:hidden" /> 그대로 확인할 수 있어요
            </h3>
            <span className="shrink-0 text-xs text-text-muted">
              예시 화면입니다
            </span>
          </div>
          <p className="text-sm leading-relaxed text-text-muted">
            요약만으로 부족할 때는 리포트에서 통화 대화 내용을 그대로 읽어 볼
            수 있어요. 어떤 이야기가 오갔는지 보호자가 직접 확인하실 수
            있도록요.
          </p>

          {/* 대화 전사 스니펫 */}
          <div className="flex flex-col gap-3 rounded-base bg-bg p-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-text-muted">
                안내
              </span>
              <p className="w-fit rounded-base bg-surface px-3 py-2 text-sm leading-relaxed text-text">
                어머님, 오늘 아침 혈압약은 드셨어요?
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs font-semibold text-text-muted">
                어머님
              </span>
              <p className="w-fit rounded-base bg-primary px-3 py-2 text-sm leading-relaxed text-bg">
                응, 방금 물이랑 같이 먹었어.
              </p>
            </div>
          </div>
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
