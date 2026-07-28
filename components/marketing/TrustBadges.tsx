/**
 * 신뢰 배지 (docs/site-structure.md §3) — 마케팅 전 페이지 공용 1급 요소.
 * MARKETING-PLAN §2 "모든 채널 필수 포함 신뢰 요소"를 화면 상단부에 노출한다(FAQ 안에 접어 두지 않음).
 * variant: "full"(카드 그리드 — `/`, `/service`) | "compact"(1줄 축약 — `/preregister`).
 * 아이콘은 lucide-react(이모지 금지). 색·라운드·그림자는 디자인 토큰만 사용.
 *
 * 2026-07-28: "억지 판정 없음"을 **첫 배지로 추가**(4→5).
 * THIRD-PLAN §0-1 이 확인한 우리의 유일한 차별축(국내외 어디에도 없는 "정직한 판정")이
 * 정작 신뢰 요소에서 빠져 있었다. 나머지 4개는 경쟁사도 말할 수 있는 위생 요소이므로
 * 우리를 우리로 만드는 항목이 맨 앞에 온다.
 */
import { ScanSearch, ShieldCheck, MicOff, Bot, PowerOff, type LucideIcon } from "lucide-react";

type TrustBadge = {
  icon: LucideIcon;
  title: string;
  /** 카드형(full)에서만 노출되는 설명 문구. */
  body: string;
};

export const TRUST_BADGES: TrustBadge[] = [
  {
    icon: ScanSearch,
    title: "억지 판정 없음",
    body: "확인이 안 되면 '확인 필요'라고 그대로 알려드려요. 짐작으로 '완료'를 만들지 않습니다.",
  },
  {
    icon: ShieldCheck,
    title: "본인 동의 후 발신",
    body: "첫 통화에서 부모님께 직접 안내하고, 동의하신 뒤에만 전화드려요.",
  },
  {
    icon: MicOff,
    title: "녹음 미저장",
    body: "통화 음성은 저장하지 않아요. 텍스트 요약만 남습니다.",
  },
  {
    icon: Bot,
    title: "AI 자기고지",
    body: "통화 시작에 AI가 안내 전화를 드린다고 먼저 밝혀요.",
  },
  {
    icon: PowerOff,
    title: "언제든 해지",
    body: "약정도 위약금도 없어요. 언제든 끄실 수 있습니다.",
  },
];

interface TrustBadgesProps {
  variant?: "full" | "compact";
  className?: string;
}

export function TrustBadges({
  variant = "full",
  className = "",
}: TrustBadgesProps) {
  if (variant === "compact") {
    return (
      <ul
        className={`flex flex-wrap items-center justify-center gap-x-4 gap-y-2 ${className}`}
        aria-label="서비스 신뢰 요소"
      >
        {TRUST_BADGES.map(({ icon: Icon, title }) => (
          <li
            key={title}
            className="flex items-center gap-1.5 rounded-base border border-border bg-bg px-3 py-1.5 text-sm font-medium text-text-muted"
          >
            <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            <span>{title}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul
      className={`grid gap-4 sm:grid-cols-2 lg:grid-cols-3 ${className}`}
      aria-label="서비스 신뢰 요소"
    >
      {TRUST_BADGES.map(({ icon: Icon, title, body }) => (
        <li
          key={title}
          className="flex flex-col gap-3 rounded-base border border-border bg-bg p-6 shadow-card"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-base bg-primary-soft">
            <Icon className="h-6 w-6 text-primary" aria-hidden />
          </span>
          <h3 className="text-lg font-bold leading-snug">{title}</h3>
          <p className="text-sm leading-relaxed text-text-muted">{body}</p>
        </li>
      ))}
    </ul>
  );
}
