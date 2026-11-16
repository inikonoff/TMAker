import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// base "./" — чтобы сборка работала на GitHub Pages из любой подпапки.
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
