/** 피보호자 목록 로딩 스켈레톤 — 헤더 + 피보호자 카드 골격. */
import { SkeletonCard, SkeletonHeader } from "@/components/app/Skeleton";

export default function Loading() {
  return (
    <div>
      <SkeletonHeader withAction />
      <div className="flex flex-col gap-3">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={2} />
      </div>
    </div>
  );
}
