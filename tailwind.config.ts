import type { Config } from "tailwindcss";

/**
 * 디자인 토큰 단일 소스는 app/globals.css의 :root CSS 변수 (CLAUDE.md 참조).
 * 여기서는 변수를 참조만 한다 — 하드코딩 금지. 확정 토큰이 오면 globals.css만 교체.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)",
        "primary-soft": "var(--color-primary-soft)",
        accent: "var(--color-accent)",
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        border: "var(--color-border)",
        text: "var(--color-text)",
        "text-muted": "var(--color-text-muted)",
        "senior-1": "var(--color-senior-1)",
        "senior-2": "var(--color-senior-2)",
        "senior-3": "var(--color-senior-3)",
      },
      borderRadius: {
        base: "var(--radius-base)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        /* 브랜드 워드마크 전용 (뾰족한 각진 타이포) — 본문엔 사용 금지. */
        brand: ["var(--font-brand)"],
      },
    },
  },
  plugins: [],
};

export default config;
