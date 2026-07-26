"use client";

/**
 * 알림 설정 폼 — 서버 액션(updateNotifySettings)으로 실저장.
 * 낙관적 UI: 토글 즉시 반영 → 저장 실패 시 이전 값으로 원복 + 인라인 오류 안내.
 * updateNotifySettings 는 3개 값 전체를 받으므로 항상 현재 상태 스냅샷을 통째로 보낸다.
 * 라벨↔컬럼 매핑은 lib/contracts/settings.ts NotifySettings 키에 1:1.
 */
import { useState, useTransition } from "react";
import { NotifyToggle } from "@/components/app/NotifyToggle";
import { updateNotifySettings } from "@/lib/actions/settings";
import type { NotifySettings } from "@/lib/contracts/settings";

type Key = keyof NotifySettings;

const FIELDS: { key: Key; label: string; description: string }[] = [
  {
    key: "notify_call_result",
    label: "통화 완료 시 결과 알림",
    description: "알림 채널 연동 준비 중이에요. 켜두시면 준비되는 대로 통화 결과를 보내드립니다.",
  },
  {
    key: "notify_missed",
    label: "불발(무응답) 발생 시 알림",
    description: "알림 채널 연동 준비 중이에요. 켜두시면 준비되는 대로 불발 소식을 보내드립니다.",
  },
  {
    key: "notify_weekly_summary",
    label: "주간 이행률 요약 알림",
    description: "켜면 매주 월요일 아침, 로그인 이메일로 지난주 요약을 보내드립니다.",
  },
];

export function NotifySettingsForm({ initial }: { initial: NotifySettings }) {
  const [settings, setSettings] = useState<NotifySettings>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggle(key: Key) {
    if (pending) return;
    const prev = settings;
    const next = { ...settings, [key]: !settings[key] };
    setSettings(next); // 낙관적 반영
    setError(null);
    startTransition(async () => {
      const res = await updateNotifySettings(next);
      if (!res.ok) {
        setSettings(prev); // 원복
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {FIELDS.map((f) => (
        <NotifyToggle
          key={f.key}
          label={f.label}
          description={f.description}
          on={settings[f.key]}
          disabled={pending}
          onToggle={() => toggle(f.key)}
        />
      ))}
      {error ? (
        <p
          role="alert"
          className="break-keep rounded-base bg-accent/10 px-3 py-2 text-sm leading-relaxed text-accent"
        >
          {error} 잠시 후 다시 시도해 주세요.
        </p>
      ) : null}
    </div>
  );
}
