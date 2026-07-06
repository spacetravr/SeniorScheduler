"use client";

/**
 * 피보호자 등록 폼 (mock) — 동의 체크박스 미체크 시 등록 버튼 비활성 (가드레일 5 UI).
 * 제출 시 콘솔 로그 + 성공 메시지만 (실저장 없음, Phase 2에서 결합).
 */
import { useState } from "react";

const RELATIONSHIPS = ["모", "부", "조모", "조부", "기타"] as const;

export function SeniorForm() {
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    // Phase 2에서 서버 액션으로 교체
    console.log("[mock] 피보호자 등록", { ...data, consent });
    setDone(true);
    form.reset();
    setConsent(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-base border border-surface p-5"
    >
      <h2 className="text-base font-semibold">새 피보호자 등록</h2>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">이름</span>
        <input
          name="name"
          required
          maxLength={50}
          placeholder="예: 김순자"
          className="rounded-base border border-surface bg-bg px-3 py-2.5 outline-none focus:border-primary"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">전화번호</span>
        <input
          name="phone"
          required
          inputMode="tel"
          placeholder="예: 010-1234-5678"
          className="rounded-base border border-surface bg-bg px-3 py-2.5 outline-none focus:border-primary"
        />
      </label>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1.5 text-sm">
          <span className="font-medium">관계</span>
          <select
            name="relationship"
            required
            defaultValue="모"
            className="rounded-base border border-surface bg-bg px-3 py-2.5 outline-none focus:border-primary"
          >
            {RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1.5 text-sm">
          <span className="font-medium">출생연도</span>
          <input
            name="birth_year"
            type="number"
            min={1920}
            max={2000}
            placeholder="예: 1948"
            className="rounded-base border border-surface bg-bg px-3 py-2.5 outline-none focus:border-primary"
          />
        </label>
      </div>

      {/* 동의 체크박스 (필수) */}
      <label className="flex items-start gap-3 rounded-base bg-surface p-4 text-sm leading-relaxed">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
        />
        <span>
          통화 녹취·전사 저장에 대해 부모님을 대신해 동의합니다. (첫 통화 시
          부모님께도 음성으로 안내됩니다)
        </span>
      </label>

      <button
        type="submit"
        disabled={!consent}
        className="rounded-base bg-primary px-4 py-3 font-semibold text-bg disabled:opacity-50"
      >
        피보호자 등록
      </button>

      {!consent ? (
        <p className="text-center text-xs text-text-muted">
          동의에 체크하셔야 등록할 수 있습니다.
        </p>
      ) : null}

      {done ? (
        <p className="rounded-base bg-surface px-4 py-3 text-center text-sm font-medium text-primary">
          등록되었습니다. (데모 — 실제 저장은 다음 단계에서 연결됩니다)
        </p>
      ) : null}
    </form>
  );
}
