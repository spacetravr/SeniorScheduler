import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";
import { PreregisterLink } from "./PreregisterLink";

/**
 * 서브 마케팅 페이지(소개·FAQ·약관·방침) 공용 껍데기.
 * 공용 헤더/푸터로 감싸며, 헤더 CTA는 추적 없는 PreregisterLink를 사용한다.
 */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader cta={<PreregisterLink size="sm" />} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
