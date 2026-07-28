"use client";

/**
 * L1 + L2 — 항목 한 줄과 접힘 상세 (docs/report-spec.md §1).
 *
 * L1: `시각 · 제목 · 상태 칩` 한 줄. **정렬은 buildDigest 가 이미 예외 우선으로 끝냈다 —
 *     여기서 재정렬하지 않는다**(집계·판정 단일 소스 원칙).
 * L2: 요약문·기분·건강. 기본 접힘이되 **예외 항목만 기본 펼침** — 정상은 조용히.
 * 피보호자 2인 이상이면 이름으로 묶고 colorIndex 로 구분색(--color-senior-1/2/3).
 */
import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Heart, Stethoscope } from "lucide-react";
import { AdherenceStatusBadge } from "@/components/app/StatusBadge";
import type { DigestItem, DigestSenior } from "@/lib/contracts/report-view";

/** 피보호자 구분색 클래스 (index % 3). Tailwind 스캔을 위해 리터럴로 나열. */
const SENIOR_DOT = ["bg-senior-1", "bg-senior-2", "bg-senior-3"] as const;

function hrefOf(item: DigestItem): string {
  return item.sessionId ? `/app/calls/${item.sessionId}` : "/app/calls";
}

function ItemRow({ item }: { item: DigestItem }) {
  // 예외만 기본 펼침 — 정상 항목은 접어 두어 읽는 비용을 줄인다.
  const [open, setOpen] = useState(item.isException);
  const hasDetail = item.summary.trim().length > 0 || item.moodFlag || item.healthFlag;

  return (
    <li
      className={`flex flex-col ${
        item.isException ? "border-l-2 border-l-accent pl-3" : "pl-[0.875rem]"
      }`}
    >
      {/* L1 — 한 줄 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        disabled={!hasDetail}
        className="flex w-full items-center gap-2.5 py-2.5 text-left disabled:cursor-default"
      >
        <span className="w-11 shrink-0 text-sm font-bold text-text-muted tabular-nums">
          {item.time}
        </span>
        <span className="min-w-0 flex-1 break-keep text-sm font-medium">
          {item.title}
        </span>
        <AdherenceStatusBadge status={item.status} />
        {hasDetail ? (
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-text-muted transition-transform ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden
          />
        ) : (
          <span className="w-4 shrink-0" aria-hidden />
        )}
      </button>

      {/* L2 — 접힘 상세 */}
      {open && hasDetail ? (
        <div className="flex flex-col gap-2 pb-3 pl-[3.375rem] pr-1">
          {item.summary.trim().length > 0 ? (
            <p className="break-keep text-sm leading-relaxed text-text-muted">
              {item.summary}
            </p>
          ) : null}
          {item.moodFlag || item.healthFlag ? (
            <div className="flex flex-wrap gap-1.5">
              {item.moodFlag ? (
                <span className="inline-flex items-center gap-1 rounded-base bg-surface px-2 py-1 text-xs font-medium text-text-muted">
                  <Heart className="h-3.5 w-3.5" aria-hidden strokeWidth={2} />
                  기분 관련 언급
                </span>
              ) : null}
              {item.healthFlag ? (
                <span className="inline-flex items-center gap-1 rounded-base bg-surface px-2 py-1 text-xs font-medium text-text-muted">
                  <Stethoscope className="h-3.5 w-3.5" aria-hidden strokeWidth={2} />
                  건강 관련 언급
                </span>
              ) : null}
            </div>
          ) : null}
          <Link
            href={hrefOf(item)}
            className="text-xs font-semibold text-primary underline underline-offset-2"
          >
            통화 내용 자세히 보기
          </Link>
        </div>
      ) : null}
    </li>
  );
}

export function DigestItems({ seniors }: { seniors: DigestSenior[] }) {
  if (seniors.length === 0) return null;
  const grouped = seniors.length > 1;

  return (
    <div className="flex flex-col gap-3">
      {seniors.map((s) => (
        <section
          key={s.seniorId}
          className="rounded-base border border-border bg-bg px-4 py-1.5 shadow-card"
          aria-label={grouped ? `${s.name}님 통화 목록` : "통화 목록"}
        >
          {grouped ? (
            <div className="flex items-center gap-2 border-b border-border py-2.5">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  SENIOR_DOT[s.colorIndex % SENIOR_DOT.length]
                }`}
                aria-hidden
              />
              <span className="break-keep text-sm font-semibold">{s.name}</span>
              {/* 문구 주의: 상태 라벨 "확인필요"(UNCERTAIN)와 겹치지 않는 표현을 쓴다 —
                  이 숫자는 불발·미이행까지 포함한 예외 건수이기 때문. 집계 로직은 그대로. */}
              {s.exceptionCount > 0 ? (
                <span className="text-xs font-semibold text-accent tabular-nums">
                  살펴볼 일 {s.exceptionCount}건
                </span>
              ) : null}
            </div>
          ) : null}
          <ul className="flex flex-col divide-y divide-border">
            {s.items.map((item) => (
              <ItemRow key={item.reportId} item={item} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
