/**
 * 가격 티저 상수 — 단일 소스. UI는 이 파일만 import (하드코딩 금지).
 * 잠정값 (오케스트레이터 결정, 2026-07-06) — 확정 시 이 파일만 수정.
 */
export const PRICING = {
  /** 베타 기간 요금 */
  betaLabel: "베타 기간 무료",
  /** 정식 출시 예상가 (KRW/월) */
  plannedMonthlyKrw: 9_900,
  plannedLabel: "정식 출시 예상가 월 9,900원",
  /** 기준 안내 문구 */
  basis: "매일 1회 안부·복약 전화 기준",
  /** 베타 신청 혜택 훅 */
  betaHook: "지금 베타를 신청하면 정식 출시 후 첫 달 무료",
} as const;
