"use client";

/**
 * 온보딩 설문 (2스텝 · 5문항) — 앱 첫 진입 게이트.
 *
 * 선택지·라벨은 **전부 lib/contracts/onboarding.ts 상수**에서 온다(화면에서 하드코딩 금지 —
 * 계약이 바뀌면 화면이 따라온다). 전 문항 선택 입력이며 [건너뛰기]가 항상 보인다:
 * 설문은 이탈 지점이 되어선 안 된다.
 * 큰 터치 타깃(카드형 단일 선택) · 모바일 우선 · 색은 토큰 클래스만 사용.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft } from "lucide-react";
import {
  CALL_SLOTS,
  GUARDIAN_AGE_BANDS,
  PARENT_AGE_BANDS,
  PRIMARY_CONCERNS,
  RESIDENCE_DISTANCES,
  callSlotLabel,
  guardianAgeBandLabel,
  parentAgeBandLabel,
  primaryConcernLabel,
  residenceDistanceLabel,
  type OnboardingProfile,
} from "@/lib/contracts/onboarding";
import { saveOnboarding, skipOnboarding } from "@/lib/actions/onboarding";

type Field = keyof OnboardingProfile;

type Question = {
  field: Field;
  title: string;
  options: { value: string; label: string }[];
};

/** 계약 상수 → 선택지 배열 (라벨 소스는 언제나 계약). */
function toOptions<T extends string>(
  values: readonly T[],
  labels: Record<T, string>,
): { value: string; label: string }[] {
  return values.map((v) => ({ value: v, label: labels[v] }));
}

const STEPS: { heading: string; caption: string; questions: Question[] }[] = [
  {
    heading: "보호자님에 대해 알려주세요",
    caption: "부모님께 더 알맞은 안내 전화를 준비하기 위한 짧은 질문이에요.",
    questions: [
      {
        field: "guardian_age_band",
        title: "보호자님의 연령대는 어떻게 되시나요?",
        options: toOptions(GUARDIAN_AGE_BANDS, guardianAgeBandLabel),
      },
      {
        field: "residence_distance",
        title: "부모님과 얼마나 떨어져 지내시나요?",
        options: toOptions(RESIDENCE_DISTANCES, residenceDistanceLabel),
      },
    ],
  },
  {
    heading: "부모님에 대해 알려주세요",
    caption: "통화 시간대와 안내 문구를 정하는 데 참고합니다.",
    questions: [
      {
        field: "parent_age_band",
        title: "부모님의 연세는 어떻게 되시나요?",
        options: toOptions(PARENT_AGE_BANDS, parentAgeBandLabel),
      },
      {
        field: "primary_concern",
        title: "가장 걱정되시는 부분은 무엇인가요?",
        options: toOptions(PRIMARY_CONCERNS, primaryConcernLabel),
      },
      {
        field: "preferred_call_slot",
        title: "전화는 주로 언제가 좋으실까요?",
        options: toOptions(CALL_SLOTS, callSlotLabel),
      },
    ],
  },
];

export function OnboardingWizard({
  initial,
  isEdit = false,
}: {
  initial: OnboardingProfile;
  /** 설정에서 다시 들어온 경우 — 문구와 버튼 라벨만 달라진다 */
  isEdit?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<OnboardingProfile>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function select(field: Field, value: string) {
    setProfile(
      (prev) =>
        ({
          ...prev,
          // 같은 항목을 다시 누르면 선택 해제 (전 문항 선택 사항)
          [field]: prev[field] === value ? null : value,
        }) as OnboardingProfile,
    );
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await saveOnboarding(profile);
      if (res.ok) {
        router.push("/app");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  function skip() {
    setError(null);
    startTransition(async () => {
      const res = await skipOnboarding();
      if (res.ok) {
        router.push("/app");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* 진행 표시 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-text-muted tabular-nums">
            {step + 1} / {STEPS.length}
          </span>
          <button
            type="button"
            onClick={skip}
            disabled={pending}
            className="text-sm font-medium text-text-muted underline underline-offset-2 disabled:opacity-50"
          >
            {isEdit ? "그만두기" : "건너뛰기"}
          </button>
        </div>
        <div className="flex gap-1.5" aria-hidden>
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 flex-1 rounded-base ${
                i <= step ? "bg-primary" : "bg-surface"
              }`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <h2 className="break-keep text-xl font-bold">{current.heading}</h2>
        <p className="break-keep text-sm leading-relaxed text-text-muted">
          {current.caption}
        </p>
      </div>

      {/* 문항 */}
      <div className="flex flex-col gap-7">
        {current.questions.map((q) => (
          <fieldset key={q.field} className="flex flex-col gap-3">
            <legend className="break-keep pb-3 text-base font-semibold">
              {q.title}
            </legend>
            <div role="radiogroup" aria-label={q.title} className="flex flex-col gap-2">
              {q.options.map((opt) => {
                const on = profile[q.field] === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => select(q.field, opt.value)}
                    className={`flex min-h-[3.25rem] w-full items-center justify-between gap-3 rounded-base border px-4 py-3.5 text-left text-base font-medium transition-colors ${
                      on
                        ? "border-primary bg-primary-soft text-primary"
                        : "border-border bg-bg text-text hover:bg-surface/60"
                    }`}
                  >
                    <span className="break-keep">{opt.label}</span>
                    {on ? (
                      <Check className="h-5 w-5 shrink-0" aria-hidden strokeWidth={2.5} />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      {error ? (
        <p
          role="alert"
          className="break-keep rounded-base bg-accent/10 px-3 py-2 text-sm leading-relaxed text-accent"
        >
          {error} 잠시 후 다시 시도해 주세요.
        </p>
      ) : null}

      {/* 이동 버튼 */}
      <div className="flex gap-2">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            disabled={pending}
            className="inline-flex items-center justify-center gap-1 rounded-base border border-border bg-bg px-4 py-3.5 text-sm font-semibold text-primary transition-colors hover:bg-primary-soft disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden strokeWidth={2} />
            이전
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => (isLast ? submit() : setStep((s) => s + 1))}
          disabled={pending}
          className="flex-1 rounded-base bg-primary px-4 py-3.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isLast ? (pending ? "저장 중…" : isEdit ? "저장하기" : "시작하기") : "다음"}
        </button>
      </div>

      <p className="break-keep text-xs leading-relaxed text-text-muted">
        답변은 서비스 개선과 안내 전화 준비에만 사용되며, 설정에서 언제든 다시 수정하실 수
        있어요. 질병명 등 민감한 정보는 수집하지 않습니다.
      </p>
    </div>
  );
}
