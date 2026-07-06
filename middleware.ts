import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * 미들웨어: (1) Supabase 세션 쿠키 갱신, (2) /app/* 경로 인증 가드.
 *
 * - 미인증 사용자가 /app/* 에 접근하면 /login?next=... 로 redirect.
 *   (로그인 페이지 UI 는 ui-builder 담당 — 여기서는 redirect 대상만 지정)
 * - /login 등 공개 경로는 통과. auth 콜백(/api/auth/*)도 통과.
 *
 * @supabase/ssr 공식 패턴: getUser() 로 세션을 검증하며 갱신 쿠키를 response 에 실어 보낸다.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  // 환경변수 미설정 시 가드를 건너뛴다(빌드/프리뷰 안전장치). 실배포엔 항상 존재.
  if (!url || !publishableKey) return response;

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected = path === "/app" || path.startsWith("/app/");

  if (isProtected && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // 정적 자원·이미지 등을 제외한 앱 경로에서만 세션을 갱신·검사한다.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
