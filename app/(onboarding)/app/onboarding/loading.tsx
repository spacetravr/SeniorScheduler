/** 온보딩 설문 로딩 스켈레톤 — 헤더 + 문항 카드 골격. */
import { SkeletonCard, SkeletonHeader } from "@/components/app/Skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-lg">
      <SkeletonHeader />
      <div className="flex flex-col gap-4">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={4} />
      </div>
    </div>
  );
}
