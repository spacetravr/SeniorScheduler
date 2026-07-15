import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * vitest 설정 — tsconfig 의 "@/*" → 저장소 루트 alias 를 테스트에서도 해석하게 한다.
 * (기존 테스트는 상대경로만 썼지만, lib/calls·lib/ai 는 도메인 계약을 @/lib/contracts 로
 *  참조하므로 alias 가 필요하다. 새 npm 의존성 아님 — vitest 내장 config.)
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
    },
  },
});
