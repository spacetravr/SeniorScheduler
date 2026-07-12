/**
 * 랜딩/사전등록 폼용 순수 검증 헬퍼.
 * lib/contracts/cta.ts의 waitlistInputSchema(email 서버 검증)와 별개로,
 * 제출 전 클라이언트 UX용 가벼운 형식 체크만 담당한다.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 공백 트리밍 후 기본 이메일 형식을 만족하면 true. */
export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}
