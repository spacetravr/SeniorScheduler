"use client";

import { useState } from "react";
import { useCtaTracking } from "./useCtaTracking";
import { isValidEmail } from "./validation";

type Status = "form" | "submitting" | "done" | "error";

/**
 * /preregister 우측 이메일 등록 카드.
 * 제출 시 POST /api/waitlist(계약: waitlistInputSchema) + WAITLIST_SUBMIT 이벤트를 보낸다.
 * 이 페이지에서는 VIEW 이벤트를 보내지 않는다(trackView:false — 세션당 1회 unique 제약).
 */
export function PreregisterForm() {
  const { submitWaitlist } = useCtaTracking({ trackView: false });
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("form");
  const [touched, setTouched] = useState(false);

  const emailValid = isValidEmail(email);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (!emailValid) return;
    setStatus("submitting");
    const ok = await submitWaitlist(email.trim());
    setStatus(ok ? "done" : "error");
  };

  if (status === "done") {
    return (
      <div className="flex flex-col items-center gap-4 rounded-base border border-surface bg-bg p-8 text-center shadow-sm">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface text-3xl">
          🎉
        </div>
        <h2 className="text-xl font-bold">사전등록이 완료되었습니다</h2>
        <p className="max-w-xs text-sm leading-relaxed text-text-muted">
          정식 출시 소식을 이메일로 가장 먼저 보내드릴게요. 소중한 관심에
          감사드립니다.
        </p>
        <p className="text-sm font-medium text-primary">{email.trim()}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 rounded-base border border-surface bg-bg p-6 shadow-sm sm:p-8">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold">이메일로 사전등록</h2>
        <p className="text-sm leading-relaxed text-text-muted">
          이메일 한 줄이면 준비 완료입니다. 정식 출시되면 가장 먼저 안내
          메일을 보내드릴게요.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="preregister-email" className="text-sm font-medium">
            이메일 주소
          </label>
          <input
            id="preregister-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="parent@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched(true)}
            className="w-full rounded-base border border-surface bg-surface px-4 py-3.5 text-base text-text outline-none focus:border-primary"
          />
          {touched && !emailValid && (
            <p className="px-1 text-sm text-accent">
              올바른 이메일 주소를 입력해 주세요.
            </p>
          )}
          {status === "error" && (
            <p className="px-1 text-sm text-accent">
              잠시 문제가 있었어요. 잠시 후 다시 시도해 주세요.
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={status === "submitting"}
          className="w-full rounded-base bg-primary px-6 py-4 text-base font-semibold text-bg shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {status === "submitting" ? "등록 중..." : "사전등록 완료하기"}
        </button>
      </form>

      <ul className="flex flex-col gap-1.5 border-t border-surface pt-4 text-xs leading-relaxed text-text-muted">
        <li>· 이메일은 출시 안내 목적으로만 사용됩니다.</li>
        <li>· 결제 정보를 요구하지 않습니다.</li>
        <li>· 안내 메일은 언제든 수신 거부하실 수 있습니다.</li>
        <li>· 사전등록은 구매 약정이 아닙니다.</li>
      </ul>
    </div>
  );
}
