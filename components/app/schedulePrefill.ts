/**
 * 온보딩 답변 → 일정 등록 폼 기본값(프리필) 매핑 — 순수 함수.
 *
 * 원칙:
 *  - 매핑 소스는 **lib/contracts/onboarding.ts** 단일 소스(callSlotDefaultTime)만 참조한다.
 *  - 억지 매핑 금지: 걱정거리는 복약/식사처럼 일정 유형과 1:1로 대응되는 경우에만 반영하고,
 *    외로움·인지·기타는 기존 기본값을 그대로 둔다.
 *  - 신규 등록에만 쓰인다(수정 폼은 저장된 값이 언제나 우선).
 *  - 여기서 만드는 시각은 계약에 고정된 "HH:mm"(KST) 문자열이라 런타임 시간 계산이 없다.
 */
import { scheduleTypeLabel } from "@/lib/contracts/domain";
import {
  callSlotDefaultTime,
  type OnboardingProfile,
} from "@/lib/contracts/onboarding";

/** 온보딩 이전부터 쓰던 폼 기본값 (온보딩 값이 없으면 이 값 유지). */
export const DEFAULT_CALL_TIME = "09:00";
export const DEFAULT_SCHEDULE_TYPE = "MEDICATION";

/** 걱정거리 → 일정 유형. 대응이 분명한 두 가지만 매핑한다(나머지는 null = 기본값 유지). */
const CONCERN_TO_TYPE: Partial<Record<
  NonNullable<OnboardingProfile["primary_concern"]>,
  string
>> = {
  MEDICATION: "MEDICATION",
  MEAL: "MEAL",
};

export type SchedulePrefill = {
  /** 발신 시각 기본값 "HH:mm" (KST) */
  callTime: string;
  /** 유형 복수 선택의 초기 선택값 */
  types: string[];
  /** 프리필이 실제로 적용됐을 때만 보여줄 안내 1줄. 없으면 null(힌트 숨김). */
  hint: string | null;
};

export const NO_PREFILL: SchedulePrefill = {
  callTime: DEFAULT_CALL_TIME,
  types: [DEFAULT_SCHEDULE_TYPE],
  hint: null,
};

/**
 * 온보딩 프로필로 폼 기본값을 만든다.
 * 프로필이 없거나(건너뛰기·조회 실패) 해당 문항이 비어 있으면 기존 기본값과 동일한 값을 돌려주고,
 * hint 는 실제 반영된 항목이 있을 때만 생성한다.
 */
export function buildSchedulePrefill(
  profile: OnboardingProfile | null | undefined,
): SchedulePrefill {
  if (!profile) return NO_PREFILL;

  const slot = profile.preferred_call_slot;
  const callTime = slot ? callSlotDefaultTime[slot] : DEFAULT_CALL_TIME;

  const concern = profile.primary_concern;
  const mappedType = concern ? (CONCERN_TO_TYPE[concern] ?? null) : null;
  const types = [mappedType ?? DEFAULT_SCHEDULE_TYPE];

  const parts: string[] = [];
  if (slot) parts.push(`발신 시각 ${callTime}`);
  if (mappedType) {
    const label = scheduleTypeLabel[mappedType as keyof typeof scheduleTypeLabel];
    if (label) parts.push(`유형 ${label}`);
  }

  return {
    callTime,
    types,
    hint: parts.length
      ? `처음에 답해 주신 내용으로 ${parts.join(" · ")}을(를) 미리 채워 뒀어요. 바꾸셔도 괜찮습니다.`
      : null,
  };
}
