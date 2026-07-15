/**
 * 보호자 웹 공통 레이아웃 (PLAN.md Phase 1).
 * 모바일: 하단 탭바 / 데스크톱: 좌측 사이드바. 한국어 존댓말 UI.
 */
import { DesktopSidebar, MobileHeader, MobileTabBar } from "@/components/app/AppNav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl">
      <DesktopSidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />
        <main className="flex-1 px-5 pb-24 pt-6 md:px-8 md:pb-10">{children}</main>
      </div>
      <MobileTabBar />
    </div>
  );
}
