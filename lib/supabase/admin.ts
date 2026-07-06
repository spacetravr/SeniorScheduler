import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 서버 전용 Supabase 클라이언트.
 * 신형 키 체계: SUPABASE_SECRET_KEY (sb_secret_*, 구 service_role 대체)로
 * RLS를 우회해 서버 라우트에서만 write/read 한다.
 *
 * `server-only` import 로 클라이언트 번들 유입을 컴파일 타임에 차단한다.
 * (이 키가 브라우저로 새면 전 테이블 노출 → 절대 클라이언트에서 import 금지.)
 */

let cached: SupabaseClient | null = null;

export function getAdminClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL 환경변수가 없습니다.");
  }
  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY 환경변수가 없습니다.");
  }

  cached = createClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cached;
}
