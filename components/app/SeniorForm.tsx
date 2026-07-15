"use client";

/**
 * 피보호자 등록/수정 폼 — createSenior/updateSenior(Server Action) 결합.
 * - create 모드: 동의 체크박스 필수(미체크 시 등록 비활성, 가드레일 5 UI).
 * - edit 모드: 기본 정보만 수정(동의 상태는 카드의 동의 토글로 별도 관리).
 * 서버 반환 에러(한국어)는 그대로 노출한다.
 */
import { useState, useTransition } from "react";
import type { Senior } from "@/lib/contracts/domain";
import { createSenior, updateSenior } from "@/lib/actions/seniors";

const RELATIONSHIPS = ["모", "부", "조모", "조부", "기타"] as const;

type Props =
  | { mode: "create"; onDone?: () => void; senior?: undefined }
  | { mode: "edit"; senior: Senior; onDone?: () => void };

function buildFields(form: HTMLFormElement) {
  const fd = new FormData(form);
  const birthRaw = String(fd.get("birth_year") ?? "").trim();
  return {
    name: String(fd.get("name") ?? "").trim(),
    phone: String(fd.get("phone") ?? "").trim(),
    relationship: String(fd.get("relationship") ?? "모"),
    birth_year: birthRaw === "" ? null : Number(birthRaw),
  };
}

export function SeniorForm(props: Props) {
  const isEdit = props.mode === "edit";
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fields = buildFields(form);
    setError(null);

    startTransition(async () => {
      const result = isEdit
        ? await updateSenior({ id: props.senior.id, ...fields })
        : await createSenior({ ...fields, consent });
      if (result.ok) {
        if (!isEdit) {
          form.reset();
          setConsent(false);
        }
        props.onDone?.();
      } else {
        setError(result.error);
      }
    });
  }

  const s = isEdit ? props.senior : undefined;

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-base border border-surface p-5"
    >
      <h2 className="text-base font-semibold">
        {isEdit ? "피보호자 정보 수정" : "새 피보호자 등록"}
      </h2>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">이름</span>
        <input
          name="name"
          required
          maxLength={50}
          defaultValue={s?.name}
          placeholder="예: 김순자"
          className="rounded-base border border-surface bg-bg px-3 py-2.5 outline-none focus:border-primary"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">전화번호</span>
        <input
          name="phone"
          required
          inputMode="tel"
          defaultValue={s?.phone}
          placeholder="예: 010-1234-5678"
          className="rounded-base border border-surface bg-bg px-3 py-2.5 outline-none focus:border-primary"
        />
      </label>

      <div className="flex gap-3">
        <label className="flex flex-1 flex-col gap-1.5 text-sm">
          <span className="font-medium">관계</span>
          <select
            name="relationship"
            required
            defaultValue={s?.relationship ?? "모"}
            className="rounded-base border border-surface bg-bg px-3 py-2.5 outline-none focus:border-primary"
          >
            {RELATIONSHIPS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1.5 text-sm">
          <span className="font-medium">출생연도</span>
          <input
            name="birth_year"
            type="number"
            min={1920}
            max={2000}
            defaultValue={s?.birth_year ?? undefined}
            placeholder="예: 1948"
            className="rounded-base border border-surface bg-bg px-3 py-2.5 outline-none focus:border-primary"
          />
        </label>
      </div>

      {/* 동의 체크박스 — create 모드에서만(가드레일 5) */}
      {!isEdit ? (
        <div className="flex flex-col gap-2">
          <label className="flex items-start gap-3 rounded-base bg-surface p-4 text-sm leading-relaxed">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0 accent-primary"
            />
            <span>
              통화 녹취·전사 저장에 대해 부모님을 대신해 동의합니다. (첫 통화 시
              부모님께도 음성으로 안내됩니다)
            </span>
          </label>
          <p className="px-1 text-xs leading-relaxed text-text-muted">
            등록 후 첫 전화는 부모님 본인 동의를 확인하는 통화입니다. 부모님이
            동의하시면 일정 전화가 시작됩니다.
          </p>
        </div>
      ) : null}

      <div className="flex gap-2">
        {isEdit ? (
          <button
            type="button"
            onClick={() => props.onDone?.()}
            disabled={pending}
            className="flex-1 rounded-base border border-surface px-4 py-3 font-semibold text-text-muted disabled:opacity-50"
          >
            취소
          </button>
        ) : null}
        <button
          type="submit"
          disabled={pending || (!isEdit && !consent)}
          className="flex-1 rounded-base bg-primary px-4 py-3 font-semibold text-bg disabled:opacity-50"
        >
          {pending
            ? "저장 중…"
            : isEdit
              ? "수정 저장"
              : "피보호자 등록"}
        </button>
      </div>

      {!isEdit && !consent ? (
        <p className="text-center text-xs text-text-muted">
          동의에 체크하셔야 등록할 수 있습니다.
        </p>
      ) : null}

      {error ? (
        <p className="rounded-base bg-surface px-4 py-3 text-center text-sm font-medium text-accent">
          {error}
        </p>
      ) : null}
    </form>
  );
}
