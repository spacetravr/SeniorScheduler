/**
 * 앱 리포트 화면처럼 보이는 예시 카드 (정적 목업).
 * 랜딩·서비스 소개 페이지에서 공용으로 재사용한다. 색·라운드는 토큰만 사용.
 */
export function ReportPreviewCard() {
  return (
    <div className="overflow-hidden rounded-base border border-border bg-bg shadow-card">
      {/* 상단 헤더: 날짜·시간 + 상태 칩 */}
      <div className="flex items-center justify-between gap-3 border-b border-border p-5">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-text-muted">
            7월 12일 (일) · 오전 9:00
          </span>
          <span className="font-bold">어머님 안부 전화</span>
        </div>
        <span className="inline-flex shrink-0 items-center rounded-base bg-primary px-2.5 py-1 text-xs font-semibold leading-none text-bg">
          복약 완료
        </span>
      </div>

      {/* 통화 요약 */}
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-col gap-2 rounded-base bg-surface p-4">
          <span className="text-xs font-semibold text-primary">통화 요약</span>
          <p className="text-sm leading-relaxed text-text">
            오전 9시에 통화했어요. 혈압약을 방금 챙겨 드셨다고 하셨고, 오늘은
            경로당에 다녀오실 예정이라고 하셨어요.
          </p>
        </div>

        {/* 기분 / 건강 표시 */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 rounded-base bg-surface p-3">
            <span className="text-lg" aria-hidden>
              🙂
            </span>
            <div className="flex flex-col">
              <span className="text-xs text-text-muted">기분</span>
              <span className="text-sm font-semibold">좋음</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-base bg-surface p-3">
            <span className="text-lg" aria-hidden>
              💗
            </span>
            <div className="flex flex-col">
              <span className="text-xs text-text-muted">건강</span>
              <span className="text-sm font-semibold">특이사항 없음</span>
            </div>
          </div>
        </div>

        {/* 대화 전사 스니펫 */}
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-text-muted">
            대화 내용 · 그대로 읽어 보실 수 있어요
          </span>
          <div className="flex flex-col gap-3 rounded-base bg-surface p-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-text-muted">안내</span>
              <p className="w-fit rounded-base bg-bg px-3 py-2 text-sm leading-relaxed text-text">
                어머님, 오늘 아침 혈압약은 드셨어요?
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-xs font-semibold text-text-muted">
                어머님
              </span>
              <p className="w-fit rounded-base bg-primary px-3 py-2 text-sm leading-relaxed text-bg">
                응, 방금 물이랑 같이 먹었어.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 예시 라벨 */}
      <div className="border-t border-border px-5 py-3">
        <span className="text-xs text-text-muted">예시 화면입니다</span>
      </div>
    </div>
  );
}
