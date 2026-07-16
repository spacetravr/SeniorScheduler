"use client";

/**
 * "피보호자 등록" 트리거 버튼 + 모달. ScheduleFormModal 패턴을 따라 오버레이 안에서
 * SeniorForm(mode=create)을 띄운다. 완료 시(onDone) 닫힘. 색·라운드는 토큰만 사용.
 *
 * variant:
 *  - "primary": 채움 버튼(페이지 상단 우측 등 단독 CTA)
 *  - "outline": 외곽선 버튼(대시보드 빠른 액션 2열 배치)
 */
import { useState } from "react";
import { UserPlus, X } from "lucide-react";
import { SeniorForm } from "@/components/app/SeniorForm";

export function SeniorFormModal({
  variant = "primary",
  className = "",
}: {
  variant?: "primary" | "outline";
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  const triggerClass =
    variant === "outline"
      ? "flex items-center justify-center gap-2 rounded-base border border-border bg-bg px-4 py-3.5 text-sm font-semibold text-primary shadow-card transition-colors hover:bg-primary-soft"
      : "inline-flex items-center gap-1.5 rounded-base bg-primary px-4 py-2.5 text-sm font-semibold text-bg";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${triggerClass} ${className}`}
      >
        <UserPlus
          className={variant === "outline" ? "h-5 w-5 shrink-0" : "h-4 w-4"}
          aria-hidden
          strokeWidth={variant === "outline" ? 2 : 2.5}
        />
        피보호자 등록
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-text/40 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="피보호자 등록"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-base bg-bg sm:rounded-base"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4">
              <h2 className="text-base font-semibold">피보호자 등록</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="닫기"
                className="rounded-base p-1.5 text-text-muted transition-colors hover:bg-surface"
              >
                <X className="h-5 w-5" aria-hidden strokeWidth={2} />
              </button>
            </div>
            <div className="p-4">
              <SeniorForm mode="create" onDone={() => setOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
