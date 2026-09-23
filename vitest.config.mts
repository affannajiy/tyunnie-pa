// Pure-logic tests only — today the eight game engines. No DOM, no React:
// anything that needs a browser is verified in the preview, not here.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules", ".next"],
    environment: "node",
  },
  resolve: {
    alias: { "@": import.meta.dirname },
  },
});
