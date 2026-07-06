import { NextResponse } from "next/server";
import { waitlistInputSchema } from "@/lib/contracts/cta";
import { getAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Postgres unique_violation
const UNIQUE_VIOLATION = "23505";

/**
 * POST /api/waitlist
 * body: WaitlistInput → 201 { ok: true } (이메일 중복도 성공 처리) | 400
 *
 * PII 주의: 이메일 원문을 로그에 남기지 않는다.
 * 흐름: waitlist insert(중복 허용) → cta_events WAITLIST_SUBMIT 기록.
 */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = waitlistInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { email, session_uuid, utm_source, utm_medium, utm_campaign } = parsed.data;
  const utm = {
    utm_source: utm_source ?? null,
    utm_medium: utm_medium ?? null,
    utm_campaign: utm_campaign ?? null,
  };

  const supabase = getAdminClient();

  const { error: waitlistError } = await supabase.from("waitlist").insert({
    email,
    session_uuid,
    ...utm,
  });

  if (waitlistError && waitlistError.code !== UNIQUE_VIOLATION) {
    // 이메일은 로그에 남기지 않는다.
    console.error("[waitlist] insert failed:", waitlistError.code, waitlistError.message);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  // 퍼널 집계용 이벤트. 실패해도 대기자 등록 자체는 성공 처리(로그만).
  const { error: eventError } = await supabase.from("cta_events").insert({
    type: "WAITLIST_SUBMIT",
    session_uuid,
    ...utm,
  });
  if (eventError) {
    console.error("[waitlist] cta event insert failed:", eventError.code, eventError.message);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
