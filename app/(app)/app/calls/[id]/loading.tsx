/** 통화 상세 로딩 스켈레톤 — 헤더 + 요약 카드 + 대화 turn 골격. */
import { Skeleton, SkeletonCard, SkeletonHeader } from "@/components/app/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader />
      <div className="flex flex-col gap-4">
        <SkeletonCard lines={3} />
        <div className="flex flex-col gap-3 rounded-base border border-border bg-bg p-5 shadow-card">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-12 w-3/4 self-start" />
          <Skeleton className="h-12 w-3/4 self-end" />
          <Skeleton className="h-12 w-2/3 self-start" />
        </div>
      </div>
    </div>
  );
}
