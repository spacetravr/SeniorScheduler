/**
 * 설정 (/app/settings) — 로그인 이메일 표시 + 로그아웃(실동작). 알림 설정은 준비 중(placeholder).
 */
import Link from "next/link";
import { Coins, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { NotifyToggle } from "@/components/app/NotifyToggle";
import { LogoutButton } from "@/components/app/LogoutButton";
import { PasswordChangeForm } from "@/components/app/PasswordChangeForm";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? "-";

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="설정" subtitle="계정과 알림을 관리합니다." />

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">계정</h2>
        <div className="flex items-center justify-between gap-4 rounded-base border border-border bg-bg p-4 shadow-card">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-text-muted">로그인 이메일</span>
            <span className="font-medium">{email}</span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">비밀번호</h2>
        <div className="rounded-base border border-border bg-bg p-4 shadow-card">
          <PasswordChangeForm />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">크레딧·결제</h2>
        <Link
          href="/app/billing"
          className="flex items-center gap-3 rounded-base border border-border bg-bg p-4 shadow-card transition-colors hover:border-primary"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
            aria-hidden
          >
            <Coins className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="font-medium">크레딧·결제</span>
            <span className="break-keep text-sm text-text-muted">
              잔여 크레딧 확인과 충전 (베타 기간 무료)
            </span>
          </div>
          <ChevronRight
            className="h-5 w-5 shrink-0 text-text-muted"
            aria-hidden
            strokeWidth={2}
          />
        </Link>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">알림</h2>
        <NotifyToggle label="통화 완료 시 결과 알림" initial={true} />
        <NotifyToggle label="불발(무응답) 발생 시 알림" initial={true} />
        <NotifyToggle label="주간 이행률 요약 알림" initial={false} />
        <p className="text-xs text-text-muted">
          알림 채널 연동은 준비 중입니다. (설정값은 아직 저장되지 않습니다)
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">기타</h2>
        <LogoutButton />
      </section>
    </div>
  );
}
