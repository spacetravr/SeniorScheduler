import Link from "next/link";

type Variant = "solid" | "outline";
type Size = "md" | "sm";

interface PreregisterLinkProps {
  /** 링크 라벨 (기본: 사전등록하기) */
  label?: string;
  variant?: Variant;
  size?: Size;
  /** 데스크톱에서도 가로 꽉 채울지 여부 */
  block?: boolean;
  className?: string;
}

/**
 * 추적 없는 [사전등록하기] CTA 링크 (서버 컴포넌트).
 * 랜딩의 PreregisterButton과 동일한 외형이지만 CTA 이벤트를 전송하지 않는다.
 * 소개/FAQ/약관 등 서브 페이지에서 사용 — 추적은 랜딩(`/`)에서만 발생한다.
 */
export function PreregisterLink({
  label = "사전등록하기",
  variant = "solid",
  size = "md",
  block = false,
  className = "",
}: PreregisterLinkProps) {
  const base =
    "inline-flex items-center justify-center rounded-base font-semibold transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";
  const sizing = size === "sm" ? "px-4 py-2.5 text-sm" : "px-6 py-4 text-base";
  const width = block
    ? "w-full"
    : size === "sm"
      ? "w-auto"
      : "w-full sm:w-auto sm:min-w-56";
  const tone =
    variant === "solid"
      ? "bg-primary text-bg shadow-sm"
      : "border border-primary/40 bg-transparent text-primary";

  return (
    <Link
      href="/preregister"
      className={`${base} ${sizing} ${width} ${tone} ${className}`}
    >
      {label}
    </Link>
  );
}
