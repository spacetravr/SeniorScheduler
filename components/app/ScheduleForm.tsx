"use client";

/**
 * 일정 등록 폼 (mock) — 유형/제목/안내문구 템플릿/발신시각/반복/피보호자.
 * 반복 선택 → RRULE 문자열로 "표시만". 제출 시 콘솔 로그 + 성공 메시지.
 */
import { useMemo, useState } from "react";
import { SCHEDULE_TYPES, scheduleTypeLabel } from "@/lib/contracts/domain";
import type { Senior } from "@/lib/contracts/domain";

const WEEKDAYS = [
  { code: "MO", label: "월" },
  { code: "TU", label: "화" },
  { code: "WE", label: "수" },
  { code: "TH", label: "목" },
  { code: "FR", label: "금" },
  { code: "SA", label: "토" },
  { code: "SU", label: "일" },
] as const;

type Repeat = "DAILY" | "WEEKDAY" | "CUSTOM";

const SCRIPT_PLACEHOLDER =
  "예: 어머니, 아침 혈압약 드실 시간이에요. 챙겨 드셨나요?";

export function ScheduleForm({ seniors }: { seniors: Senior[] }) {
  const [repeat, setRepeat] = useState<Repeat>("DAILY");
  const [days, setDays] = useState<string[]>(["MO"]);
  const [done, setDone] = useState(false);

  const rrule = useMemo(() => {
    if (repeat === "DAILY") return "FREQ=DAILY";
    if (repeat === "WEEKDAY") return "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
    const ordered = WEEKDAYS.filter((d) => days.includes(d.code)).map(
      (d) => d.code,
    );
    return ordered.length ? `FREQ=WEEKLY;BYDAY=${ordered.join(",")}` : "FREQ=WEEKLY";
  }, [repeat, days]);

  function toggleDay(code: string) {
    setDays((prev) =>
      prev.includes(code) ? prev.filter((d) => d !== code) : [...prev, code],
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    console.log("[mock] 일정 등록", { ...data, rrule });
    setDone(true);
    form.reset();
    setRepeat("DAILY");
    setDays(["MO"]);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-base border border-surface p-5"
    >
      <h2 className="text-base font-semibold">새 일정 등록</h2>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">피보호자</span>
        <select
          name="senior_id"
          required
          className="rounded-base border border-surface bg-bg px-3 py-2.5 outline-none focus:border-primary"
        >
          {seniors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.relationship})
            </option>
          ))}
        </select>
      </label>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1.5 text-sm">
          <span className="font-medium">유형</span>
          <select
            name="type"
            required
            defaultValue="MEDICATION"
            className="rounded-base border border-surface bg-bg px-3 py-2.5 outline-none focus:border-primary"
          >
            {SCHEDULE_TYPES.map((t) => (
              <option key={t} value={t}>
                {scheduleTypeLabel[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1.5 text-sm">
          <span className="font-medium">발신 시각</span>
          <input
            name="call_time"
            type="time"
            required
            defaultValue="09:00"
            className="rounded-base border border-surface bg-bg px-3 py-2.5 outline-none focus:border-primary"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">제목</span>
        <input
          name="title"
          required
          maxLength={100}
          placeholder="예: 아침 혈압약"
          className="rounded-base border border-surface bg-bg px-3 py-2.5 outline-none focus:border-primary"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">안내 문구 템플릿</span>
        <textarea
          name="script_template"
          required
          maxLength={300}
          rows={3}
          placeholder={SCRIPT_PLACEHOLDER}
          className="resize-none rounded-base border border-surface bg-bg px-3 py-2.5 outline-none focus:border-primary"
        />
      </label>

      {/* 반복 */}
      <div className="flex flex-col gap-2 text-sm">
        <span className="font-medium">반복</span>
        <div className="flex gap-2">
          {(
            [
              { v: "DAILY", label: "매일" },
              { v: "WEEKDAY", label: "주중" },
              { v: "CUSTOM", label: "요일 선택" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setRepeat(opt.v)}
              className={`flex-1 rounded-base px-3 py-2 font-medium ${
                repeat === opt.v
                  ? "bg-primary text-bg"
                  : "bg-surface text-text-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {repeat === "CUSTOM" ? (
          <div className="flex gap-1.5">
            {WEEKDAYS.map((d) => (
              <button
                key={d.code}
                type="button"
                onClick={() => toggleDay(d.code)}
                className={`flex h-9 flex-1 items-center justify-center rounded-base text-sm font-medium ${
                  days.includes(d.code)
                    ? "bg-primary text-bg"
                    : "bg-surface text-text-muted"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        ) : null}
        <p className="text-xs text-text-muted">
          반복 규칙(RRULE): <span className="font-mono">{rrule}</span>
        </p>
      </div>

      <button
        type="submit"
        className="rounded-base bg-primary px-4 py-3 font-semibold text-bg"
      >
        일정 등록
      </button>

      {done ? (
        <p className="rounded-base bg-surface px-4 py-3 text-center text-sm font-medium text-primary">
          일정이 등록되었습니다. (데모 — 실제 저장은 다음 단계에서 연결됩니다)
        </p>
      ) : null}
    </form>
  );
}
