/**
 * 설정 (/app/settings) — 계정 이메일(mock), 알림 설정 placeholder, 로그아웃(동작 없음).
 */
import { PageHeader } from "@/components/app/PageHeader";
import { NotifyToggle } from "@/components/app/NotifyToggle";

const MOCK_EMAIL = "guardian@example.com";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="설정" subtitle="계정과 알림을 관리합니다." />

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">계정</h2>
        <div className="flex items-center justify-between gap-4 rounded-base border border-surface p-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm text-text-muted">로그인 이메일</span>
            <span className="font-medium">{MOCK_EMAIL}</span>
          </div>
        </div>
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
        <button
          type="button"
          className="rounded-base border border-surface px-4 py-3 text-sm font-semibold text-text-muted"
        >
          로그아웃
        </button>
      </section>
    </div>
  );
}
