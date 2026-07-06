import { NextResponse, type NextRequest } from "next/server";
import { type EmailOtpType } from "@supabase/supabase-js";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/auth/confirm — magic link 콜백.
 * Supabase 이메일 템플릿이 token_hash + type 을 붙여 이 경로로 보낸다:
 *   /api/auth/confirm?token_hash={{ .TokenHash }}&type=email&next=/app
 * verifyOtp 로 검증 후 세션 쿠키를 심고 next(기본 /app)로 redirect.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/app";
  // open-redirect 방지: 내부 경로만 허용.
  const next = nextParam.startsWith("/") ? nextParam : "/app";

  if (!tokenHash || !type) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("error", "invalid_link");
    return NextResponse.redirect(url);
  }

  const supabase = createServerSupabase();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });

  const url = request.nextUrl.clone();
  url.search = "";
  if (error) {
    console.error("[auth] verifyOtp failed:", error.message);
    url.pathname = "/login";
    url.searchParams.set("error", "expired_link");
    return NextResponse.redirect(url);
  }

  url.pathname = next;
  return NextResponse.redirect(url);
}
