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

type NavItem = { href: string; label: string; icon: LucideIcon };

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

export function DesktopSidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r border-border p-4 md:flex">
      <Link href="/app" className="mb-4 px-2 text-lg font-bold">
        Senior Scheduler
      </Link>
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
            <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden strokeWidth={2} />
            {item.label}
          </Link>
        );
      })}
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
