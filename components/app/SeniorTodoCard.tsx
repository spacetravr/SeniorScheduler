/**
 * 피보호자별 오늘의 to-do 카드 — 대시보드 핵심 카드.
 * 상단: 프로필 헤더(이름·관계·동의 뱃지·활성 일정 수).
 * 하단: 오늘의 일정 to-do 리스트(시간·제목·유형 + 수행 여부 표시).
 *
 * 수행 여부(status) 판정은 page.tsx에서 리포트 매칭으로 도출해 넘긴다:
 *  - "DONE"                → 체크된 원형 아이콘(primary) + 제목 취소선/muted
 *  - NOT_DONE/POSTPONED/UNCERTAIN/MISSED → AdherenceStatusBadge (억지 체크 금지)
 *  - null(통화 전, 리포트 없음)          → 빈 원(muted) + "예정"
 * 색·라운드는 토큰만 사용 (하드코딩 금지).
 */
import Link from "next/link";
import { CheckCircle2, Circle } from "lucide-react";
import { AdherenceStatusBadge, ConsentBadge } from "@/components/app/StatusBadge";
import { fmtTime } from "@/components/app/format";
import {
  scheduleTypeLabel,
  type Senior,
  type Schedule,
  type CallReport,
} from "@/lib/contracts/domain";

export type SeniorTodo = {
  scheduleId: string;
  /** 오늘 발신 예정 instant(ISO) */
  scheduledAt: string;
  title: string;
  type: Schedule["type"];
  /** 오늘 통화 리포트의 이행 상태 — 리포트 없으면(통화 전) null */
  status: CallReport["adherence_status"] | null;
};

export function SeniorTodoCard({
  senior,
  activeCount,
  todos,
}: {
  senior: Senior;
  activeCount: number;
  todos: SeniorTodo[];
}) {
  return (
    <section className="flex flex-col overflow-hidden rounded-base border border-border bg-bg shadow-card">
      {/* 프로필 헤더 */}
      <Link
        href="/app/seniors"
        className="flex items-center gap-3 border-b border-border px-4 py-3.5 transition-colors hover:bg-surface/60"
      >
        <div className="flex flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="break-keep font-semibold">{senior.name}</span>
            <span className="break-keep text-sm text-text-muted">
              {senior.relationship}
            </span>
          </div>
          <span className="break-keep text-xs text-text-muted tabular-nums">
            활성 일정 {activeCount}건
          </span>
        </div>
        <ConsentBadge senior={senior} />
      </Link>

      {/* 오늘의 to-do 리스트 */}
      {todos.length === 0 ? (
        <p className="break-keep px-4 py-4 text-sm text-text-muted">
          오늘 예정된 전화가 없어요.
        </p>
      ) : (
        <ul className="flex flex-col">
          {todos.map((todo) => {
            const done = todo.status === "DONE";
            return (
              <li
                key={todo.scheduleId}
                className="flex items-center gap-3 px-4 py-3 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-border"
              >
                {/* 수행 여부 아이콘 */}
                {done ? (
                  <CheckCircle2
                    className="h-5 w-5 shrink-0 text-primary"
                    aria-label="완료"
                    strokeWidth={2}
                  />
                ) : (
                  <Circle
                    className="h-5 w-5 shrink-0 text-text-muted/50"
                    aria-label={todo.status ? "확인됨" : "예정"}
                    strokeWidth={2}
                  />
                )}

                <span
                  className={`w-12 shrink-0 text-sm font-bold tabular-nums ${
                    done ? "text-text-muted" : "text-text"
                  }`}
                >
                  {fmtTime(todo.scheduledAt)}
                </span>

                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span
                    className={`break-keep text-sm font-medium ${
                      done ? "text-text-muted line-through" : "text-text"
                    }`}
                  >
                    {todo.title}
                  </span>
                  <span className="break-keep text-xs text-text-muted">
                    {scheduleTypeLabel[todo.type]}
                  </span>
                </div>

                {/* 상태 표시: DONE 은 아이콘으로 충분, 그 외(통화 후)만 뱃지 / 통화 전은 "예정" */}
                {done ? null : todo.status ? (
                  <AdherenceStatusBadge status={todo.status} />
                ) : (
                  <span className="shrink-0 text-xs font-medium text-text-muted">
                    예정
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
