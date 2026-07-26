/**
 * 개인정보처리방침 (`/privacy`) — 베타 기준 초안.
 * 담백한 문서 스타일(max-w-prose, 조항 번호 h2). 상단 베타 고지 + 시행일자·버전 표기.
 * 색·라운드·타이포는 토큰만 사용.
 */
import type { Metadata } from "next";
import { PageShell } from "@/components/marketing/PageShell";

const EFFECTIVE_DATE = "2026년 7월 26일";
const VERSION = "v0.9 (베타)";
const CONTACT_EMAIL = "spacetr17@khu.ac.kr";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description:
    "Senior Scheduler 베타 서비스의 개인정보처리방침입니다. 수집 항목, 이용 목적, 보관·파기, 처리 위탁, 이용자 권리, 문의처를 안내합니다.",
  alternates: { canonical: "/privacy" },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <PageShell>
      <article className="mx-auto w-full max-w-prose px-5 py-14 sm:px-8 sm:py-20">
        <header className="flex flex-col gap-4 border-b border-border pb-8">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            개인정보처리방침
          </h1>
          <div className="rounded-base bg-primary-soft px-4 py-3 text-sm leading-relaxed text-text-muted">
            본 방침은 베타 기간에 적용되며, 정식 출시 시 변경될 수 있습니다.
            변경 시 서비스 내 공지 또는 이메일로 안내드립니다.
          </div>
          <p className="text-sm text-text-muted">
            시행일자: {EFFECTIVE_DATE} · 버전: {VERSION}
          </p>
        </header>

        <div className="mt-10 flex flex-col gap-10 leading-relaxed text-text-muted">
          <section className="flex flex-col gap-3">
            <p>
              Senior Scheduler(이하 &lsquo;서비스&rsquo;)는 이용자의 개인정보를
              중요하게 생각하며, 관계 법령을 준수합니다. 본 방침은 서비스가 어떤
              정보를 어떤 목적으로 수집·이용하고, 어떻게 보관·파기하는지를
              안내합니다.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-text">
              제1조 (수집하는 개인정보 항목)
            </h2>
            <p>서비스는 다음의 정보를 수집합니다.</p>
            <ol className="flex list-decimal flex-col gap-2 pl-5">
              <li>
                <strong className="font-semibold text-text">보호자 정보</strong>{" "}
                — 로그인용 이메일 주소
              </li>
              <li>
                <strong className="font-semibold text-text">
                  피보호자 정보
                </strong>{" "}
                — 이름, 전화번호, 등록한 일정 정보, 안내 전화의 통화 전사(텍스트)
                및 요약·응답 결과
              </li>
              <li>
                <strong className="font-semibold text-text">
                  이용·유입 정보
                </strong>{" "}
                — 사전등록·버튼 클릭 등 CTA 이벤트, 유입 경로(utm) 정보, 서비스
                이용 과정에서 생성되는 기본 로그
              </li>
            </ol>
            <p>
              통화의 음성 원본(녹음 파일)은 저장하지 않으며, 통화 내용은 텍스트
              전사·요약 형태로만 처리·보관합니다.
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-text">
              제2조 (개인정보의 이용 목적)
            </h2>
            <ol className="flex list-decimal flex-col gap-2 pl-5">
              <li>
                등록된 일정에 따른 안내·안부 확인 전화의 발신 및 결과 리포트 제공
              </li>
              <li>피보호자 본인 동의 확인 및 발신 가부 판단</li>
              <li>서비스 운영·개선, 오류 대응 및 이용 문의 응대</li>
              <li>
                정식 출시 안내 등 사전등록해 주신 분들께 드리는 소식 전달
              </li>
            </ol>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-text">
              제3조 (개인정보의 보관 및 파기)
            </h2>
            <ol className="flex list-decimal flex-col gap-2 pl-5">
              <li>
                서비스는 이용 목적이 달성되거나 이용자가 삭제를 요청하는 경우,
                관계 법령에 따라 보존이 필요한 경우를 제외하고 지체 없이 해당
                정보를 파기합니다.
              </li>
              <li>
                통화 음성 원본은 저장하지 않으며, 전사·요약 데이터는 서비스 제공
                목적 범위에서 보관 후 파기합니다.
              </li>
              <li>
                전자적 파일 형태의 정보는 복구가 불가능한 방법으로 삭제합니다.
              </li>
            </ol>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-text">
              제4조 (개인정보 처리의 위탁)
            </h2>
            <p>
              서비스는 원활한 제공을 위해 아래와 같이 개인정보 처리를 외부에
              위탁할 수 있으며, 위탁 시 관련 법령에 따라 안전하게 관리되도록
              합니다.
            </p>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>Supabase — 데이터베이스 및 인증 관리</li>
              <li>Vercel — 서비스 호스팅 및 운영 인프라</li>
              <li>전화 발신 사업자 — 안내 전화 발신 및 통화 처리</li>
              <li>이메일 발송 사업자 — 로그인 링크 및 소식 안내 메일 발송</li>
            </ul>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-text">
              제5조 (이용자 및 피보호자의 권리)
            </h2>
            <ol className="flex list-decimal flex-col gap-2 pl-5">
              <li>
                이용자는 언제든지 자신 및 등록한 피보호자의 개인정보에 대한
                열람·정정·삭제를 요청할 수 있습니다.
              </li>
              <li>
                삭제·열람 요청은 로그인에 사용하신 이메일로 아래 문의처에
                요청하시면, 본인 확인 후 처리해 드립니다.
              </li>
              <li>
                이용자는 언제든지 일정별 전화 발신을 중단하여 이후의 정보 수집을
                멈출 수 있습니다.
              </li>
            </ol>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-text">제6조 (문의처)</h2>
            <p>
              개인정보 처리에 관한 문의·요청은 아래로 연락해 주시기 바랍니다.
            </p>
            <p>
              이메일:{" "}
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="font-semibold text-primary underline underline-offset-2"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
          </section>
        </div>
      </article>
    </PageShell>
  );
}
