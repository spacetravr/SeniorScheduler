/**
 * 피보호자 (/app/seniors) — 실데이터 목록 + 등록/수정/삭제/동의 (server actions 결합).
 */
import { PageHeader } from "@/components/app/PageHeader";
import { SeniorForm } from "@/components/app/SeniorForm";
import { SeniorItem } from "@/components/app/SeniorItem";
import { EmptyState } from "@/components/app/EmptyState";
import { getSeniors } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function SeniorsPage() {
  const seniors = await getSeniors();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="피보호자"
        subtitle="부모님을 등록하고 동의 상태를 관리합니다."
      />

      {seniors.length === 0 ? (
        <EmptyState
          icon="👵"
          title="아직 등록된 피보호자가 없어요"
          description="부모님을 먼저 등록하고 통화 동의를 완료하면, 안내 전화 일정을 만들 수 있어요."
        />
      ) : (
        <section className="flex flex-col gap-2">
          {seniors.map((s) => (
            <SeniorItem key={s.id} senior={s} />
          ))}
        </section>
      )}

      <SeniorForm mode="create" />
    </div>
  );
}
