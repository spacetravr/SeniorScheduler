/**
 * 로그인 (/login) — 미인증 시 middleware 가 이 경로로 redirect.
 * 이메일 magic link 발송(LoginForm). 랜딩과 동일한 디자인 토큰만 사용, 모바일 우선.
 */
import Link from "next/link";
import type { Metadata } from "next";
import { LoginForm } from "@/components/app/LoginForm";

export const metadata: Metadata = {
  title: "로그인 · 안심 전화",
};

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-8 px-5 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <Link href="/" className="text-lg font-bold">
          안심 전화
        </Link>
        <p className="text-sm leading-relaxed text-text-muted">
          부모님을 위한 안부·복약 전화 서비스입니다.
          <br />
          이메일로 로그인 링크를 보내드려요.
        </p>
      </div>

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
