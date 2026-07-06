import { NextResponse, type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/confirm — magic link 콜백. 두 가지 이메일 템플릿 형태를 모두 지원한다.
 *
 * (A) 기본 Magic Link 템플릿 `{{ .ConfirmationURL }}` → **?code=<auth_code>** (@supabase/ssr PKCE)
 *     Supabase `/auth/v1/verify` 가 토큰을 먼저 검증한 뒤 redirect_to(=emailRedirectTo,
 *     `/api/auth/confirm?next=/app`)로 `?code=` 를 붙여 리다이렉트한다.
 *     → exchangeCodeForSession(code) 로 세션 교환.
 *     2026년 6월 이후 신규 무료 티어는 기본 메일 제공자에서 이메일 템플릿을 수정할 수 없어
 *     이 경로가 실사용 기본값이다.
 *
 * (B) 커스텀 token_hash 템플릿 `?token_hash={{ .TokenHash }}&type=email` → verifyOtp
 *     자체 SMTP 연결 후 템플릿을 교체하면 사용 가능. 이중 지원으로 남겨둔다.
 *
 * 한계(PKCE): (A) 경로는 code_verifier 가 magic link 를 **발송받은 브라우저의 쿠키**에 있으므로,
 * 다른 브라우저/기기에서 링크를 열면 exchangeCodeForSession 이 실패한다(→ expired_link).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/app";
  // open-redirect 방지: 내부 경로만 허용.
  const next = nextParam.startsWith("/") ? nextParam : "/app";

  const url = request.nextUrl.clone();
  url.search = "";

  const supabase = createServerSupabase();

  // (A) 기본 ConfirmationURL 템플릿 경로: code 교환.
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      // PII 금지: 코드/메시지만.
      console.error("[auth] exchangeCodeForSession failed:", error.code, error.message);
      url.pathname = "/login";
      url.searchParams.set("error", "expired_link");
      return NextResponse.redirect(url);
    }
    url.pathname = next;
    return NextResponse.redirect(url);
  }

  // (B) 커스텀 token_hash 템플릿 경로: verifyOtp.
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) {
      console.error("[auth] verifyOtp failed:", error.code, error.message);
      url.pathname = "/login";
      url.searchParams.set("error", "expired_link");
      return NextResponse.redirect(url);
    }
    url.pathname = next;
    return NextResponse.redirect(url);
  }

  // 둘 다 없음: 잘못된 링크.
  url.pathname = "/login";
  url.searchParams.set("error", "invalid_link");
  return NextResponse.redirect(url);
}
