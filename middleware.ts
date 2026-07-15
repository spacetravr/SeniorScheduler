import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { decideTokenAction } from "@/lib/auth/token";
import { getCachedJwks } from "@/lib/auth/jwks";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * 미들웨어: /app/* 경로의 인증 게이트 + 세션 쿠키 갱신.
 *
 * 성능 배경: 예전 구현은 거의 전 경로에서 매 요청 `getUser()` 로 시드니 인증서버를
 * 원격 호출(~0.3s)해 TTFB 를 크게 늘렸다. 이제:
 *   1) matcher 를 `/app/*` 로 축소 — 랜딩(/)·/preregister·/login·공개 API 는 미들웨어를 아예 안 탄다.
 *      (auth 콜백 /api/auth/confirm 은 route handler 가 exchangeCodeForSession 으로 자체 쿠키
 *       처리 → 미들웨어 불필요.)
 *   2) /app/* 에서도 매 요청 원격 getUser 대신 **로컬 JWT 서명검증**(getClaims + 캐시된 JWKS,
 *      ES256/비대칭키)으로 통과시킨다. 원격 호출은 만료 임박(<5분)·만료 시에만.
 *
 * 세션 갱신 유지(중요): getSession() 은 쿠키를 로컬 읽되 만료 마진(auth-js 90s) 안이면
 *   자동으로 refresh_token 으로 갱신하고 setAll 로 새 쿠키를 응답에 싣는다. 추가로 잔여 수명
 *   5분 이하면 우리가 명시적으로 원격 경로(getUser)로 폴백해 검증·갱신을 보장한다 →
 *   1시간마다 로그아웃되는 일이 없다.
 *
 * 보안 경계: 로컬 서명검증은 위조 토큰을 걸러낸다. 설령 미들웨어 검증을 통과하더라도
 *   실제 데이터 접근은 RLS(auth.uid())로 격리되므로, 미들웨어는 UX 게이트 역할이고
 *   최종 보안 경계는 DB RLS 다.
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

  const path = request.nextUrl.pathname;

  // getSession: 쿠키 로컬 읽기(원격 호출 아님). 단, 만료 마진(90s) 내면 자동 refresh 후
  // setAll 로 새 쿠키를 response 에 싣는다 → 이 경로만으로도 기본 세션 갱신이 유지된다.
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const action = decideTokenAction(
    { hasSession: !!session, accessToken: session?.access_token },
    Date.now(),
  );

  let authenticated = false;

  if (action === "verify-local") {
    // 로컬 서명검증: 캐시된 JWKS 를 주입해 네트워크 없이 ES256 서명을 검증한다.
    const keys = await getCachedJwks();
    if (keys) {
      // 캐시된 JWKS 주입 → fetchJwk 이 네트워크 없이 로컬 검증(ES256).
      // (JWK 정확 타입은 auth-js 전이 의존 → 옵션 객체를 파라미터 타입으로 1회 캐스트)
      const opts = { jwks: { keys } } as Parameters<typeof supabase.auth.getClaims>[1];
      const { data, error } = await supabase.auth.getClaims(session!.access_token, opts);
      authenticated = !error && !!data?.claims;
    } else {
      // JWKS 확보 실패 → 로컬검증 불가 → 원격 폴백.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      authenticated = !!user;
    }
  } else if (action === "remote-refresh") {
    // 만료 임박/만료/판독불가: 기존 원격 경로. getUser 는 검증하며 만료 마진 내면 갱신·쿠키 반영.
    const {
      data: { user },
    } = await supabase.auth.getUser();
    authenticated = !!user;
  }
  // action === "no-session" → authenticated 는 false 유지.

  if (!authenticated) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", path);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  // /app 및 그 하위 경로에서만 동작. 랜딩·로그인·공개 API·정적자원은 미들웨어를 타지 않는다.
  matcher: ["/app", "/app/:path*"],
};
