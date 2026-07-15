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
      },
      borderRadius: {
        base: "var(--radius-base)",
      },
      boxShadow: {
        card: "var(--shadow-card)",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
      },
    },
  },
  plugins: [],
};

export default config;
