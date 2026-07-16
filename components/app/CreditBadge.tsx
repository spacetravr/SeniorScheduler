/**
 * 크레딧 배지 — 잔여 크레딧 표시 + /app/billing 진입.
 * 데스크톱 사이드바 하단(기본형)과 모바일 헤더 우측(compact)에서 재사용.
 * 색·라운드는 토큰만 사용 (하드코딩 금지).
 */
import Link from "next/link";
import { Coins } from "lucide-react";

// TODO: credits 테이블 연동 전 mock (Phase 2에서 실데이터로 교체)
export const MOCK_CREDITS = 120;

/** 사이드바 하단용 — 아이콘 + "120 크레딧" + 라벨. */
export function CreditBadge({ credits = MOCK_CREDITS }: { credits?: number }) {
  return (
    <Link
      href="/app/billing"
      className="flex items-center gap-3 rounded-base border border-border bg-bg px-3 py-2.5 text-sm font-medium text-text-muted shadow-card transition-colors hover:border-primary"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
        aria-hidden
      >
        <Coins className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="flex min-w-0 flex-col leading-tight">
        <span className="break-keep text-xs text-text-muted">잔여 크레딧</span>
        <span className="font-semibold text-text tabular-nums">
          {credits.toLocaleString("ko-KR")} 크레딧
        </span>
      </span>
    </Link>
  );
}

/** 모바일 헤더 우측용 컴팩트 배지 — 아이콘 + 숫자만. */
export function CreditBadgeCompact({ credits = MOCK_CREDITS }: { credits?: number }) {
  return (
    <Link
      href="/app/billing"
      aria-label={`잔여 크레딧 ${credits}`}
      className="flex items-center gap-1.5 rounded-base border border-border bg-bg px-2.5 py-1.5 text-sm font-semibold text-primary shadow-card transition-colors hover:border-primary"
    >
      <Coins className="h-4 w-4 shrink-0" aria-hidden strokeWidth={2} />
      <span className="tabular-nums">{credits.toLocaleString("ko-KR")}</span>
    </Link>
  );
}
