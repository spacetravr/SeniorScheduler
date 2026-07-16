"use client";

/**
 * 일정 등록/수정 폼 — createSchedule/updateSchedule(Server Action) 결합.
 * 반복 선택지는 데이터 계층이 지원하는 두 형태만 생성한다:
 *   - 매일        → "FREQ=DAILY"
 *   - 주중/요일선택 → "FREQ=WEEKLY;BYDAY=..."
 * 신규 등록은 항상 비활성(active=false)으로 만들고, 발신 ON 은 목록 토글에서 처리한다
 * (미동의 피보호자 활성화 에러를 등록 흐름에서 분리).
 */
import { useMemo, useState, useTransition } from "react";
import { SCHEDULE_TYPES, scheduleTypeLabel } from "@/lib/contracts/domain";
import type { Schedule, Senior } from "@/lib/contracts/domain";
import { createSchedule, updateSchedule } from "@/lib/actions/schedules";

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

const WEEKDAY_CODES = ["MO", "TU", "WE", "TH", "FR"];

const SCRIPT_PLACEHOLDER =
  "예: 어머니, 아침 혈압약 드실 시간이에요. 챙겨 드셨나요?";

/** 기존 rrule → 폼 초기 상태(repeat/days). */
function parseRrule(rrule: string | undefined): { repeat: Repeat; days: string[] } {
  if (!rrule || rrule.includes("FREQ=DAILY")) return { repeat: "DAILY", days: ["MO"] };
  const byday = rrule.match(/BYDAY=([A-Z,]+)/)?.[1];
  const days = byday ? byday.split(",") : ["MO"];
  const isWeekday =
    days.length === 5 && WEEKDAY_CODES.every((d) => days.includes(d));
  return { repeat: isWeekday ? "WEEKDAY" : "CUSTOM", days };
}

type Props =
  | { mode: "create"; seniors: Senior[]; onDone?: () => void; schedule?: undefined }
  | { mode: "edit"; schedule: Schedule; seniors: Senior[]; onDone?: () => void };

export function ScheduleForm(props: Props) {
  const isEdit = props.mode === "edit";
  const initial = parseRrule(props.schedule?.rrule);
  const [repeat, setRepeat] = useState<Repeat>(initial.repeat);
  const [days, setDays] = useState<string[]>(initial.days);
  // 신규 등록은 유형 복수 선택(1개 이상). 수정은 단일 유형이라 이 상태를 쓰지 않는다.
  const [types, setTypes] = useState<string[]>([props.schedule?.type ?? "MEDICATION"]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function toggleType(code: string) {
    setTypes((prev) =>
      prev.includes(code) ? prev.filter((t) => t !== code) : [...prev, code],
    );
  }

  const rrule = useMemo(() => {
    if (repeat === "DAILY") return "FREQ=DAILY";
    if (repeat === "WEEKDAY") return "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR";
    const ordered = WEEKDAYS.filter((d) => days.includes(d.code)).map((d) => d.code);
    return ordered.length ? `FREQ=WEEKLY;BYDAY=${ordered.join(",")}` : "";
  }, [repeat, days]);

  function toggleDay(code: string) {
    setDays((prev) =>
      prev.includes(code) ? prev.filter((d) => d !== code) : [...prev, code],
    );
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    setError(null);

    if (!rrule) {
      setError("반복할 요일을 하나 이상 선택해 주세요.");
      return;
    }

    if (!isEdit && types.length === 0) {
      setError("일정 유형을 하나 이상 선택해 주세요.");
      return;
    }

    const base = {
      senior_id: String(fd.get("senior_id") ?? ""),
      title: String(fd.get("title") ?? "").trim(),
      script_template: String(fd.get("script_template") ?? "").trim(),
      call_time: String(fd.get("call_time") ?? ""),
      rrule,
    };

    // ── 수정: 기존대로 단일 유형 1건 ──
    if (isEdit) {
      startTransition(async () => {
        const result = await updateSchedule({
          id: props.schedule.id,
          ...base,
          type: String(fd.get("type") ?? "MEDICATION"),
          active: props.schedule.active,
        });
        if (result.ok) props.onDone?.();
        else setError(result.error);
      });
      return;
    }

    // ── 신규: 선택한 유형마다 createSchedule 를 1회씩 반복 호출 ──
    // 2개 이상이면 각 건 제목 뒤에 " — {유형 라벨}" 접미를 붙여 구분한다.
    const multi = types.length > 1;
    startTransition(async () => {
      const results = await Promise.all(
        types.map(async (type) => {
          const label = scheduleTypeLabel[type as keyof typeof scheduleTypeLabel];
          const title = multi ? `${base.title} — ${label}` : base.title;
          const r = await createSchedule({ ...base, type, title, active: false });
          return { label, ok: r.ok, error: r.ok ? null : r.error };
        }),
      );

      const failed = results.filter((r) => !r.ok);
      if (failed.length === 0) {
        form.reset();
        setRepeat("DAILY");
        setDays(["MO"]);
        setTypes(["MEDICATION"]);
        props.onDone?.();
        return;
      }

      const firstErr = failed[0].error ?? "알 수 없는 오류가 발생했어요.";
      if (failed.length === results.length) {
        // 전부 실패
        setError(`일정 등록에 실패했어요: ${firstErr}`);
      } else {
        // 일부만 실패
        const okLabels = results.filter((r) => r.ok).map((r) => r.label).join("·");
        const failLabels = failed.map((r) => r.label).join("·");
        setError(
          `${okLabels} 일정은 등록됐지만 ${failLabels} 일정 등록에 실패했어요: ${firstErr}`,
        );
      }
    });
  }

  const s = props.schedule;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-base border border-border bg-bg p-5 shadow-card"
    >
      {isEdit ? (
        <h2 className="text-base font-semibold">일정 수정</h2>
      ) : null}

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">피보호자</span>
        <select
          name="senior_id"
          required
          defaultValue={s?.senior_id ?? props.seniors[0]?.id}
          className="rounded-base border border-border bg-bg px-3 py-2.5 outline-none focus:border-primary"
        >
          {props.seniors.map((sr) => (
            <option key={sr.id} value={sr.id}>
              {sr.name} ({sr.relationship})
            </option>
          ))}
        </select>
      </label>

      {isEdit ? (
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5 text-sm">
            <span className="font-medium">유형</span>
            <select
              name="type"
              required
              defaultValue={s?.type ?? "MEDICATION"}
              className="rounded-base border border-border bg-bg px-3 py-2.5 outline-none focus:border-primary"
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
              defaultValue={s?.call_time ?? "09:00"}
              className="rounded-base border border-border bg-bg px-3 py-2.5 outline-none focus:border-primary"
            />
          </label>
        </div>
      ) : (
        <>
          {/* 유형 복수 선택 (1개 이상 필수) */}
          <div className="flex flex-col gap-2 text-sm">
            <span className="font-medium">
              유형{" "}
              <span className="font-normal text-text-muted">(복수 선택 가능)</span>
            </span>
            <div className="flex flex-wrap gap-2">
              {SCHEDULE_TYPES.map((t) => {
                const on = types.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleType(t)}
                    className={`rounded-base px-3.5 py-2 font-medium transition-colors ${
                      on ? "bg-primary text-bg" : "bg-surface text-text-muted"
                    }`}
                  >
                    {scheduleTypeLabel[t]}
                  </button>
                );
              })}
            </div>
            {types.length > 1 ? (
              <p className="break-keep text-xs leading-relaxed text-text-muted">
                {types.length}개 유형이 각각 별도 일정으로 등록됩니다. 제목 뒤에
                유형이 붙어 구분돼요.
              </p>
            ) : null}
          </div>

          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">발신 시각</span>
            <input
              name="call_time"
              type="time"
              required
              defaultValue={s?.call_time ?? "09:00"}
              className="rounded-base border border-border bg-bg px-3 py-2.5 outline-none focus:border-primary"
            />
          </label>
        </>
      )}

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">제목</span>
        <input
          name="title"
          required
          maxLength={100}
          defaultValue={s?.title}
          placeholder="예: 아침 혈압약"
          className="rounded-base border border-border bg-bg px-3 py-2.5 outline-none focus:border-primary"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">안내 문구 템플릿</span>
        <textarea
          name="script_template"
          required
          maxLength={300}
          rows={3}
          defaultValue={s?.script_template}
          placeholder={SCRIPT_PLACEHOLDER}
          className="resize-none rounded-base border border-border bg-bg px-3 py-2.5 outline-none focus:border-primary"
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
      </div>

      {!isEdit ? (
        <p className="text-xs leading-relaxed text-text-muted">
          등록 후에는 발신이 꺼진 상태예요. 목록에서 발신을 켜면 예약 시간에 전화가
          걸립니다. (동의 완료된 피보호자만 켤 수 있어요)
        </p>
      ) : null}

      <div className="flex gap-2">
        {isEdit ? (
          <button
            type="button"
            onClick={() => props.onDone?.()}
            disabled={pending}
            className="flex-1 rounded-base border border-border px-4 py-3 font-semibold text-text-muted transition-colors hover:bg-surface disabled:opacity-50"
          >
            취소
          </button>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="flex-1 rounded-base bg-primary px-4 py-3 font-semibold text-bg disabled:opacity-50"
        >
          {pending ? "저장 중…" : isEdit ? "수정 저장" : "일정 등록"}
        </button>
      </div>

      {error ? (
        <p className="rounded-base bg-surface px-4 py-3 text-center text-sm font-medium text-accent">
          {error}
        </p>
      ) : null}
    </form>
  );
}
