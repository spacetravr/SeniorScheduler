"use client";

/**
 * 요약 보내기 — [메일로 보내기] / [카톡으로 공유] / [복사하기].
 *
 * 본문은 **항상 renderShareText(digest, url)** 로 만든다(직접 문자열 조립 금지 — 채널이
 * 늘어나도 문구는 한 곳에서만 바뀐다, docs/report-spec.md §2).
 * 카톡: navigator.share 우선 → 미지원이면 클립보드 복사 + 붙여넣기 안내(role=alert).
 *       카카오 SDK 등 외부 스크립트는 도입하지 않는다.
 * 클립보드 실패(비보안 컨텍스트·권한 거부) 시 수동 복사 안내로 폴백하는 기존 UX 유지.
 */
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Mail, MessageCircle, X } from "lucide-react";
import { renderShareText } from "@/lib/reports/digest";
import type { ReportDigest } from "@/lib/contracts/report-view";

type Notice = { kind: "info" | "error"; message: string } | null;

export function ShareDigestModal({
  digest,
  onClose,
}: {
  digest: ReportDigest;
  onClose: () => void;
}) {
  // 링크는 클라이언트에서만 확정 (SSR 하이드레이션 불일치 방지).
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    setUrl(`${window.location.origin}/app/reports`);
  }, []);

  const [copied, setCopied] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);

  const text = useMemo(() => renderShareText(digest, url), [digest, url]);

  const mailto = `mailto:?subject=${encodeURIComponent(
    `[Senior Scheduler] ${digest.period.label} 리포트 요약`,
  )}&body=${encodeURIComponent(text)}`;

  /** 클립보드 복사 시도 — 성공 여부만 돌려주고 안내는 호출부가 정한다. */
  async function copyToClipboard(): Promise<boolean> {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      return false;
    }
  }

  async function onCopy() {
    const ok = await copyToClipboard();
    if (ok) {
      setCopied(true);
      setNotice(null);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setCopied(false);
      setNotice({
        kind: "error",
        message:
          "복사에 실패했어요. 위 요약 내용을 길게 눌러(또는 드래그해) 직접 복사해 주세요.",
      });
    }
  }

  async function onShareKakao() {
    // Web Share API 가 있으면 OS 공유 시트로 — 카카오톡이 목록에 함께 뜬다.
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: `[Senior Scheduler] ${digest.period.label}`,
          text,
        });
        setNotice(null);
        return;
      } catch {
        // 사용자가 취소했거나 공유가 실패한 경우 → 복사 폴백으로 이어 간다.
      }
    }
    const ok = await copyToClipboard();
    setNotice(
      ok
        ? { kind: "info", message: "요약을 복사했어요. 카카오톡에 붙여넣어 보내세요." }
        : {
            kind: "error",
            message:
              "복사에 실패했어요. 위 요약 내용을 길게 눌러(또는 드래그해) 직접 복사해 주세요.",
          },
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-text/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="리포트 요약 보내기"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-base border border-border bg-bg p-5 shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <h3 className="break-keep text-base font-bold">리포트 요약 보내기</h3>
            <p className="break-keep text-xs text-text-muted">{digest.period.label}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-base p-1 text-text-muted transition-colors hover:bg-surface"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <pre
          className={`max-h-56 select-text overflow-auto whitespace-pre-wrap break-keep rounded-base p-4 text-sm leading-relaxed text-text [font-family:var(--font-sans)] [-webkit-user-select:text] ${
            notice?.kind === "error" ? "bg-primary-soft ring-2 ring-primary" : "bg-surface"
          }`}
        >
          {text}
        </pre>

        {notice ? (
          <p
            role="alert"
            className={`break-keep rounded-base px-3 py-2 text-sm leading-relaxed ${
              notice.kind === "error"
                ? "bg-accent/10 text-accent"
                : "bg-primary-soft text-primary"
            }`}
          >
            {notice.message}
          </p>
        ) : null}

        <div className="flex flex-col gap-2">
          <a
            href={mailto}
            className="inline-flex items-center justify-center gap-1.5 rounded-base bg-primary px-3 py-3 text-sm font-semibold text-bg transition-opacity hover:opacity-90"
          >
            <Mail className="h-4 w-4" aria-hidden />
            메일로 보내기
          </a>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onShareKakao}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-base border border-border bg-bg px-3 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary-soft"
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              카톡으로 공유
            </button>
            <button
              type="button"
              onClick={onCopy}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-base border border-border bg-bg px-3 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary-soft"
            >
              {copied ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Copy className="h-4 w-4" aria-hidden />
              )}
              {copied ? "복사됨" : "복사하기"}
            </button>
          </div>
        </div>

        <p className="break-keep text-xs leading-relaxed text-text-muted">
          공유 문구에는 통화 요약 전문이 담기지 않습니다. 자세한 내용은 로그인 후 리포트에서
          확인하실 수 있어요.
        </p>
      </div>
    </div>
  );
}
