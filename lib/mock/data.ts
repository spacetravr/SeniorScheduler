/**
 * Phase 1 mock 데이터 — lib/contracts/domain.ts 타입만 사용 (직접 타입 정의 금지).
 * Phase 2에서 실데이터로 교체된다. fetch/API 호출 없이 이 모듈만 import해 렌더한다.
 * 날짜는 KST(+09:00) ISO 문자열이며, 화면 표시는 문자열 슬라이싱만으로 포맷한다(Date 연산 금지).
 */
import type {
  Senior,
  Schedule,
  CallSession,
  CallTurn,
  CallReport,
} from "@/lib/contracts/domain";

const GUARDIAN_ID = "11111111-1111-4111-8111-111111111111";

// ── 피보호자 2명 (한 명은 동의 완료, 한 명은 동의 대기) ──
export const seniors: Senior[] = [
  {
    id: "a0000000-0000-4000-8000-000000000001",
    name: "김순자",
    phone: "010-1234-5678",
    relationship: "모",
    birth_year: 1948,
    consent_at: "2026-06-20T10:00:00+09:00",
    consent_by: GUARDIAN_ID,
    created_at: "2026-06-20T09:58:00+09:00",
  },
  {
    id: "a0000000-0000-4000-8000-000000000002",
    name: "박영수",
    phone: "010-8765-4321",
    relationship: "부",
    birth_year: 1945,
    consent_at: null,
    consent_by: null,
    created_at: "2026-07-01T14:30:00+09:00",
  },
];

// ── 일정 4~5개 ──
export const schedules: Schedule[] = [
  {
    id: "b0000000-0000-4000-8000-000000000001",
    senior_id: seniors[0].id,
    type: "MEDICATION",
    title: "아침 혈압약",
    script_template: "어머니, 아침 혈압약 드실 시간이에요. 챙겨 드셨나요?",
    call_time: "09:00",
    rrule: "FREQ=DAILY",
    active: true,
    created_at: "2026-06-20T10:05:00+09:00",
  },
  {
    id: "b0000000-0000-4000-8000-000000000002",
    senior_id: seniors[0].id,
    type: "MEDICATION",
    title: "저녁 당뇨약",
    script_template: "어머니, 저녁 당뇨약 드실 시간이에요. 잊지 말고 챙겨 드세요.",
    call_time: "19:00",
    rrule: "FREQ=DAILY",
    active: true,
    created_at: "2026-06-20T10:07:00+09:00",
  },
  {
    id: "b0000000-0000-4000-8000-000000000003",
    senior_id: seniors[0].id,
    type: "HOSPITAL",
    title: "정형외과 진료",
    script_template: "어머니, 오늘 오후 정형외과 진료 예약이 있어요. 준비되셨나요?",
    call_time: "13:00",
    rrule: "FREQ=WEEKLY;BYDAY=TU",
    active: false,
    created_at: "2026-06-25T11:00:00+09:00",
  },
  {
    id: "b0000000-0000-4000-8000-000000000004",
    senior_id: seniors[1].id,
    type: "MEAL",
    title: "점심 식사 안부",
    script_template: "아버지, 점심 식사 잘 챙기셨어요? 식사 거르지 마세요.",
    call_time: "12:00",
    rrule: "FREQ=WEEKLY;BYDAY=MO,WE,FR",
    active: false,
    created_at: "2026-07-01T14:35:00+09:00",
  },
  {
    id: "b0000000-0000-4000-8000-000000000005",
    senior_id: seniors[1].id,
    type: "ETC",
    title: "주말 안부 전화",
    script_template: "아버지, 주말 잘 보내고 계세요? 별일 없으신지 안부 여쭤요.",
    call_time: "10:00",
    rrule: "FREQ=WEEKLY;BYDAY=SA,SU",
    active: false,
    created_at: "2026-07-01T14:40:00+09:00",
  },
];

// ── 통화 세션 10건 (상태 골고루) ──
export const callSessions: CallSession[] = [
  // 오늘 예정
  {
    id: "c0000000-0000-4000-8000-000000000001",
    schedule_id: schedules[1].id,
    senior_id: seniors[0].id,
    status: "SCHEDULED",
    attempt: 1,
    scheduled_at: "2026-07-06T19:00:00+09:00",
    started_at: null,
    ended_at: null,
    cost_krw: null,
  },
  // 오늘 통화 완료
  {
    id: "c0000000-0000-4000-8000-000000000002",
    schedule_id: schedules[0].id,
    senior_id: seniors[0].id,
    status: "COMPLETED",
    attempt: 1,
    scheduled_at: "2026-07-06T09:00:00+09:00",
    started_at: "2026-07-06T09:00:12+09:00",
    ended_at: "2026-07-06T09:01:38+09:00",
    cost_krw: 62.5,
  },
  // 어제 완료 (미이행 리포트)
  {
    id: "c0000000-0000-4000-8000-000000000003",
    schedule_id: schedules[1].id,
    senior_id: seniors[0].id,
    status: "COMPLETED",
    attempt: 1,
    scheduled_at: "2026-07-05T19:00:00+09:00",
    started_at: "2026-07-05T19:00:08+09:00",
    ended_at: "2026-07-05T19:01:20+09:00",
    cost_krw: 58.0,
  },
  // 어제 완료 (연기 리포트)
  {
    id: "c0000000-0000-4000-8000-000000000004",
    schedule_id: schedules[0].id,
    senior_id: seniors[0].id,
    status: "COMPLETED",
    attempt: 1,
    scheduled_at: "2026-07-05T09:00:00+09:00",
    started_at: "2026-07-05T09:00:05+09:00",
    ended_at: "2026-07-05T09:01:02+09:00",
    cost_krw: 55.5,
  },
  // 그제 완료 (확인필요 리포트)
  {
    id: "c0000000-0000-4000-8000-000000000005",
    schedule_id: schedules[0].id,
    senior_id: seniors[0].id,
    status: "COMPLETED",
    attempt: 1,
    scheduled_at: "2026-07-04T09:00:00+09:00",
    started_at: "2026-07-04T09:00:10+09:00",
    ended_at: "2026-07-04T09:00:52+09:00",
    cost_krw: 51.0,
  },
  // 재시도 끝에 불발
  {
    id: "c0000000-0000-4000-8000-000000000006",
    schedule_id: schedules[1].id,
    senior_id: seniors[0].id,
    status: "MISSED",
    attempt: 3,
    scheduled_at: "2026-07-04T19:00:00+09:00",
    started_at: null,
    ended_at: "2026-07-04T19:11:30+09:00",
    cost_krw: 0,
  },
  // 발신 중 (진행 상태 예시)
  {
    id: "c0000000-0000-4000-8000-000000000007",
    schedule_id: schedules[3].id,
    senior_id: seniors[1].id,
    status: "DIALING",
    attempt: 1,
    scheduled_at: "2026-07-06T12:00:00+09:00",
    started_at: null,
    ended_at: null,
    cost_krw: null,
  },
  // 통화 중
  {
    id: "c0000000-0000-4000-8000-000000000008",
    schedule_id: schedules[4].id,
    senior_id: seniors[1].id,
    status: "IN_PROGRESS",
    attempt: 1,
    scheduled_at: "2026-07-06T10:00:00+09:00",
    started_at: "2026-07-06T10:00:15+09:00",
    ended_at: null,
    cost_krw: null,
  },
  // 완료 (완료 리포트)
  {
    id: "c0000000-0000-4000-8000-000000000009",
    schedule_id: schedules[0].id,
    senior_id: seniors[0].id,
    status: "COMPLETED",
    attempt: 2,
    scheduled_at: "2026-07-03T09:00:00+09:00",
    started_at: "2026-07-03T09:01:20+09:00",
    ended_at: "2026-07-03T09:02:40+09:00",
    cost_krw: 64.0,
  },
  // 오늘 예정
  {
    id: "c0000000-0000-4000-8000-000000000010",
    schedule_id: schedules[0].id,
    senior_id: seniors[1].id,
    status: "SCHEDULED",
    attempt: 1,
    scheduled_at: "2026-07-06T15:00:00+09:00",
    started_at: null,
    ended_at: null,
    cost_krw: null,
  },
];

// ── 통화 턴 (전사) — 완료 세션 몇 건에 부여 ──
export const callTurns: CallTurn[] = [
  // 세션 002 — 완료(복약 완료)
  {
    id: "d0000000-0000-4000-8000-000000000001",
    session_id: callSessions[1].id,
    role: "SYSTEM",
    text: "안녕하세요 어머니, 자녀분이 예약한 안부 전화예요. 이 통화는 안내를 위해 녹음·정리됩니다. 아침 혈압약 드실 시간이에요. 약 챙겨 드셨나요?",
    created_at: "2026-07-06T09:00:18+09:00",
  },
  {
    id: "d0000000-0000-4000-8000-000000000002",
    session_id: callSessions[1].id,
    role: "SENIOR",
    text: "응 방금 먹었어. 물이랑 같이 잘 먹었지.",
    created_at: "2026-07-06T09:00:31+09:00",
  },
  {
    id: "d0000000-0000-4000-8000-000000000003",
    session_id: callSessions[1].id,
    role: "SYSTEM",
    text: "잘하셨어요. 오늘 기분은 어떠세요?",
    created_at: "2026-07-06T09:00:45+09:00",
  },
  {
    id: "d0000000-0000-4000-8000-000000000004",
    session_id: callSessions[1].id,
    role: "SENIOR",
    text: "기분 좋아. 날씨도 맑고 산책도 다녀왔어.",
    created_at: "2026-07-06T09:01:02+09:00",
  },
  {
    id: "d0000000-0000-4000-8000-000000000005",
    session_id: callSessions[1].id,
    role: "SYSTEM",
    text: "다행이에요. 오늘도 건강히 보내세요. 전화 받아주셔서 고맙습니다.",
    created_at: "2026-07-06T09:01:30+09:00",
  },
  // 세션 003 — 미이행
  {
    id: "d0000000-0000-4000-8000-000000000006",
    session_id: callSessions[2].id,
    role: "SYSTEM",
    text: "어머니, 저녁 당뇨약 드실 시간이에요. 챙겨 드셨나요?",
    created_at: "2026-07-05T19:00:14+09:00",
  },
  {
    id: "d0000000-0000-4000-8000-000000000007",
    session_id: callSessions[2].id,
    role: "SENIOR",
    text: "아직 안 먹었어. 저녁을 아직 안 먹어서 이따 먹으려고.",
    created_at: "2026-07-05T19:00:29+09:00",
  },
  {
    id: "d0000000-0000-4000-8000-000000000008",
    session_id: callSessions[2].id,
    role: "SYSTEM",
    text: "네, 식사 후에 꼭 챙겨 드세요. 오늘 기분은 어떠세요?",
    created_at: "2026-07-05T19:00:48+09:00",
  },
  {
    id: "d0000000-0000-4000-8000-000000000009",
    session_id: callSessions[2].id,
    role: "SENIOR",
    text: "그냥 그래. 좀 피곤하네.",
    created_at: "2026-07-05T19:01:05+09:00",
  },
  // 세션 005 — 확인필요
  {
    id: "d0000000-0000-4000-8000-000000000010",
    session_id: callSessions[4].id,
    role: "SYSTEM",
    text: "어머니, 아침 혈압약 드셨나요?",
    created_at: "2026-07-04T09:00:16+09:00",
  },
  {
    id: "d0000000-0000-4000-8000-000000000011",
    session_id: callSessions[4].id,
    role: "SENIOR",
    text: "어... 그거 뭐라고? 잘 안 들려.",
    created_at: "2026-07-04T09:00:30+09:00",
  },
  {
    id: "d0000000-0000-4000-8000-000000000012",
    session_id: callSessions[4].id,
    role: "SYSTEM",
    text: "혈압약 드셨는지 여쭤봤어요. 드셨으면 1번, 아직이면 2번을 눌러주세요.",
    created_at: "2026-07-04T09:00:44+09:00",
  },
  {
    id: "d0000000-0000-4000-8000-000000000013",
    session_id: callSessions[4].id,
    role: "SENIOR",
    text: "(응답 불명확)",
    created_at: "2026-07-04T09:00:52+09:00",
  },
];

// ── 통화 리포트 (adherence 5종 골고루, UNCERTAIN 포함) ──
export const callReports: CallReport[] = [
  {
    id: "e0000000-0000-4000-8000-000000000001",
    session_id: callSessions[1].id, // 완료
    adherence_status: "DONE",
    summary:
      "아침 혈압약을 물과 함께 잘 챙겨 드셨습니다. 기분이 좋고 산책도 다녀오셨다고 하셨어요. 특이사항 없이 밝은 목소리였습니다.",
    mood_flag: false,
    health_flag: false,
    prompt_version: "v1",
    created_at: "2026-07-06T09:02:00+09:00",
  },
  {
    id: "e0000000-0000-4000-8000-000000000002",
    session_id: callSessions[2].id, // 미이행
    adherence_status: "NOT_DONE",
    summary:
      "저녁 당뇨약을 아직 드시지 않았습니다. 저녁 식사 전이라 식사 후에 드시겠다고 하셨어요. 다소 피곤하다고 말씀하셨습니다.",
    mood_flag: true,
    health_flag: false,
    prompt_version: "v1",
    created_at: "2026-07-05T19:02:00+09:00",
  },
  {
    id: "e0000000-0000-4000-8000-000000000003",
    session_id: callSessions[3].id, // 연기
    adherence_status: "POSTPONED",
    summary:
      "지금 외출 중이라 약을 챙기지 못했고, 귀가 후 바로 드시겠다고 하셨습니다. 목소리는 밝고 별다른 이상은 없어 보였습니다.",
    mood_flag: false,
    health_flag: false,
    prompt_version: "v1",
    created_at: "2026-07-05T09:02:00+09:00",
  },
  {
    id: "e0000000-0000-4000-8000-000000000004",
    session_id: callSessions[4].id, // 확인필요
    adherence_status: "UNCERTAIN",
    summary:
      "질문을 잘 못 들으셔서 복약 여부를 명확히 확인하지 못했습니다. 재질문에도 응답이 불분명했습니다. 직접 확인이 필요합니다.",
    mood_flag: false,
    health_flag: true,
    prompt_version: "v1",
    created_at: "2026-07-04T09:02:00+09:00",
  },
  {
    id: "e0000000-0000-4000-8000-000000000005",
    session_id: callSessions[5].id, // 불발
    adherence_status: "MISSED",
    summary:
      "3회 발신했으나 모두 전화를 받지 않으셨습니다. 통화가 이루어지지 않아 복약 여부를 확인하지 못했습니다.",
    mood_flag: false,
    health_flag: false,
    prompt_version: "v1",
    created_at: "2026-07-04T19:12:00+09:00",
  },
  {
    id: "e0000000-0000-4000-8000-000000000006",
    session_id: callSessions[8].id, // 완료
    adherence_status: "DONE",
    summary:
      "혈압약을 잘 드셨다고 확인해 주셨습니다. 손주 이야기를 하며 즐거워하셨고 컨디션도 좋다고 하셨어요.",
    mood_flag: false,
    health_flag: false,
    prompt_version: "v1",
    created_at: "2026-07-03T09:03:00+09:00",
  },
];

// ── 조회 헬퍼 ──
export function seniorById(id: string): Senior | undefined {
  return seniors.find((s) => s.id === id);
}
export function scheduleById(id: string): Schedule | undefined {
  return schedules.find((s) => s.id === id);
}
export function sessionById(id: string): CallSession | undefined {
  return callSessions.find((s) => s.id === id);
}
export function turnsBySession(id: string): CallTurn[] {
  return callTurns.filter((t) => t.session_id === id);
}
export function reportBySession(id: string): CallReport | undefined {
  return callReports.find((r) => r.session_id === id);
}

// ── 대시보드용 mock 요약(표시 전용, Date 연산 없이 고정값) ──
export const TODAY_LABEL = "2026년 7월 6일 (일)";

/** 오늘 일정 인스턴스(표시 전용) — call_time 순 정렬된 세션 id 묶음 */
export const todaySessionIds = [
  callSessions[7].id, // 10:00 통화 중
  callSessions[6].id, // 12:00 발신 중
  callSessions[9].id, // 15:00 예정
  callSessions[0].id, // 19:00 예정
  callSessions[1].id, // 09:00 완료
];

/** 주간 이행률(표시 전용 mock) */
export const weeklyAdherence = {
  done: 5,
  total: 7,
  ratePercent: 71,
  byDay: [
    { label: "월", done: true },
    { label: "화", done: true },
    { label: "수", done: false },
    { label: "목", done: true },
    { label: "금", done: true },
    { label: "토", done: true },
    { label: "일", done: false },
  ],
};
