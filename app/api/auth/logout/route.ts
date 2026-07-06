import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/auth/logout — 세션 종료 후 /login 으로 redirect.
 * (form action 으로도 호출 가능하도록 route handler 로 제공. server action signOut() 도 병행 존재.)
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabase();
  await supabase.auth.signOut();

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url, { status: 303 });
}
