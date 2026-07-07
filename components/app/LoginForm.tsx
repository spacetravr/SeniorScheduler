"use client";

/**
 * 로그인/회원가입 폼 — 이메일+비밀번호가 주 로그인.
 * - 탭 전환: 로그인 ↔ 회원가입.
 * - 회원가입 결과 session=true 면 즉시 /app 이동, false 면 확인 메일 안내.
 * - 하단 접힌 보조 섹션: 비밀번호 분실 시 magic link 로그인(sendMagicLink).
 * 비밀번호 정책 검증은 서버 zod 담당(8~72자). 클라이언트는 기본 속성 + 서버 에러 표시만.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  signInWithPassword,
  signUpWithPassword,
  sendMagicLink,
} from "@/lib/actions/auth";

type Mode = "signin" | "signup";

const inputClass =
  "rounded-base border border-surface bg-bg px-3 py-2.5 outline-none focus:border-primary";

export function LoginForm() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signin");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function resetMessages() {
    setError(null);
    setNotice(null);
  }

  function switchMode(next: Mode) {
    setMode(next);
    resetMessages();
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    resetMessages();
    startTransition(async () => {
      if (mode === "signup") {
        const result = await signUpWithPassword(formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        if (result.session) {
          router.push("/app");
          router.refresh();
          return;
        }
        setNotice(result.message);
        return;
      }

      const result = await signInWithPassword(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push("/app");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* 탭 */}
      <div
        role="tablist"
        aria-label="로그인 또는 회원가입"
        className="grid grid-cols-2 gap-1 rounded-base bg-surface p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signin"}
          onClick={() => switchMode("signin")}
          className={`rounded-base px-3 py-2 text-sm font-semibold ${
            mode === "signin" ? "bg-bg text-text shadow-sm" : "text-text-muted"
          }`}
        >
          로그인
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          onClick={() => switchMode("signup")}
          className={`rounded-base px-3 py-2 text-sm font-semibold ${
            mode === "signup" ? "bg-bg text-text shadow-sm" : "text-text-muted"
          }`}
        >
          회원가입
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">이메일</span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            className={inputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">비밀번호</span>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            maxLength={72}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            placeholder={mode === "signup" ? "8자 이상" : "비밀번호"}
            className={inputClass}
          />
        </label>

        {mode === "signup" ? (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">비밀번호 확인</span>
            <input
              name="password_confirm"
              type="password"
              required
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              placeholder="비밀번호를 다시 입력"
              className={inputClass}
            />
          </label>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-base bg-primary px-4 py-3 font-semibold text-bg disabled:opacity-50"
        >
          {pending
            ? "처리 중…"
            : mode === "signup"
              ? "회원가입"
              : "로그인"}
        </button>

        {error ? (
          <p
            role="alert"
            className="rounded-base bg-surface px-4 py-3 text-center text-sm font-medium text-accent"
          >
            {error}
          </p>
        ) : null}

        {notice ? (
          <div
            role="status"
            className="flex flex-col gap-1.5 rounded-base bg-surface px-4 py-3 text-center"
          >
            <span className="text-lg" aria-hidden>
              📬
            </span>
            <p className="text-sm font-medium leading-relaxed">{notice}</p>
          </div>
        ) : null}
      </form>

      {mode === "signup" ? (
        <p className="text-center text-xs leading-relaxed text-text-muted">
          가입 즉시 시작할 수 있어요. 이메일 확인이 필요한 경우 안내 메일을 보내드려요.
        </p>
      ) : null}

      <MagicLinkFallback />
    </div>
  );
}

/**
 * 비밀번호 분실 시 보조 로그인 — 기본 접힘. 펼치면 이메일 magic link 발송.
 */
function MagicLinkFallback() {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "");
    setError(null);
    startTransition(async () => {
      const result = await sendMagicLink(formData);
      if (result.ok) {
        setSentTo(email);
        setMessage(result.message);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="border-t border-surface pt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full text-center text-sm font-medium text-text-muted"
      >
        비밀번호를 잊으셨나요? 메일로 로그인 {open ? "▲" : "▼"}
      </button>

      {open ? (
        sentTo ? (
          <div
            role="status"
            className="mt-4 flex flex-col gap-1.5 rounded-base bg-surface px-4 py-3 text-center"
          >
            <span className="text-lg" aria-hidden>
              📬
            </span>
            <p className="text-sm font-medium">메일함을 확인해 주세요</p>
            <p className="text-sm leading-relaxed text-text-muted">
              {message ?? "로그인 링크를 이메일로 보냈어요."}
            </p>
            <p className="text-sm font-medium">{sentTo}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
            <p className="text-xs leading-relaxed text-text-muted">
              가입한 이메일로 로그인 링크를 보내드려요. 로그인 후 설정에서 새 비밀번호를
              정할 수 있어요.
            </p>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">이메일</span>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                className={inputClass}
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="rounded-base border border-primary px-4 py-2.5 text-sm font-semibold text-primary disabled:opacity-50"
            >
              {pending ? "보내는 중…" : "로그인 링크 받기"}
            </button>
            {error ? (
              <p
                role="alert"
                className="rounded-base bg-surface px-4 py-2.5 text-center text-sm font-medium text-accent"
              >
                {error}
              </p>
            ) : null}
          </form>
        )
      ) : null}
    </div>
  );
}
