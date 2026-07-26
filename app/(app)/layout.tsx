/**
 * 보호자 웹 공통 레이아웃 (PLAN.md Phase 1).
 * 모바일: 하단 탭바 / 데스크톱: 좌측 사이드바. 한국어 존댓말 UI.
 */
import { DesktopSidebar, MobileHeader, MobileTabBar } from "@/components/app/AppNav";
import { getMyCredits } from "@/lib/actions/credits";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // 잔여 크레딧은 레이아웃에서 1회 조회해 배지(사이드바·모바일 헤더)에 내려준다.
  // 조회 실패 시 null → 배지가 "-"로 안전 강등(화면 크래시 금지).
  let credits: number | null = null;
  try {
    credits = (await getMyCredits()).balance;
  } catch {
    credits = null;
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl">
      <DesktopSidebar credits={credits} />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader credits={credits} />
        {/* 베타 안내 — 발신 기능 순차 오픈 (기대치 안내용, 기능 제한 없음) */}
        <p className="break-keep border-b border-border bg-surface px-5 py-2.5 text-center text-xs leading-relaxed text-text-muted">
          베타 준비 중입니다 — 전화 발신은 순차 오픈 예정이에요. 지금은 부모님과
          일정을 미리 등록해 두실 수 있어요.
        </p>
        <main className="flex-1 px-5 pb-24 pt-6 md:px-8 md:pb-10">{children}</main>
      </div>
      <MobileTabBar />
    </div>
  );
}
