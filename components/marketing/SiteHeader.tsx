import Link from "next/link";
import type { ReactNode } from "react";

/**
 * 주요 메뉴 — 홈 / 서비스 / 자주 묻는 질문 / 소개.
 * `/service`가 제품 설명의 본진이고 `/`는 회사·서비스의 얼굴(docs/site-structure.md §1).
 */
const NAV_LINKS = [
  { href: "/", label: "홈" },
  { href: "/service", label: "서비스" },
  { href: "/faq", label: "자주 묻는 질문" },
  { href: "/about", label: "소개" },
];

/**
 * 마케팅 사이트 공용 헤더.
 * 데스크톱: 브랜드 + 가로 내비 + 로그인 + CTA 한 줄.
 * 모바일: 위 줄(브랜드·로그인·CTA) + 아래 줄(가로 스크롤 내비) 2단 — 햄버거 JS 없이 서버 렌더 유지.
 * CTA는 페이지가 주입한다 — `/`·`/service`는 추적되는 PreregisterButton, 그 외는 PreregisterLink.
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

        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/login"
            className="text-sm font-medium text-text-muted transition-colors hover:text-primary"
          >
            로그인
          </Link>
          {cta}
        </div>
      </div>

      {/* 모바일 내비 — 가로 스크롤 한 줄 */}
      <nav
        className="border-t border-border md:hidden"
        aria-label="주요 메뉴 (모바일)"
      >
        <ul className="mx-auto flex w-full max-w-6xl items-center gap-5 overflow-x-auto px-5 py-2.5">
          {NAV_LINKS.map((link) => (
            <li key={link.href} className="shrink-0">
              <Link
                href={link.href}
                className="text-sm font-medium text-text-muted transition-colors hover:text-primary"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
