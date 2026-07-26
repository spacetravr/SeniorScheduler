/**
 * 이용약관 (`/terms`) — 베타 기준 표준 약관 초안.
 * 담백한 문서 스타일(max-w-prose, 조항 번호 h2/h3). 상단 베타 고지 + 시행일자·버전 표기.
 * 색·라운드·타이포는 토큰만 사용.
 */
import type { Metadata } from "next";
import { PageShell } from "@/components/marketing/PageShell";

const EFFECTIVE_DATE = "2026년 7월 26일";
const VERSION = "v0.9 (베타)";

export const metadata: Metadata = {
  title: "이용약관",
  description:
    "Senior Scheduler 베타 서비스 이용약관입니다. 서비스 정의, 무료 베타 운영, 이용자 의무, 책임 제한, 준거법을 안내합니다.",
  alternates: { canonical: "/terms" },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <PageShell>
      <article className="mx-auto w-full max-w-prose px-5 py-14 sm:px-8 sm:py-20">
        <header className="flex flex-col gap-4 border-b border-border pb-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            이용약관
          </h1>
          <div className="rounded-base bg-primary-soft px-4 py-3 text-sm leading-relaxed text-text-muted">
            본 약관은 베타 기간에 적용되는 약관이며, 정식 출시 시 변경될 수
            있습니다. 변경 시 서비스 내 공지 또는 이메일로 안내드립니다.
          </div>
          <p className="text-sm text-text-muted">
            시행일자: {EFFECTIVE_DATE} · 버전: {VERSION}
          </p>
        </header>

        <div className="mt-10 flex flex-col gap-10 leading-relaxed text-text-muted">
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-text">제1조 (목적)</h2>
            <p>
              본 약관은 Senior Scheduler(이하 &lsquo;서비스&rsquo;)가 제공하는
              부모님 등 피보호자 대상 일정 안내·안부 확인 전화 서비스의 이용과
              관련하여, 서비스와 이용자 간의 권리·의무 및 책임 사항을 규정하는
              것을 목적으로 합니다.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-text">제2조 (용어의 정의)</h2>
            <ol className="flex list-decimal flex-col gap-2 pl-5">
              <li>
                &lsquo;서비스&rsquo;란 보호자가 웹에서 등록한 일정에 따라
                피보호자의 일반 전화로 안내·확인 전화를 발신하고, 그 결과를
                리포트로 제공하는 일체의 기능을 말합니다.
              </li>
              <li>
                &lsquo;이용자&rsquo;(보호자)란 본 약관에 동의하고 서비스에
                가입하여 피보호자의 일정을 등록·관리하는 자를 말합니다.
              </li>
              <li>
                &lsquo;피보호자&rsquo;란 이용자가 등록하여 안내 전화를 받는
                대상(예: 부모님)을 말합니다.
              </li>
            </ol>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-text">
              제3조 (베타 서비스의 운영)
            </h2>
            <ol className="flex list-decimal flex-col gap-2 pl-5">
              <li>
                본 서비스는 정식 출시 전 베타 단계로 제공되며, 베타 기간 동안
                무료로 제공됩니다.
              </li>
              <li>
                서비스는 베타 기간 중 기능의 일부 또는 전부를 사전 고지 후
                변경·추가·중단할 수 있으며, 안정성 확보를 위해 서비스가 일시적으로
                제한될 수 있습니다.
              </li>
              <li>
                베타 서비스의 특성상 데이터의 정확성·연속성이 완전히 보장되지
                않을 수 있으며, 이용자는 이를 인지하고 서비스를 이용합니다.
              </li>
            </ol>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-text">제4조 (이용자의 의무)</h2>
            <ol className="flex list-decimal flex-col gap-2 pl-5">
              <li>
                이용자는 피보호자의 이름·전화번호 등 정보를 정확하게 입력해야
                하며, 잘못된 정보로 인해 발생하는 결과에 대한 책임은 이용자에게
                있습니다.
              </li>
              <li>
                이용자는 피보호자에게 전화가 발신되기 전, 피보호자 본인으로부터
                안내 전화 수신에 대한 동의를 확보할 책임이 있습니다. 서비스는 첫
                통화에서 본인 동의를 확인하며, 동의가 확인되기 전에는 안내 전화가
                발신되지 않습니다.
              </li>
              <li>
                이용자는 타인의 정보를 무단으로 등록하거나, 정당한 권한 없이
                제3자에게 반복적·수신 거부된 전화가 발신되도록 서비스를 이용해서는
                안 됩니다.
              </li>
            </ol>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-text">제5조 (금지사항)</h2>
            <p>이용자는 다음 각 호의 행위를 해서는 안 됩니다.</p>
            <ol className="flex list-decimal flex-col gap-2 pl-5">
              <li>동의 없이 제3자의 전화번호를 등록하는 행위</li>
              <li>
                서비스를 광고·홍보·스팸 등 안내·안부 확인 외의 목적으로
                이용하는 행위
              </li>
              <li>
                서비스의 정상적인 운영을 방해하거나, 자동화된 수단으로
                과도하게 발신을 유발하는 행위
              </li>
              <li>
                관계 법령(전기통신사업법, 정보통신망법 등)을 위반하는 행위
              </li>
            </ol>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-text">
              제6조 (서비스의 성격 및 책임의 제한)
            </h2>
            <ol className="flex list-decimal flex-col gap-2 pl-5">
              <li>
                본 서비스는 일정 안내와 안부 확인을 돕는 도구이며,{" "}
                <strong className="font-semibold text-text">
                  의료 서비스가 아닙니다.
                </strong>{" "}
                서비스는 진단·처방·치료 등 의료 행위나 의료 조언을 제공하지
                않으며, 건강에 관한 판단은 반드시 의료 전문가와 상의해야 합니다.
              </li>
              <li>
                본 서비스는 응급 상황을 감지하거나 긴급 구조를 대행하는 서비스가
                아닙니다. 응급 상황에는 119 등 공식 긴급 연락처를 이용해 주시기
                바랍니다.
              </li>
              <li>
                통화 연결은 통신 환경, 피보호자의 응답 여부 등에 따라 실패할 수
                있으며, 서비스는 통화의 연결·완료를 보증하지 않습니다.
              </li>
              <li>
                서비스는 베타 기간 중 무료로 제공되므로, 관련 법령이 허용하는
                범위에서 서비스 이용으로 발생한 손해에 대해 고의 또는 중대한 과실이
                없는 한 책임을 지지 않습니다.
              </li>
            </ol>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-text">
              제7조 (이용 계약의 해지)
            </h2>
            <p>
              이용자는 언제든지 일정별 전화 발신을 중단하거나 계정 삭제를
              요청하여 서비스 이용을 종료할 수 있습니다. 베타 기간에는 해지에 따른
              비용이나 위약금이 발생하지 않습니다.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-text">제8조 (준거법)</h2>
            <p>
              본 약관은 대한민국 법령에 따라 규율되고 해석되며, 서비스 이용과
              관련하여 발생한 분쟁에 대하여는 관계 법령에 따른 관할 법원을
              관할로 합니다.
            </p>
          </section>
        </div>
      </article>
    </PageShell>
  );
}
