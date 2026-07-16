import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { verifySessionToken } from "@/lib/telephony/clawops-adapter";
import { buildVoiceML, type VoiceMLStep, type VoiceMLTurn } from "@/lib/telephony/voiceml";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * /api/telephony/voiceml — ClawOps 통화 연결 시 재생할 VoiceML(TwiML 호환) 시나리오 라우트.
 *
 * ClawOps 는 발신이 연결되면 이 URL 을 호출하고(GET/POST 모두), Gather 응답(DTMF)도 action 으로
 * 이 URL 에 되돌린다. step 쿼리로 다단계(intro→answer)를 진행한다.
 *
 * 인증(가드레일 PII): 시나리오에 피보호자 이름/일정 문구 등 PII 가 포함되므로 쿼리 토큰
 * (HMAC(TELEPHONY_CALLBACK_SECRET, sessionId)) 검증 필수. 미인증 요청은 401.
 *
 * 대화 두뇌 위임 금지(가드레일 4): 분류·판정은 여기서 하지 않는다. DTMF 를 call_turns 에
 * SENIOR/DTMF 턴으로 저장만 하고, 실제 이행/동의 판정은 콜백 완료 시 lib/ai/classifier 가 한다.
 *
 * 시간대(CLAUDE.md): 턴 created_at 은 절대 instant(ISO). 표시 계층이 Asia/Seoul 로 렌더.
 * PII 미로깅: 전화번호·멘트 원문·Digits 를 로그로 남기지 않는다.
 */

type SessionRow = {
  id: string;
  purpose: "SCHEDULE" | "CONSENT";
  schedule_id: string | null;
  status: string;
};

/** 종결/오류 시 안전 종료 VoiceML(벤더 에러 방지). */
function hangupXml(message: string): NextResponse {
  const xml =
    `<?xml version="1.0" encoding="UTF-8"?><Response>` +
    `<Say language="ko-KR">${message}</Say><Hangup/></Response>`;
  return xmlResponse(xml);
}

function xmlResponse(xml: string, status = 200): NextResponse {
  return new NextResponse(xml, {
    status,
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
}

/**
 * Gather 응답(Digits + SpeechResult)을 POST 바디(form/json) 또는 쿼리에서 한 번에 추출.
 * 바디는 한 번만 소비 가능하므로 두 필드를 같이 읽는다(음성 우선 Gather → 둘 중 하나만 채워짐).
 */
async function readGatherInput(req: Request, url: URL): Promise<{ digits: string; speech: string }> {
  const pick = (source: { get(k: string): unknown }, keys: string[]): string => {
    for (const k of keys) {
      const v = source.get(k);
      if (typeof v === "string") return v.trim();
    }
    return "";
  };

  // 쿼리 우선(action URL 에 실려온 경우) — 없으면 바디.
  const qDigits = pick(url.searchParams, ["Digits", "digits"]);
  const qSpeech = pick(url.searchParams, ["SpeechResult", "speechResult", "speech"]);
  if (qDigits || qSpeech) return { digits: qDigits, speech: qSpeech };

  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("application/json")) {
      const body = (await req.json()) as Record<string, unknown>;
      const get = (k: string) => body[k];
      return {
        digits: pick({ get }, ["Digits", "digits"]),
        speech: pick({ get }, ["SpeechResult", "speechResult", "speech"]),
      };
    }
    if (ct.includes("form")) {
      const form = await req.formData();
      return {
        digits: pick(form, ["Digits", "digits"]),
        speech: pick(form, ["SpeechResult", "speechResult", "speech"]),
      };
    }
  } catch {
    /* 바디 파싱 실패 → 무입력 처리 */
  }
  return { digits: "", speech: "" };
}

async function handle(req: Request): Promise<NextResponse> {
  const secret = process.env.TELEPHONY_CALLBACK_SECRET;
  if (!secret) {
    console.error("[voiceml] TELEPHONY_CALLBACK_SECRET 미설정 — 비활성");
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("session") ?? "";
  const token = url.searchParams.get("token") ?? "";
  const step = (url.searchParams.get("step") ?? "intro") as VoiceMLStep;
  const reasked = url.searchParams.get("reask") === "1";

  if (!sessionId || !verifySessionToken(sessionId, token, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Gather 응답(Digits/SpeechResult)은 인증 후에만 파싱(무인증 바디 처리 방지).
  //   - answer: 일정 확인 응답(DTMF/음성).
  //   - mood/chat1/chat2: 직전 자유 발화 질문의 음성 답(SpeechResult). intro 는 입력 없음.
  const { digits, speech } =
    step === "intro" ? { digits: "", speech: "" } : await readGatherInput(req, url);

  const supabase = getAdminClient();
  const { data: sessionData, error: sErr } = await supabase
    .from("call_sessions")
    .select("id, purpose, schedule_id, status")
    .eq("id", sessionId)
    .maybeSingle();
  if (sErr) {
    console.error("[voiceml] getSession:", sErr.code, sErr.message);
    return hangupXml("잠시 후 다시 연락드릴게요.");
  }
  const session = sessionData as SessionRow | null;
  if (!session) {
    return hangupXml("연결에 문제가 있어요. 잠시 후 다시 연락드릴게요.");
  }
  // 이미 종결된 세션이면 안내 후 종료(중복 진입 방지).
  if (session.status === "COMPLETED" || session.status === "MISSED") {
    return hangupXml("이미 확인된 통화예요. 감사합니다.");
  }

  let scriptTemplate: string | undefined;
  if (session.purpose === "SCHEDULE" && session.schedule_id) {
    const { data: sched } = await supabase
      .from("schedules")
      .select("script_template")
      .eq("id", session.schedule_id)
      .maybeSingle();
    scriptTemplate = (sched?.script_template as string | undefined) ?? "일정";
  }

  const built = buildVoiceML({
    purpose: session.purpose,
    step,
    scriptTemplate,
    digits,
    speechResult: speech,
    reasked,
    nextAction: (params) => {
      const qs = new URLSearchParams({ session: sessionId, token, ...params });
      const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
      return `${site}/api/telephony/voiceml?${qs.toString()}`;
    },
  });

  await persistTurns(supabase, sessionId, built.turns);
  return xmlResponse(built.xml);
}

/** VoiceML 스텝에서 발생한 턴을 call_turns 에 저장(created_at 단조 증가). */
async function persistTurns(
  supabase: ReturnType<typeof getAdminClient>,
  sessionId: string,
  turns: readonly VoiceMLTurn[],
): Promise<void> {
  if (turns.length === 0) return;
  const base = Date.now();
  const rows = turns.map((t, i) => ({
    session_id: sessionId,
    role: t.role,
    input_kind: t.input_kind,
    text: t.text,
    // 같은 스텝 내 순서 보존 + 다음 스텝(다음 요청)보다 이르게 — ms 증분.
    created_at: new Date(base + i).toISOString(),
  }));
  const { error } = await supabase.from("call_turns").insert(rows);
  if (error) console.error("[voiceml] insertTurns:", error.code, error.message);
}

export async function POST(req: Request): Promise<NextResponse> {
  return handle(req);
}

export async function GET(req: Request): Promise<NextResponse> {
  return handle(req);
}
