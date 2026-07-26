/** 리포트 로딩 스켈레톤 — 헤더 + 기간 탭 + 일별 요약 카드 골격. */
import { Skeleton, SkeletonCard, SkeletonHeader } from "@/components/app/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader />
      <Skeleton className="mb-5 h-12 w-full" />
      <div className="flex flex-col gap-3">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={2} />
      </div>
    </div>
  );
}
