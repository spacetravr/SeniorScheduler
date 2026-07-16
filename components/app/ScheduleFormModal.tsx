"use client";

/**
 * "새 일정 등록" 트리거 버튼 + 모달. 페이지 상단(PageHeader action 슬롯)에 버튼만 두고,
 * 클릭 시 오버레이 안에서 ScheduleForm(mode=create)을 띄운다. 상시 노출 대신 필요할 때만.
 * 색·라운드는 토큰만 사용.
 */
import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { Senior } from "@/lib/contracts/domain";
import { ScheduleForm } from "@/components/app/ScheduleForm";

export function ScheduleFormModal({ seniors }: { seniors: Senior[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-base bg-primary px-4 py-2.5 text-sm font-semibold text-bg"
      >
        <Plus className="h-4 w-4" aria-hidden strokeWidth={2.5} />새 일정 등록
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-text/40 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="새 일정 등록"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-base bg-bg sm:rounded-base"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pt-4">
              <h2 className="text-base font-semibold">새 일정 등록</h2>
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
              <ScheduleForm
                mode="create"
                seniors={seniors}
                onDone={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
