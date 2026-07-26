"use client";

/**
 * 보호자 웹 내비게이션 — 모바일: 하단 탭바 / 데스크톱: 좌측 사이드바.
 * 활성 경로 강조는 usePathname으로 처리. 색은 토큰만 사용.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  CalendarDays,
  Phone,
  ClipboardList,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { CreditBadge, CreditBadgeCompact } from "@/components/app/CreditBadge";

type NavItem = { href: string; label: string; icon: LucideIcon };

// 5탭. 피보호자 관리는 대시보드 카드의 "관리" 링크로 진입(/app/seniors 페이지 유지).
const NAV: NavItem[] = [
  { href: "/app", label: "대시보드", icon: Home },
  { href: "/app/schedules", label: "일정", icon: CalendarDays },
  { href: "/app/calls", label: "통화", icon: Phone },
  { href: "/app/reports", label: "리포트", icon: ClipboardList },
  { href: "/app/settings", label: "설정", icon: Settings },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(href + "/");
}

/** 브랜드 워드마크 — 전용 브랜드 폰트(font-brand, 각진 타이포)로 통일. */
export function BrandWordmark({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/app"
      className={`font-brand font-bold tracking-tight text-primary ${className}`}
    >
      Senior Scheduler
    </Link>
  );
}

/**
 * 모바일 상단 브랜드 헤더 (데스크톱은 사이드바가 브랜드 표기 담당).
 * credits 는 서버 레이아웃에서 getMyCredits()로 조회해 내려준다(없으면 null).
 */
export function MobileHeader({ credits }: { credits: number | null }) {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-bg/85 px-5 py-3 backdrop-blur md:hidden">
      <BrandWordmark className="text-lg" />
      <CreditBadgeCompact credits={credits} />
    </header>
  );
}

export function DesktopSidebar({ credits }: { credits: number | null }) {
  const pathname = usePathname();
  return (
    <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r border-border p-4 md:flex">
      <BrandWordmark className="mb-4 px-2 text-lg" />
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-base px-3 py-2.5 text-sm font-medium transition-colors ${
              active ? "bg-primary text-bg" : "text-text-muted hover:bg-surface"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden strokeWidth={2} />
            {item.label}
          </Link>
        );
      })}
      {/* 사이드바 하단: 잔여 크레딧 → 결제 페이지 진입 */}
      <div className="mt-auto pt-4">
        <CreditBadge credits={credits} />
      </div>
    </aside>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-border bg-bg md:hidden">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center gap-1 py-2 text-xs font-medium transition-colors ${
              active ? "text-primary" : "text-text-muted"
            }`}
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden strokeWidth={2} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
