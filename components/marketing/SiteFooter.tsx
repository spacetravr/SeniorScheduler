import Link from "next/link";

/** 푸터 내비게이션 링크. */
const FOOTER_LINKS = [
  { href: "/about", label: "서비스 소개" },
  { href: "/faq", label: "자주 묻는 질문" },
  { href: "/terms", label: "이용약관" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/login", label: "로그인" },
];

/**
 * 마케팅 사이트 공용 푸터.
 * 브랜드 + 주요 페이지 링크 + 의료 미제공 고지(고정 문구).
 */
export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-5 px-5 py-10 text-center text-sm text-text-muted sm:px-8">
        <span className="text-base font-bold text-text">Senior Scheduler</span>

        <nav
          className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2"
          aria-label="푸터 메뉴"
        >
          {FOOTER_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="font-medium transition-colors hover:text-primary"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-1.5">
          <p>정식 출시를 준비 중인 베타 서비스입니다.</p>
          <p className="text-xs">
            본 서비스는 의료 조언을 제공하지 않으며, 안부·일정 안내를 돕는
            도구입니다.
          </p>
        </div>
      </div>
    </footer>
  );
}
