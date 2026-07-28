/**
 * 온보딩 전용 레이아웃 (/app/onboarding).
 *
 * 왜 별도 라우트 그룹인가: 앱 레이아웃((app)/layout.tsx)의 사이드바·탭바가 그대로 보이면
 * 사용자가 다른 탭으로 이동해 설문을 우회하게 된다(게이트는 /app 에만 있음).
 * 라우트 그룹만 바꾸면 **URL(/app/onboarding)과 미들웨어 인증 게이트는 그대로**이고
 * 다른 앱 화면의 레이아웃에는 아무 변화가 없다(회귀 위험 최소).
 *
 * 막다른 길 방지: 설문 안의 [건너뛰기]가 항상 노출되며 그 즉시 /app 으로 나간다.
 * 그래서 여기서는 브랜드 표기를 링크가 아닌 텍스트로 둔다(온보딩 미완료 상태로 /app 에
 * 들어가면 다시 이 화면으로 돌아오는 왕복을 만들지 않기 위해).
 */
export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-lg flex-col">
      <header className="flex items-center justify-center border-b border-border px-5 py-3">
        <span className="font-brand text-lg font-bold tracking-tight text-primary">
          Senior Scheduler
        </span>
      </header>
      <main className="flex-1 px-5 pb-16 pt-6">{children}</main>
    </div>
  );
}
