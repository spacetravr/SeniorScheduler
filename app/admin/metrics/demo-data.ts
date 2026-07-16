import type { ChannelRow } from "./lib";

/**
 * /admin/metrics 데모 모드(?demo=1) 전용 샘플 데이터.
 * 실집계(lib.ts)와 무관한 프레젠테이션용 뷰모델. computeMetrics는 손대지 않는다.
 *
 * 그래프에 필요한 최소 필드만 담는다:
 *   - summary: 퍼널 3단계(방문 → 사전등록 클릭 → 이메일 제출)
 *   - channels: 채널별 방문/클릭/제출 + 1차/2차 그룹 구분
 */

export type ChannelGroup = "1차" | "2차";

/** 그룹 라벨을 붙인 채널 행(데모/실데이터 공용 뷰모델). */
export type ChannelDatum = ChannelRow & { group?: ChannelGroup };

/** 그래프 렌더에 필요한 최소 뷰모델. 실데이터·데모 모두 이 형태로 정규화해 전달. */
export type MetricsView = {
  summary: {
    visitors: number; // 방문(고유 방문자)
    clickTry: number; // 사전등록 클릭
    waitlist: number; // 이메일 제출
  };
  channels: ChannelDatum[];
};

/** 그룹 소제목·설명(채널 차트에서 그룹 구분용). */
export const GROUP_META: Record<ChannelGroup, { title: string; desc: string }> = {
  "1차": { title: "1차 · 돌봄·시니어 계열", desc: "부모 돌봄·시니어 관심 커뮤니티" },
  "2차": { title: "2차 · 일반 커뮤니티", desc: "취미·지인 등 일반 유입" },
};

const primaryChannels: ChannelDatum[] = [
  { source: "돌봄 카페", view: 96, clickTry: 46, submit: 28, group: "1차" },
  { source: "시니어 카페", view: 88, clickTry: 40, submit: 25, group: "1차" },
  { source: "노인 카페", view: 76, clickTry: 32, submit: 19, group: "1차" },
  { source: "부모 카페", view: 70, clickTry: 28, submit: 16, group: "1차" },
  { source: "리마인드 커뮤니티", view: 48, clickTry: 19, submit: 11, group: "1차" },
];

const secondaryChannels: ChannelDatum[] = [
  { source: "맘카페", view: 74, clickTry: 22, submit: 11, group: "2차" },
  { source: "지인 공유", view: 52, clickTry: 20, submit: 13, group: "2차" },
  { source: "교사 카페", view: 30, clickTry: 12, submit: 6, group: "2차" },
  { source: "골프 카페", view: 38, clickTry: 9, submit: 4, group: "2차" },
  { source: "테니스·배드민턴 카페", view: 34, clickTry: 8, submit: 4, group: "2차" },
  { source: "낚시·등산 카페", view: 24, clickTry: 7, submit: 3, group: "2차" },
];

/** 데모 모드에서 렌더할 샘플 지표. */
export const demoMetrics: MetricsView = {
  summary: {
    visitors: 630,
    clickTry: 243,
    waitlist: 140,
  },
  channels: [...primaryChannels, ...secondaryChannels].sort(
    (a, b) => b.view - a.view,
  ),
};
