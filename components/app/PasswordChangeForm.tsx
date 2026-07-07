"use client";

/**
 * 비밀번호 변경/최초 설정 폼 — updatePassword(Server Action) 경유. 로그인 상태 전용.
 * magic link 로 들어와 비밀번호가 없는 사용자도 이 폼으로 최초 설정한다.
 * 정책 검증(8~72자, 일치)은 서버 zod 담당. 성공/실패 메시지는 접근성 role 로 노출.
 */
import { useRef, useState, useTransition } from "react";
import { updatePassword } from "@/lib/actions/auth";

const inputClass =
  "rounded-base border border-surface bg-bg px-3 py-2.5 outline-none focus:border-primary";

export function PasswordChangeForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await updatePassword(formData);
      if (result.ok) {
        setMessage(result.message);
        formRef.current?.reset();
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <p className="text-xs leading-relaxed text-text-muted">
        메일 링크로 로그인하셨다면 이 폼에서 비밀번호를 처음 설정하실 수 있어요.
      </p>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">새 비밀번호</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          placeholder="8자 이상"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">새 비밀번호 확인</span>
        <input
          name="password_confirm"
          type="password"
          required
          minLength={8}
          maxLength={72}
          autoComplete="new-password"
          placeholder="새 비밀번호를 다시 입력"
          className={inputClass}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-base bg-primary px-4 py-3 font-semibold text-bg disabled:opacity-50"
      >
        {pending ? "변경 중…" : "비밀번호 변경"}
      </button>

      {error ? (
        <p
          role="alert"
          className="rounded-base bg-surface px-4 py-3 text-center text-sm font-medium text-accent"
        >
          {error}
        </p>
      ) : null}

      {message ? (
        <p
          role="status"
          className="rounded-base bg-surface px-4 py-3 text-center text-sm font-medium text-primary"
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
