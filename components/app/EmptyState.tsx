/**
 * 빈 상태 UI — 데이터 0건일 때 온보딩 안내. 색·라운드는 토큰만 사용.
 */
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-base border border-dashed border-border bg-surface/50 px-6 py-10 text-center shadow-card">
      {Icon ? (
        <span
          className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft text-primary"
          aria-hidden
        >
          <Icon className="h-7 w-7" strokeWidth={1.75} />
        </span>
      ) : null}
      <div className="flex flex-col gap-1">
        <p className="font-semibold">{title}</p>
        {description ? (
          <p className="text-sm leading-relaxed text-text-muted">{description}</p>
        ) : null}
      </div>
      {action ? (
        <Link
          href={action.href}
          className="mt-1 rounded-base bg-primary px-4 py-2.5 text-sm font-semibold text-bg"
        >
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
