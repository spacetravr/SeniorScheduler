/**
 * ReportDigest → 알림톡 템플릿 변수 맵 + 버튼 (스텁).
 *
 * 알림톡은 자유 문구가 아니라 **사전 심사된 템플릿 + 변수 치환**이다. 그래서 렌더러의 산출물은
 * HTML 이 아니라 `#{변수명} → 값` 맵이다. 템플릿 문구가 심사에서 바뀌어도 이 파일의 변수 이름만
 * 맞추면 되고, 집계는 buildDigest 한 곳에서만 일어난다(채널 = 렌더러만 추가).
 *
 * 심사 제출용 템플릿 초안 (변수는 #{} 표기):
 *   [시니어 스케줄러] #{기간}
 *   #{헤드라인}
 *   #{요약}
 *   #{항목}
 *   ※ 본 알림은 의료적 판단이 아닌 통화 요약입니다. 위급 시 119.
 *   버튼1: 리포트 보기(WL) / 버튼2: 전화 걸기(AL·tel:)
 *
 * 주의: 알림톡 본문에 통화 전사·요약 원문을 싣지 않는다(재전달이 쉬워 확산 통제가 불가 —
 * report-spec §2 공유 텍스트 규칙과 동일한 이유). 예외 항목의 시각·제목·상태까지만.
 */
import type { ReportDigest } from "@/lib/contracts/report-view";

export type AlimtalkButton = {
  name: string;
  /** WL = 웹링크, AL = 앱/기타 스킴(tel:) */
  type: "WL" | "AL";
  url: string;
};

export type RenderedAlimtalk = {
  templateVars: Record<string, string>;
  buttons: AlimtalkButton[];
};

export type AlimtalkRenderLinks = {
  /** 리포트 딥링크 (로그인 게이트 뒤) */
  reportUrl: string;
  /** 피보호자에게 바로 거는 번호(E.164 또는 국내 표기). 없으면 전화 버튼을 넣지 않는다. */
  seniorPhone?: string | null;
};

/** 예외 항목 우선 한 줄 목록 (최대 maxLines 줄, 초과분은 "외 N건"). */
export function renderItemLines(digest: ReportDigest, maxLines = 3): string {
  const rows: string[] = [];
  for (const senior of digest.seniors) {
    for (const item of senior.items) {
      if (!item.isException) continue;
      rows.push(`${senior.name} ${item.time} ${item.title} - ${item.statusLabel}`);
    }
  }
  if (rows.length === 0) {
    const normal = digest.stats.total;
    return normal > 0 ? `통화 ${normal}건 모두 정상 확인` : "안내 전화 없음";
  }
  const head = rows.slice(0, maxLines);
  if (rows.length > maxLines) head.push(`외 ${rows.length - maxLines}건`);
  return head.join("\n");
}

/** 알림톡 렌더 — 템플릿 변수 + 버튼 2개(리포트 보기 / 전화 걸기). */
export function renderReportAlimtalk(
  digest: ReportDigest,
  links: AlimtalkRenderLinks,
): RenderedAlimtalk {
  const templateVars: Record<string, string> = {
    기간: digest.period.label,
    헤드라인: digest.headline,
    요약: digest.subline || "-",
    항목: renderItemLines(digest),
    이상건수: String(digest.stats.exception),
  };

  const buttons: AlimtalkButton[] = [{ name: "리포트 보기", type: "WL", url: links.reportUrl }];
  if (links.seniorPhone) {
    // 확인이 필요할 때 바로 통화로 이어지게 — ALERT 의 원버튼 원칙(report-spec §1).
    buttons.push({ name: "전화 걸기", type: "AL", url: `tel:${links.seniorPhone.replace(/[^0-9+]/g, "")}` });
  }

  return { templateVars, buttons };
}
