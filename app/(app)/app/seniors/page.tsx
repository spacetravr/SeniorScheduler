/**
 * 피보호자 (/app/seniors) — 목록 + 등록 폼(동의 체크박스 필수).
 */
import { PageHeader } from "@/components/app/PageHeader";
import { SeniorForm } from "@/components/app/SeniorForm";
import { seniors } from "@/lib/mock/data";
import { fmtDate } from "@/components/app/format";

export default function SeniorsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="피보호자"
        subtitle="부모님을 등록하고 동의 상태를 관리합니다."
      />

      <section className="flex flex-col gap-2">
        {seniors.map((s) => {
          const consented = Boolean(s.consent_at);
          return (
            <div
              key={s.id}
              className="flex items-center justify-between gap-4 rounded-base border border-surface p-4"
            >
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-sm text-text-muted">
                    {s.relationship}
                    {s.birth_year ? ` · ${s.birth_year}년생` : ""}
                  </span>
                </div>
                <span className="text-sm text-text-muted tabular-nums">
                  {s.phone}
                </span>
              </div>
              {consented ? (
                <span className="inline-flex items-center rounded-base bg-primary px-2.5 py-1 text-xs font-semibold text-bg">
                  동의 완료 · {fmtDate(s.consent_at!)}
                </span>
              ) : (
                <span className="inline-flex items-center rounded-base border border-accent px-2.5 py-1 text-xs font-semibold text-accent">
                  동의 대기
                </span>
              )}
            </div>
          );
        })}
      </section>

      <SeniorForm />
    </div>
  );
}
