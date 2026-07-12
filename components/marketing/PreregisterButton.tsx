"use client";

import { useRouter } from "next/navigation";
import { useCtaTracking } from "./useCtaTracking";

type Variant = "solid" | "outline";

type Size = "md" | "sm";

interface PreregisterButtonProps {
  /** 버튼 라벨 (기본: 사전등록하기) */
  label?: string;
  variant?: Variant;
  size?: Size;
  /** 데스크톱에서도 가로 꽉 채울지 여부 */
  block?: boolean;
  className?: string;
}

/**
 * 랜딩 전역에서 재사용하는 [사전등록하기] CTA.
 * 클릭 시 CLICK_TRY 이벤트를 fire-and-forget 전송한 뒤 /preregister 로 이동한다.
 * (이 컴포넌트가 마운트되면 useCtaTracking이 세션당 1회 VIEW도 전송 — 랜딩 페이지에서만 사용.)
 */
export function PreregisterButton({
  label = "사전등록하기",
  variant = "solid",
  size = "md",
  block = false,
  className = "",
}: PreregisterButtonProps) {
  const router = useRouter();
  const { sendEvent } = useCtaTracking();

  const handleClick = () => {
    void sendEvent("CLICK_TRY");
    router.push("/preregister");
  };

  const base =
    "inline-flex items-center justify-center rounded-base font-semibold transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  const sizing =
    size === "sm" ? "px-4 py-2.5 text-sm" : "px-6 py-4 text-base";
  const width = block
    ? "w-full"
    : size === "sm"
      ? "w-auto"
      : "w-full sm:w-auto sm:min-w-56";
  const tone =
    variant === "solid"
      ? "bg-primary text-bg shadow-sm"
      : "border border-bg/70 bg-transparent text-bg";

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`${base} ${sizing} ${width} ${tone} ${className}`}
    >
      {label}
    </button>
  );
}
