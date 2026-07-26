/** 결제/크레딧 로딩 스켈레톤 — 헤더 + 잔액 카드 + 내역 카드 골격. */
import { SkeletonCard, SkeletonHeader } from "@/components/app/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader />
      <div className="flex flex-col gap-4">
        <SkeletonCard lines={1} />
        <SkeletonCard lines={3} />
      </div>
    </div>
  );
}
