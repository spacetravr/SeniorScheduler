/**
 * 앱 리포트 화면처럼 보이는 예시 카드 (정적 목업).
 * variant 2종 — "done"(복약 완료) / "uncertain"(확인 필요).
 * "확인 필요"는 억지로 판정하지 않는 우리 원칙(CLAUDE.md)을 그대로 보여주기 위한 예시이며,
 * 실제 구현된 동작(애매하면 1회 재질문 → 그래도 불확실하면 UNCERTAIN)만 표현한다.
 * 색·라운드는 토큰만 사용, 아이콘은 lucide-react(이모지 금지).
 */
import {
  Smile,
  HeartPulse,
  CircleHelp,
  type LucideIcon,
} from "lucide-react";

export type ReportPreviewVariant = "done" | "uncertain";

type PreviewData = {
  datetime: string;
  title: string;
  statusLabel: string;
  /** 상태 칩 톤 — 완료는 primary, 확인 필요는 accent. */
  statusTone: "primary" | "accent";
  summary: string;
  moodIcon: LucideIcon;
  moodLabel: string;
  healthIcon: LucideIcon;
  healthLabel: string;
  turns: { speaker: string; text: string; side: "agent" | "senior" }[];
};

const PREVIEWS: Record<ReportPreviewVariant, PreviewData> = {
  done: {
    datetime: "7월 12일 (일) · 오전 9:00",
    title: "어머님 안부 전화",
    statusLabel: "복약 완료",
    statusTone: "primary",
    summary:
      "오전 9시에 통화했어요. 혈압약을 방금 챙겨 드셨다고 하셨고, 오늘은 경로당에 다녀오실 예정이라고 하셨어요.",
    moodIcon: Smile,
    moodLabel: "좋음",
    healthIcon: HeartPulse,
    healthLabel: "특이사항 없음",
    turns: [
      {
        speaker: "안내",
        text: "어머님, 오늘 아침 혈압약은 드셨어요?",
        side: "agent",
      },
      {
        speaker: "어머님",
        text: "응, 방금 물이랑 같이 먹었어.",
        side: "senior",
      },
    ],
  },
  uncertain: {
    datetime: "7월 13일 (월) · 오전 9:00",
    title: "어머님 안부 전화",
    statusLabel: "확인 필요",
    statusTone: "accent",
    summary:
      "여쭤봤지만 확실한 답을 듣지 못했어요. 확인이 필요해요. 한 번 더 여쭤봤는데도 분명한 답이 없어 임의로 판단하지 않았습니다.",
    moodIcon: CircleHelp,
    moodLabel: "확인되지 않음",
    healthIcon: CircleHelp,
    healthLabel: "확인되지 않음",
    turns: [
      {
        speaker: "안내",
        text: "어머님, 오늘 아침 혈압약은 드셨어요?",
        side: "agent",
      },
      {
        speaker: "어머님",
        text: "어… 그건 좀 이따가 보자.",
        side: "senior",
      },
      {
        speaker: "안내",
        text: "혹시 약은 드셨을까요? 드셨으면 1번을 눌러 주세요.",
        side: "agent",
      },
      { speaker: "어머님", text: "응, 알았어요.", side: "senior" },
    ],
  },
};

function statusToneClass(tone: PreviewData["statusTone"]): string {
  return tone === "primary" ? "bg-primary text-bg" : "bg-accent text-bg";
}

export function ReportPreviewCard({
  variant = "done",
}: {
  variant?: ReportPreviewVariant;
}) {
  const data = PREVIEWS[variant];

  return (
    <div className="overflow-hidden rounded-base border border-border bg-bg shadow-card">
      {/* 상단 헤더: 날짜·시간 + 상태 칩 */}
      <div className="flex items-center justify-between gap-3 border-b border-border p-5">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-text-muted">{data.datetime}</span>
          <span className="font-bold">{data.title}</span>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-base px-2.5 py-1 text-xs font-semibold leading-none ${statusToneClass(
            data.statusTone,
          )}`}
        >
          {data.statusLabel}
        </span>
      </div>

      {/* 통화 요약 */}
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-2 rounded-base bg-surface p-4">
          <span className="text-xs font-semibold text-primary">통화 요약</span>
          <p className="text-sm leading-relaxed text-text">{data.summary}</p>
        </div>

        {/* 기분 / 건강 표시 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 rounded-base bg-surface p-3">
            <data.moodIcon className="h-5 w-5 shrink-0 text-primary" aria-hidden />
            <div className="flex flex-col">
              <span className="text-xs text-text-muted">기분</span>
              <span className="text-sm font-semibold">{data.moodLabel}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-base bg-surface p-3">
            <data.healthIcon
              className="h-5 w-5 shrink-0 text-primary"
              aria-hidden
            />
            <div className="flex flex-col">
              <span className="text-xs text-text-muted">건강</span>
              <span className="text-sm font-semibold">{data.healthLabel}</span>
            </div>
          </div>
        </div>

        {/* 대화 전사 스니펫 */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-text-muted">
            대화 내용 · 그대로 읽어 보실 수 있어요
          </span>
          <div className="flex flex-col gap-3 rounded-base bg-surface p-4">
            {data.turns.map((turn, i) => (
              <div
                key={`${turn.speaker}-${i}`}
                className={`flex flex-col gap-1 ${
                  turn.side === "senior" ? "items-end" : ""
                }`}
              >
                <span className="text-xs font-semibold text-text-muted">
                  {turn.speaker}
                </span>
                <p
                  className={`w-fit rounded-base px-3 py-2 text-sm leading-relaxed ${
                    turn.side === "senior"
                      ? "bg-primary text-bg"
                      : "bg-bg text-text"
                  }`}
                >
                  {turn.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 예시 라벨 */}
      <div className="border-t border-border px-5 py-3">
        <span className="text-xs text-text-muted">예시 화면입니다</span>
      </div>
    </div>
  );
}
