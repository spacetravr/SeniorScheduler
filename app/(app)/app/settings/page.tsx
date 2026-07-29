/**
 * 설정 (/app/settings) — 계정·비밀번호·크레딧·알림 레벨·온보딩 설문 재작성.
 * 알림은 boolean 토글 3종 대신 **레벨 3지선다**(NotifyLevelForm)로 통합했다 (docs/report-spec.md §3).
 * 단 주간 요약 수신만은 별개 의사표시라 전용 토글(WeeklySummaryToggle)로 남긴다 —
 * 3지선다 개편 때 이 값을 켤 UI 가 사라져 주간 메일이 전면 미발송이던 문제를 되돌린 것(0012).
 * 초기 표시값은 기존 boolean 설정에서 유도한다(components/app/notifyLevel.ts, 순수 함수).
 */
import Link from "next/link";
import {
  Coins,
  ChevronRight,
  ClipboardList,
  CalendarDays,
  CalendarRange,
  CalendarClock,
} from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { NotifyLevelForm } from "@/components/app/NotifyLevelForm";
import { WeeklySummaryToggle } from "@/components/app/WeeklySummaryToggle";
import { toNotifyLevel } from "@/components/app/notifyLevel";
import { LogoutButton } from "@/components/app/LogoutButton";
import { PasswordChangeForm } from "@/components/app/PasswordChangeForm";
import { createServerSupabase } from "@/lib/supabase/server";
import { getNotifySettings } from "@/lib/actions/settings";
import { DEFAULT_NOTIFY_SETTINGS } from "@/lib/contracts/settings";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email ?? "-";

  // 저장된 알림 설정 조회 — 실패 시 기본값으로 강등(페이지는 항상 렌더).
  const notifyRes = await getNotifySettings();
  const notifySettings = notifyRes.ok ? notifyRes.settings : DEFAULT_NOTIFY_SETTINGS;

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
        <h2 className="text-base font-semibold">연동</h2>
        {[
          { icon: CalendarDays, name: "Google 캘린더" },
          { icon: CalendarRange, name: "네이버 캘린더" },
          { icon: CalendarClock, name: "카카오 캘린더" },
        ].map(({ icon: Icon, name }) => (
          <div
            key={name}
            className="flex items-center gap-3 rounded-base border border-border bg-bg p-4 shadow-card"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
              aria-hidden
            >
              <Icon className="h-5 w-5" strokeWidth={2} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-medium">{name}</span>
              <span className="break-keep text-sm text-text-muted">
                부모님 일정을 내 캘린더에 자동 동기화
              </span>
            </div>
            <span className="inline-flex shrink-0 items-center rounded-base border border-text-muted px-2 py-0.5 text-xs font-semibold leading-none text-text-muted">
              곧 지원
            </span>
          </div>
        ))}
        <p className="break-keep text-xs text-text-muted">
          외부 도구 연동은 베타 기간 중 순차 오픈됩니다.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">알림</h2>
        <NotifyLevelForm initial={toNotifyLevel(notifySettings)} />
        <WeeklySummaryToggle initial={notifySettings.notify_weekly_summary} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">맞춤 설문</h2>
        <Link
          href="/app/onboarding"
          className="flex items-center gap-3 rounded-base border border-border bg-bg p-4 shadow-card transition-colors hover:border-primary"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
            aria-hidden
          >
            <ClipboardList className="h-5 w-5" strokeWidth={2} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-medium">시작 설문 다시 작성하기</span>
            <span className="break-keep text-sm text-text-muted">
              부모님 연세·걱정거리·통화 시간대를 언제든 수정하실 수 있어요
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
        <h2 className="text-base font-semibold">기타</h2>
        <LogoutButton />
      </section>
    </div>
  );
}
