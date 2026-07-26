/**
 * 스켈레톤 프리미티브 — 로딩 중 레이아웃 골격 표시(체감 속도 개선).
 * 색·라운드는 토큰만 사용(bg-surface, rounded-base). pulse 애니메이션.
 * loading.tsx에서 각 화면 골격을 조립하는 데 쓰인다.
 */

/** 단일 스켈레톤 블록. className으로 크기(높이·너비)를 지정한다. */
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-base bg-surface ${className}`}
    />
  );
}

/** 카드 형태 스켈레톤 — 헤더 줄 + 본문 줄 2~3개. */
export function SkeletonCard({ lines = 2 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-3 rounded-base border border-border bg-bg p-5 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="flex flex-col gap-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </div>
  );
}

/** 화면 상단 헤더 스켈레톤 (PageHeader 골격). */
export function SkeletonHeader({ withAction = false }: { withAction?: boolean }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
      {withAction ? <Skeleton className="h-10 w-24 shrink-0" /> : null}
    </div>
  );
}
