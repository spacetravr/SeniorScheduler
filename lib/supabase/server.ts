import "server-only";
import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * 서버 컴포넌트 / Server Action / Route Handler 용 Supabase 클라이언트 (RLS 적용).
 *
 * 신형 키 체계: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (sb_publishable_*, 구 anon 대체).
 * 사용자 세션 쿠키를 읽어 auth.uid() 컨텍스트로 동작하므로 RLS 정책이 그대로 적용된다.
 * (RLS 우회가 필요한 서버 전용 write 는 lib/supabase/admin.ts 를 쓴다 — 여기서는 절대 사용 X)
 *
 * 주의: Server Component 에서 호출하면 쿠키 set 이 무시될 수 있어 try/catch 로 흡수한다.
 * 세션 갱신(refresh) 은 middleware.ts 에서 수행한다.
 */
export function createServerSupabase(): SupabaseClient {
  const cookieStore = cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL 환경변수가 없습니다.");
  if (!publishableKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 환경변수가 없습니다.");
  }

  return createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Component 렌더 중 호출 — middleware 가 세션을 갱신하므로 무시 가능.
        }
      },
    },
  });
}
