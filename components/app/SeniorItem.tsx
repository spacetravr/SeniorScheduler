"use client";

/**
 * 피보호자 카드 — 정보 표시 + 동의 토글(setSeniorConsent) + 수정(SeniorForm) + 삭제(deleteSenior).
 * 동의 철회 시 활성 일정이 자동 OFF 됨을 confirm 으로 안내한다.
 */
import { useState, useTransition } from "react";
import type { Senior } from "@/lib/contracts/domain";
import { setSeniorConsent, deleteSenior } from "@/lib/actions/seniors";
import { fmtDate } from "@/components/app/format";
import { SeniorForm } from "@/components/app/SeniorForm";

export function SeniorItem({ senior }: { senior: Senior }) {
  const consented = Boolean(senior.consent_at);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleConsent() {
    setError(null);
    if (consented) {
      const ok = window.confirm(
        "동의를 철회하면 이 피보호자의 활성화된 일정이 모두 자동으로 꺼집니다. 계속할까요?",
      );
      if (!ok) return;
    }
    startTransition(async () => {
      const result = await setSeniorConsent(senior.id, !consented);
      if (!result.ok) setError(result.error);
    });
  }

  function handleDelete() {
    setError(null);
    const ok = window.confirm(
      `'${senior.name}' 피보호자와 연결된 일정이 함께 삭제됩니다. 삭제할까요?`,
    );
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteSenior(senior.id);
      if (!result.ok) setError(result.error);
    });
  }

  if (editing) {
    return <SeniorForm mode="edit" senior={senior} onDone={() => setEditing(false)} />;
  }

  return (
    <div className="flex flex-col gap-3 rounded-base border border-surface p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{senior.name}</span>
            <span className="text-sm text-text-muted">
              {senior.relationship}
              {senior.birth_year ? ` · ${senior.birth_year}년생` : ""}
            </span>
          </div>
          <span className="text-sm text-text-muted tabular-nums">
            {senior.phone}
          </span>
        </div>
        {consented ? (
          <span className="inline-flex shrink-0 items-center rounded-base bg-primary px-2.5 py-1 text-xs font-semibold text-bg">
            동의 완료 · {fmtDate(senior.consent_at!)}
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center rounded-base border border-accent px-2.5 py-1 text-xs font-semibold text-accent">
            동의 대기
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleConsent}
          disabled={pending}
          className="rounded-base border border-surface px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          {consented ? "동의 철회" : "동의 처리"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={pending}
          className="rounded-base border border-surface px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
        >
          수정
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending}
          className="rounded-base border border-surface px-3 py-1.5 text-xs font-semibold text-accent disabled:opacity-50"
        >
          삭제
        </button>
      </div>

      {error ? (
        <p className="rounded-base bg-surface px-3 py-2 text-xs font-medium text-accent">
          {error}
        </p>
      ) : null}
    </div>
  );
}
