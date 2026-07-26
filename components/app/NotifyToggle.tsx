"use client";

/**
 * 알림 설정 토글 (프레젠테이션 전용, 제어 컴포넌트).
 * 저장 상태·값은 상위 NotifySettingsForm 이 관리하고, 여기선 표시만 한다.
 * 색·라운드는 토큰 클래스만 사용.
 */
export function NotifyToggle({
  label,
  description,
  on,
  disabled = false,
  onToggle,
}: {
  label: string;
  description?: string;
  on: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-base border border-border bg-bg p-4 shadow-card">
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {description ? (
          <span className="break-keep text-xs leading-relaxed text-text-muted">
            {description}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        disabled={disabled}
        onClick={onToggle}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
          on ? "bg-primary" : "bg-text-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-bg transition-all ${
            on ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
    </div>
  );
}
