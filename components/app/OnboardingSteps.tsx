/**
 * 온보딩 스텝 — 피보호자 0명일 때 대시보드 본문에 표시하는 서비스 흐름 안내.
 * 세로 타임라인 형태(번호·아이콘)로 4스텝을 보여주고, 현재 단계(스텝 1)를 강조한다.
 * 색·라운드는 토큰만 사용 (하드코딩 금지). 신규 가입자를 피보호자 등록으로 유도.
 */
import Link from "next/link";
import { UserPlus, PhoneCall, CalendarPlus, ClipboardCheck, type LucideIcon } from "lucide-react";

type Step = {
  icon: LucideIcon;
  title: string;
  desc: string;
};

const STEPS: Step[] = [
  {
    icon: UserPlus,
    title: "피보호자(부모님) 등록",
    desc: "부모님의 성함과 전화번호를 등록해 주세요.",
  },
  {
    icon: PhoneCall,
    title: "첫 통화에서 부모님 동의 확인",
    desc: "첫 통화(동의 콜)에서 부모님께 직접 동의를 여쭙습니다.",
  },
  {
    icon: CalendarPlus,
    title: "복약·병원 일정 등록",
    desc: "챙겨드릴 복약·병원 일정과 발신 시간을 등록해 주세요.",
  },
  {
    icon: ClipboardCheck,
    title: "자동 전화 + 결과 리포트 확인",
    desc: "예약한 시간에 자동으로 전화하고, 결과 리포트를 알려드려요.",
  },
];

export function OnboardingSteps() {
  return (
    <section
      aria-label="시작 안내"
      className="flex flex-col gap-6 rounded-base border border-border bg-bg p-6 shadow-card"
    >
      <div className="flex flex-col gap-1">
        <h2 className="break-keep text-lg font-bold text-primary">
          Senior Scheduler를 시작해 볼까요?
        </h2>
        <p className="break-keep text-sm leading-relaxed text-text-muted">
          아래 4단계면 부모님께 자동으로 안내 전화를 걸어드릴 수 있어요.
        </p>
      </div>

      <ol className="flex flex-col">
        {STEPS.map((step, i) => {
          const isCurrent = i === 0;
          const isLast = i === STEPS.length - 1;
          const Icon = step.icon;
          return (
            <li key={i} className="flex gap-4">
              {/* 타임라인 열: 아이콘 배지 + 연결선 */}
              <div className="flex flex-col items-center">
                <span
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                    isCurrent
                      ? "bg-primary text-bg"
                      : "bg-primary-soft text-primary"
                  }`}
                  aria-hidden
                >
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </span>
                {!isLast ? (
                  <span className="my-1 w-px flex-1 bg-border" aria-hidden />
                ) : null}
              </div>

              {/* 내용 */}
              <div className={`flex flex-col gap-0.5 ${isLast ? "pb-0" : "pb-6"}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-text-muted tabular-nums">
                    STEP {i + 1}
                  </span>
                  {isCurrent ? (
                    <span className="inline-flex items-center rounded-base bg-primary px-2 py-0.5 text-xs font-semibold leading-none text-bg">
                      지금 시작
                    </span>
                  ) : null}
                </div>
                <p
                  className={`break-keep font-semibold ${
                    isCurrent ? "text-primary" : "text-text"
                  }`}
                >
                  {step.title}
                </p>
                <p className="break-keep text-sm leading-relaxed text-text-muted">
                  {step.desc}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <Link
        href="/app/seniors"
        className="flex items-center justify-center gap-2 rounded-base bg-primary px-4 py-3.5 text-sm font-semibold text-bg transition-colors hover:opacity-90"
      >
        <UserPlus className="h-5 w-5 shrink-0" aria-hidden strokeWidth={2} />
        피보호자 등록하기
      </Link>
    </section>
  );
}
