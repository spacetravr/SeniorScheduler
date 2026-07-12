/**
 * 사전등록 (`/preregister`) — 좌/우 분할(데스크톱 50:50, 모바일 위아래 스택).
 * 왼쪽: Senior Scheduler 브랜드 패널(설명 + 혜택 체크). 오른쪽: 이메일 등록 카드(PreregisterForm).
 * 이 페이지는 VIEW 이벤트를 보내지 않는다(폼 내부 useCtaTracking trackView:false).
 * 직접 진입해도 정상 동작하며, session_uuid/utm은 기존 훅 로직을 재사용한다.
 */
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { PreregisterForm } from "@/components/marketing/PreregisterForm";

export const metadata: Metadata = {
  title: "사전등록 · Senior Scheduler",
  description:
    "이메일로 사전등록하시면 Senior Scheduler 정식 출시 소식을 가장 먼저 안내드립니다.",
};

const BENEFITS = [
  "사전등록하시면 정식 출시 시 첫 달 무료 혜택",
  "등록만으로는 어떤 결제도 발생하지 않습니다",
  "정식 출시되면 이메일로 가장 먼저 안내드립니다",
];

export default function PreregisterPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* 왼쪽: 브랜드 패널 */}
      <section className="flex flex-col items-center justify-between gap-10 bg-gradient-to-br from-surface via-surface to-accent/10 px-6 py-12 text-center sm:px-10 lg:px-14 lg:py-16">
        <Link
          href="/"
          className="text-2xl font-bold tracking-tight sm:text-3xl"
        >
          Senior Scheduler
        </Link>

        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-4">
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              부모님의 하루,
              <br />
              전화 한 통으로 챙기세요
            </h1>
            <p className="max-w-md text-xl leading-relaxed text-text-muted">
              복약·병원 일정을 등록해 두면 예약한 시간에 부모님께 자동으로
              안부 전화를 걸어 확인해 드립니다. 지금 사전등록하고 출시 소식을
              가장 먼저 받아보세요.
            </p>
          </div>

          <ul className="mx-auto flex w-fit flex-col gap-3 text-left">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-base font-bold text-bg"
                  aria-hidden
                >
                  ✓
                </span>
                <span className="text-lg font-medium leading-relaxed">
                  {b}
                </span>
              </li>
            ))}
          </ul>

          <div className="relative hidden aspect-[16/10] w-full max-w-md overflow-hidden rounded-base shadow-sm lg:block">
            <Image
              src="/images/senior-man-phone.jpg"
              alt="소파에 앉아 편안하게 스마트폰을 보고 계신 아버님"
              fill
              sizes="50vw"
              className="object-cover"
            />
          </div>
        </div>

        <p className="text-base text-text-muted">
          정식 출시를 준비 중인 베타 서비스입니다.
        </p>
      </section>

      {/* 오른쪽: 이메일 등록 카드 */}
      <section className="flex items-center justify-center bg-bg px-6 py-12 sm:px-10 lg:px-14">
        <div className="w-full max-w-md">
          <PreregisterForm />
          <p className="mt-6 text-center text-base">
            <Link href="/" className="font-medium text-text-muted">
              ← 서비스 소개로 돌아가기
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
