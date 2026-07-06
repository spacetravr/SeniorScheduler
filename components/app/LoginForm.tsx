"use client";

/**
 * 로그인 폼 — 이메일 magic link 발송. sendMagicLink(Server Action) 경유.
 * 성공 시 "메일 확인" 안내 상태로 전환, 실패 시 한국어 에러 그대로 표시.
 */
import { useState, useTransition } from "react";
import { sendMagicLink } from "@/lib/actions/auth";

export function LoginForm() {
  const [pending, startTransition] = useTransition();
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
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

  if (sentTo) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <span className="text-3xl" aria-hidden>
          📬
        </span>
        <div className="flex flex-col gap-1.5">
          <p className="font-semibold">메일함을 확인해 주세요</p>
          <p className="text-sm leading-relaxed text-text-muted">
            {message ??
              "로그인 링크를 이메일로 보냈어요. 메일함을 확인해 주세요."}
          </p>
          <p className="text-sm font-medium">{sentTo}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSentTo(null);
            setMessage(null);
          }}
          className="text-sm font-medium text-primary"
        >
          다른 이메일로 다시 시도
        </button>
      </div>
    );
  }

  return (
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
          className="rounded-base border border-surface bg-bg px-3 py-2.5 outline-none focus:border-primary"
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-base bg-primary px-4 py-3 font-semibold text-bg disabled:opacity-50"
      >
        {pending ? "보내는 중…" : "로그인 링크 받기"}
      </button>

      {error ? (
        <p className="rounded-base bg-surface px-4 py-3 text-center text-sm font-medium text-accent">
          {error}
        </p>
      ) : null}

      <p className="text-center text-xs leading-relaxed text-text-muted">
        가입과 로그인이 하나예요. 처음이셔도 링크를 받으면 바로 시작할 수 있어요.
      </p>
    </form>
  );
}
