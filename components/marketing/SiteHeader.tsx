import Link from "next/link";
import type { ReactNode } from "react";

/** 데스크톱 헤더 텍스트 내비게이션 (모바일은 푸터로 대체 — 햄버거 없음). */
const NAV_LINKS = [
  { href: "/about", label: "서비스 소개" },
  { href: "/faq", label: "자주 묻는 질문" },
];

/**
 * 마케팅 사이트 공용 헤더.
 * 브랜드 워드마크 + 데스크톱 텍스트 링크(서비스 소개·FAQ) + 로그인 + CTA 슬롯.
 * CTA는 페이지가 주입한다 — 랜딩은 추적되는 PreregisterButton, 서브 페이지는 PreregisterLink.
 */
export function SiteHeader({ cta }: { cta: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
        <Link
          href="/"
          className="font-brand text-lg font-bold tracking-tight sm:text-xl"
        >
          Senior Scheduler
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="주요 메뉴">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-text-muted transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-text-muted transition-colors hover:text-primary"
          >
            로그인
          </Link>
          {cta}
        </div>
      </div>
    </header>
  );
}
