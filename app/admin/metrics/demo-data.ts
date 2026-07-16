import type { ChannelRow } from "./lib";

/**
 * /admin/metrics 데모 모드(?demo=1) 전용 샘플 데이터.
 * 실집계(lib.ts)와 무관한 프레젠테이션용 뷰모델. computeMetrics는 손대지 않는다.
 *
 * 그래프에 필요한 최소 필드만 담는다:
 *   - summary: 퍼널 3단계(방문 → 사전등록 클릭 → 이메일 제출)
 *   - channels: 채널별 방문/클릭/제출 + 1차/2차 그룹 구분
 *   - waitlist: 데모 전용 마스킹 대기자 목록(결정적 생성 — 서버 렌더 일관성)
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

// 채널별 방문/클릭/제출 — 제출자 기준 1차 60%(84) / 2차 40%(56), 총계 방문 630·클릭 243·제출 140.
const primaryChannels: ChannelDatum[] = [
  { source: "돌봄 카페", view: 96, clickTry: 44, submit: 24, group: "1차" },
  { source: "시니어 카페", view: 88, clickTry: 38, submit: 20, group: "1차" },
  { source: "노인 카페", view: 76, clickTry: 30, submit: 16, group: "1차" },
  { source: "부모 카페", view: 70, clickTry: 27, submit: 14, group: "1차" },
  { source: "리마인드 커뮤니티", view: 48, clickTry: 17, submit: 10, group: "1차" },
];

const secondaryChannels: ChannelDatum[] = [
  { source: "맘카페", view: 74, clickTry: 25, submit: 14, group: "2차" },
  { source: "지인 공유", view: 52, clickTry: 22, submit: 15, group: "2차" },
  { source: "교사 카페", view: 30, clickTry: 13, submit: 8, group: "2차" },
  { source: "골프 카페", view: 38, clickTry: 10, submit: 7, group: "2차" },
  { source: "테니스·배드민턴 카페", view: 34, clickTry: 10, submit: 7, group: "2차" },
  { source: "낚시·등산 카페", view: 24, clickTry: 7, submit: 5, group: "2차" },
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

// ── 데모 대기자 목록 (결정적 생성) ─────────────────────────────────────────────
/** 데모 대기자 1건(마스킹된 가상 이메일). */
export type DemoWaitlistItem = {
  maskedEmail: string; // 예: seon***@naver.com
  channel: string; // 유입 채널(위 채널별 제출 수와 정확히 일치)
  dateLabel: string; // "M월 D일"
};

// 로컬파트 앞머리 후보(2~4자, 일부 숫자 포함). Math.random 금지 — 인덱스 조합으로 결정적 생성.
const HEADS = [
  "seon", "minj", "jiho", "hyun", "yuna", "jun", "sora", "dae", "eunj", "hana",
  "mina", "jisu", "yeji", "taeh", "sung", "dong", "kim", "park", "lee", "choi",
  "hy2", "jw", "sk", "ns", "mom2", "dad3", "care", "silv", "jy", "hj",
  "sh", "yk", "dh", "gm", "na3", "ju7", "so2", "mj", "kkh", "ldh",
];

// 도메인은 한국 사용자 분포처럼 naver 비중을 높게(가중치 배열).
const DOMAINS = [
  "naver.com", "naver.com", "naver.com", "naver.com", "naver.com",
  "gmail.com", "gmail.com", "gmail.com",
  "daum.net", "daum.net",
  "hanmail.net", "kakao.com",
];

// 채널별 제출 수(= 위 channels의 submit과 정확히 일치, 합 140).
const CHANNEL_SUBMITS: [string, number][] = [
  ["돌봄 카페", 24],
  ["시니어 카페", 20],
  ["노인 카페", 16],
  ["부모 카페", 14],
  ["리마인드 커뮤니티", 10],
  ["맘카페", 14],
  ["지인 공유", 15],
  ["교사 카페", 8],
  ["골프 카페", 7],
  ["테니스·배드민턴 카페", 7],
  ["낚시·등산 카페", 5],
];

// 최근 14일(2026-07-03~07-16) 일별 등록 수 — 초반 적고 후반 많은 우상향. 합 140.
const DAY_COUNTS = [2, 3, 4, 5, 6, 7, 9, 11, 12, 13, 15, 16, 18, 19];
const START_DAY = 3; // 7월 3일부터

/**
 * 데모 대기자 140건을 결정적으로 생성(최신순).
 * - 이메일: HEADS/DOMAINS를 인덱스 기반으로 조합(서로소 stride로 고르게 분산).
 * - 채널: CHANNEL_SUBMITS를 그대로 펼친 뒤 서로소(47) 순열로 날짜 전반에 고르게 섞음 → 채널별 개수 정확히 보존.
 * - 날짜: DAY_COUNTS를 오래된→최신 순으로 펼침. 반환은 최신순(reverse).
 */
function buildDemoWaitlist(): DemoWaitlistItem[] {
  // 1) 채널 시퀀스(그룹 순서대로 펼침) — 총 140.
  const channelSeq: string[] = [];
  for (const [name, count] of CHANNEL_SUBMITS) {
    for (let i = 0; i < count; i++) channelSeq.push(name);
  }
  const total = channelSeq.length; // 140

  // 2) 날짜 라벨 시퀀스(오래된→최신) — 총 140.
  const dateSeq: string[] = [];
  DAY_COUNTS.forEach((count, dayIdx) => {
    const label = `7월 ${START_DAY + dayIdx}일`;
    for (let i = 0; i < count; i++) dateSeq.push(label);
  });

  // 3) 오래된→최신 순으로 조립. 채널은 서로소 순열로 섞어 날짜 전반에 분산.
  const asc: DemoWaitlistItem[] = [];
  for (let j = 0; j < total; j++) {
    const head = HEADS[(j * 17 + 5) % HEADS.length];
    const domain = DOMAINS[(j * 7 + 2) % DOMAINS.length];
    const channel = channelSeq[(j * 47) % total]; // gcd(47,140)=1 → 전단사, 개수 보존
    asc.push({
      maskedEmail: `${head}***@${domain}`,
      channel,
      dateLabel: dateSeq[j],
    });
  }

  // 최신순으로 반환(페이지는 앞에서부터 최근 N건 슬라이스).
  return asc.reverse();
}

/** 데모 모드에서 렌더할 마스킹 대기자 목록(최신순, 140건). */
export const demoWaitlist: DemoWaitlistItem[] = buildDemoWaitlist();
