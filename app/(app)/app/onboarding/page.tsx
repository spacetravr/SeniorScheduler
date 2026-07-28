/**
 * 온보딩 설문 (/app/onboarding) — 2스텝 5문항.
 * 대시보드(/app) 게이트가 미완료 사용자를 여기로 보낸다. 이 경로 자체에는 게이트가 없어
 * 무한 리다이렉트가 발생하지 않는다.
 * 조회 실패 시에도 빈 프로필로 화면을 띄운다(설문이 서비스 진입을 막지 않게).
 */
import { PageHeader } from "@/components/app/PageHeader";
import { OnboardingWizard } from "@/components/app/OnboardingWizard";
import {
  EMPTY_ONBOARDING_PROFILE,
  type OnboardingState,
} from "@/lib/contracts/onboarding";
import { getOnboardingState } from "@/lib/actions/onboarding";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  // getOnboardingState 는 throw 하지 않지만(항상 상태 반환), 방어적으로 감싼다.
  let state: OnboardingState | null = null;
  try {
    const gate = await getOnboardingState();
    state = gate.available ? gate : null;
  } catch {
    state = null;
  }

  const initial = state?.profile ?? EMPTY_ONBOARDING_PROFILE;
  const isEdit = Boolean(state?.onboarded_at);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-8">
      <PageHeader
        title={isEdit ? "설문 다시 작성" : "시작하기 전에"}
        subtitle="1분이면 끝나요. 답변은 언제든 설정에서 바꾸실 수 있어요."
      />
      <OnboardingWizard initial={initial} isEdit={isEdit} />
    </div>
  );
}
