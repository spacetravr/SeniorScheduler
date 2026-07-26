/**
 * 크레딧·결제 (/app/billing) — 실결제 연동 없음(베타).
 * - 잔여 크레딧 카드(getMyCredits() 실데이터, 실패 시 "-"로 강등)
 * - 무료(ARS 안내) / 유료(양방향 AI 대화, 준비 중) 플랜 안내 2열
 * - 크레딧 충전 품목 3종 (가격은 설문 측정 중 → 숫자 하드코딩 금지, "출시 시 공개")
 * - 결제 버튼은 클릭 시 안내만. 하단 베타 무료 고지.
 * 색·라운드·shadow는 토큰만 사용 (하드코딩 금지).
 */
import { Coins, Phone, MessagesSquare, Check } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { ChargeButton } from "@/components/app/ChargeButton";
import { getMyCredits } from "@/lib/actions/credits";

// TODO: credits 상품 테이블 연동 전 mock. 가격은 설문으로 측정 중 → 표기 보류.
const CHARGE_ITEMS = [
  { amount: 100, note: "가볍게 시작" },
  { amount: 300, note: "가장 많이 선택", highlight: true },
  { amount: 1000, note: "넉넉하게" },
] as const;

export default async function BillingPage() {
  // 잔여 크레딧 실데이터. 조회 실패 시 null → "-"로 안전 강등(크래시 금지).
  let credits: number | null = null;
  try {
    credits = (await getMyCredits()).balance;
  } catch {
    credits = null;
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="크레딧·결제" subtitle="통화에 사용할 크레딧을 관리합니다." />

      {/* 잔여 크레딧 */}
      <section
        aria-label="잔여 크레딧"
        className="flex items-center gap-4 rounded-base border border-border bg-bg p-5 shadow-card"
      >
        <span
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary"
          aria-hidden
        >
          <Coins className="h-7 w-7" strokeWidth={1.75} />
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm text-text-muted">잔여 크레딧</span>
          <span className="text-3xl font-bold text-primary tabular-nums">
            {credits == null ? "-" : credits.toLocaleString("ko-KR")}
            <span className="ml-1 text-base font-semibold text-text-muted">
              크레딧
            </span>
          </span>
          <p className="break-keep text-xs leading-relaxed text-text-muted">
            통화 1건이 완료될 때마다 1크레딧이 사용됩니다. 베타 기간에는 잔액과
            무관하게 무료로 이용하실 수 있어요.
          </p>
        </div>
      </section>

      {/* 플랜 안내 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">통화 방식</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {/* 무료 — ARS 안내 전화 */}
          <div className="flex flex-col gap-3 rounded-base border border-primary bg-primary-soft p-5">
            <div className="flex items-center gap-2">
              <Phone className="h-5 w-5 shrink-0 text-primary" aria-hidden strokeWidth={2} />
              <span className="font-semibold text-primary">ARS 안내 전화</span>
              <span className="ml-auto inline-flex items-center rounded-base bg-primary px-2 py-0.5 text-xs font-semibold leading-none text-bg">
                이용 중
              </span>
            </div>
            <p className="break-keep text-sm leading-relaxed text-text-muted">
              예약한 시간에 안내 멘트를 들려드리고, 버튼·간단한 음성으로 응답을
              확인합니다. 크레딧이 들지 않아요.
            </p>
            <p className="break-keep text-sm font-semibold text-primary">무료</p>
          </div>

          {/* 유료 — 양방향 AI 대화 (준비 중) */}
          <div className="flex flex-col gap-3 rounded-base border border-border bg-bg p-5 shadow-card">
            <div className="flex items-center gap-2">
              <MessagesSquare
                className="h-5 w-5 shrink-0 text-text-muted"
                aria-hidden
                strokeWidth={2}
              />
              <span className="font-semibold">양방향 AI 대화 통화</span>
              <span className="ml-auto inline-flex items-center rounded-base border border-text-muted px-2 py-0.5 text-xs font-semibold leading-none text-text-muted">
                준비 중
              </span>
            </div>
            <p className="break-keep text-sm leading-relaxed text-text-muted">
              부모님과 자연스럽게 주고받는 대화형 통화입니다. 통화마다 크레딧이
              차감돼요. 아직 준비 중이며 출시되면 안내드릴게요.
            </p>
            <p className="break-keep text-sm font-semibold text-text-muted">
              크레딧 차감 (출시 예정)
            </p>
          </div>
        </div>
      </section>

      {/* 크레딧 충전 */}
      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">크레딧 충전</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {CHARGE_ITEMS.map((item) => (
            <div
              key={item.amount}
              className={`flex flex-col gap-3 rounded-base border bg-bg p-5 shadow-card ${
                "highlight" in item && item.highlight
                  ? "border-primary"
                  : "border-border"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-2xl font-bold text-primary tabular-nums">
                  {item.amount.toLocaleString("ko-KR")}
                </span>
                {"highlight" in item && item.highlight ? (
                  <span className="inline-flex items-center rounded-base bg-primary px-2 py-0.5 text-xs font-semibold leading-none text-bg">
                    인기
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">크레딧</span>
                <span className="break-keep text-xs text-text-muted">{item.note}</span>
              </div>
              {/* 가격은 설문으로 측정 중 → 숫자 표기 보류 */}
              <span className="break-keep text-sm font-semibold text-text-muted">
                가격 출시 시 공개
              </span>
              <ChargeButton />
            </div>
          ))}
        </div>
      </section>

      {/* 하단 고지 — 베타 무료 안내 */}
      <div className="flex items-start gap-2 rounded-base bg-surface p-4">
        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden strokeWidth={2.5} />
        <p className="break-keep text-sm leading-relaxed text-text-muted">
          베타 기간에는 모든 기능을 무료로 이용하실 수 있어요. 결제는 정식 출시와
          함께 열릴 예정이며, 미리 안내드릴게요.
        </p>
      </div>
    </div>
  );
}
