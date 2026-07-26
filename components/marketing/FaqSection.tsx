"use client";

/**
 * 랜딩 FAQ 아코디언 — 접힘/펼침 클라이언트 토글. 모바일 우선.
 * 문답은 faqData.FAQ_ITEMS 단일 소스 참조(JSON-LD와 동기화). 색·라운드는 토큰만 사용.
 */
import { useState } from "react";
import { FAQ_ITEMS } from "./faqData";

export function FaqSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <section className="mx-auto w-full max-w-3xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="flex flex-col items-center gap-4 text-center">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
          자주 묻는 질문
        </h2>
        <p className="max-w-xl text-lg leading-relaxed text-text-muted">
          처음이라 궁금하고 걱정되시는 점들을 모았어요.
        </p>
      </div>

      <ul className="mt-12 flex flex-col gap-3">
        {FAQ_ITEMS.map((item, i) => {
          const isOpen = openIndex === i;
          const panelId = `faq-panel-${i}`;
          const buttonId = `faq-button-${i}`;
          return (
            <li
              key={item.question}
              className="overflow-hidden rounded-base border border-border bg-bg shadow-card"
            >
              <h3>
                <button
                  type="button"
                  id={buttonId}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpenIndex(isOpen ? null : i)}
                  className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left transition-colors hover:bg-primary-soft/50 sm:px-6"
                >
                  <span className="text-lg font-semibold leading-snug">
                    {item.question}
                  </span>
                  <span
                    aria-hidden
                    className={`mt-1 shrink-0 text-xl leading-none text-primary transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  >
                    ⌄
                  </span>
                </button>
              </h3>
              {isOpen && (
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  className="px-5 pb-5 sm:px-6"
                >
                  <p className="leading-relaxed text-text-muted">
                    {item.answer}
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
