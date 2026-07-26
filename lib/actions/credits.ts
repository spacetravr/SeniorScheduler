"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { getCreditBalance } from "@/lib/credits";
import type { CreditBalance } from "@/lib/contracts/credits";

/**
 * 크레딧 조회 Server Action — ui 레인의 CreditBadge/billing 이 사용.
 *
 * - 로그인 guardian(id = auth.uid()) 확인은 RLS 클라이언트(server.ts)로.
 * - 잔액 합산은 admin 원장 접근이 필요하므로 lib/credits(getCreditBalance)에 위임
 *   (원장은 서버 secret key 전용 write, SELECT 는 RLS — settings/seniors 액션과 동일 패턴).
 * - 미로그인/오류 시 balance 0 으로 강등(throw 금지) — 표시용 뱃지가 화면을 깨지 않게.
 */
export async function getMyCredits(): Promise<CreditBalance> {
  const supabase = createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { balance: 0 };

  const balance = await getCreditBalance(user.id);
  return { balance };
}
