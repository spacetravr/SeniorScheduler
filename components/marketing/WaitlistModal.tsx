"use client";

import { useEffect, useState } from "react";

type Status = "form" | "submitting" | "done" | "error";

interface WaitlistModalProps {
  open: boolean;
  onClose: () => void;
  /** 성공 시 true 반환. */
  onSubmit: (email: string) => Promise<boolean>;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function WaitlistModal({
  open,
  onClose,
  onSubmit,
}: WaitlistModalProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("form");
  const [touched, setTouched] = useState(false);

  // 모달이 닫히면 상태 초기화.
  useEffect(() => {
    if (!open) {
      const t = setTimeout(() => {
        setEmail("");
        setStatus("form");
        setTouched(false);
      }, 200);
      return () => clearTimeout(t);
    }
  }, [open]);

  // ESC 로 닫기.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const emailValid = EMAIL_RE.test(email.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!emailValid) return;
    setStatus("submitting");
    const ok = await onSubmit(email.trim());
    setStatus(ok ? "done" : "error");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-text/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="waitlist-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-base bg-bg p-6 shadow-xl sm:rounded-base"
        onClick={(e) => e.stopPropagation()}
      >
        {status === "done" ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface text-2xl text-primary">
              ✓
            </div>
            <h2 id="waitlist-title" className="text-lg font-bold">
              사전등록이 완료됐어요
            </h2>
            <p className="text-sm text-text-muted">
              오픈 소식으로 가장 먼저 찾아뵐게요. 소중한 관심에 감사드립니다.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full rounded-base bg-primary px-4 py-3 font-semibold text-bg"
            >
              닫기
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-2">
              <h2 id="waitlist-title" className="text-lg font-bold">
                사전등록하기
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="닫기"
                className="-mr-1 -mt-1 rounded-base px-2 py-1 text-text-muted"
              >
                ✕
              </button>
            </div>
            <p className="text-sm text-text-muted">
              이메일을 남겨주시면 베타 오픈 소식을 가장 먼저 알려드릴게요.
            </p>
            <div className="flex flex-col gap-1">
              <label htmlFor="waitlist-email" className="sr-only">
                이메일 주소
              </label>
              <input
                id="waitlist-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="이메일 주소를 입력해 주세요"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setTouched(true)}
                className="w-full rounded-base border border-surface bg-surface px-4 py-3 text-base text-text outline-none focus:border-primary"
                autoFocus
              />
              {touched && !emailValid && (
                <p className="px-1 text-sm text-accent">
                  올바른 이메일 주소를 입력해 주세요.
                </p>
              )}
              {status === "error" && (
                <p className="px-1 text-sm text-accent">
                  잠시 후 다시 시도해 주세요.
                </p>
              )}
            </div>
            <button
              type="submit"
              disabled={status === "submitting"}
              className="w-full rounded-base bg-primary px-4 py-3 font-semibold text-bg disabled:opacity-60"
            >
              {status === "submitting" ? "등록 중..." : "사전등록하기"}
            </button>
            <p className="text-center text-xs text-text-muted">
              입력하신 이메일은 서비스 안내 목적으로만 사용됩니다.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
