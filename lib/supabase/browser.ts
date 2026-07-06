import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * 클라이언트 컴포넌트용 Supabase 클라이언트 (브라우저, RLS 적용).
 * 신형 publishable 키(sb_publishable_*)만 사용 — 브라우저 노출 안전.
 * secret 키는 절대 여기로 들어오지 않는다.
 */
let cached: SupabaseClient | null = null;

export function createBrowserSupabase(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL 환경변수가 없습니다.");
  if (!publishableKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 환경변수가 없습니다.");
  }

  cached = createBrowserClient(url, publishableKey);
  return cached;
}
