/**
 * 로그인 (/login) — 미인증 시 middleware 가 이 경로로 redirect.
 * 이메일+비밀번호 로그인/회원가입(LoginForm). magic link 는 비밀번호 분실 시 보조.
 * ?error= 쿼리(만료/무효 링크 등)는 상단 경고 배너로 표시한다.
 * 랜딩과 동일한 디자인 토큰만 사용, 모바일 우선.
 */
import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "@/components/app/LoginForm";
import { loginErrorMessage } from "@/components/app/login-messages";

export const metadata: Metadata = {
  title: "로그인 · Senior Scheduler",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const errorMessage = loginErrorMessage(searchParams.error);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-5 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <Link href="/" className="text-lg font-bold">
          Senior Scheduler
        </Link>
        <p className="text-sm leading-relaxed text-text-muted">
          부모님을 위한 안부·복약 전화 서비스입니다.
          <br />
          이메일과 비밀번호로 로그인하세요.
        </p>
      </div>

      {errorMessage ? (
        <div
          role="alert"
          className="rounded-base border border-accent bg-surface px-4 py-3 text-center text-sm font-medium leading-relaxed text-accent"
        >
          {errorMessage}
        </div>
      ) : null}

      <div className="rounded-base border border-surface bg-bg p-6 shadow-sm">
        <LoginForm />
      </div>

      <Link
        href="/"
        className="text-center text-sm font-medium text-text-muted"
      >
        ← 서비스 소개로 돌아가기
      </Link>
    </main>
  );
}
