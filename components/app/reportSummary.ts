/**
 * 재수출 심(shim) — 순수 로직은 lib/reports/summary.ts 로 이관됨(2026-07-26 data-email).
 * 서버(주간 리포트 cron)와 UI 가 동일 로직을 재사용하기 위한 이동. UI import 경로 무파손 유지.
 */
export * from "@/lib/reports/summary";
