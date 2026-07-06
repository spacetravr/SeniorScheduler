import { NextResponse } from "next/server";
import { ctaEventInputSchema } from "@/lib/contracts/cta";
import { getAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Postgres unique_violation
const UNIQUE_VIOLATION = "23505";

/**
 * POST /api/cta
 * body: CtaEventInput → 204 (성공 / VIEW 중복 무시) | 400 (검증 실패)
 * PII 없음. 로그에도 원문 저장 금지.
 */
export async function POST(req: Request) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const parsed = ctaEventInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { type, session_uuid, utm_source, utm_medium, utm_campaign } = parsed.data;

  const supabase = getAdminClient();
  const { error } = await supabase.from("cta_events").insert({
    type,
    session_uuid,
    utm_source: utm_source ?? null,
    utm_medium: utm_medium ?? null,
    utm_campaign: utm_campaign ?? null,
  });

  if (error) {
    // VIEW 세션당 1회 unique 위반 → 정상(중복 방문)으로 취급.
    if (error.code === UNIQUE_VIOLATION) {
      return new NextResponse(null, { status: 204 });
    }
    console.error("[cta] insert failed:", error.code, error.message);
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
