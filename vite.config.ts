import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// base "./" — чтобы сборка работала на GitHub Pages из любой подпапки.
export default defineConfig({
  base: "./",
  plugins: [react()],
  // Основной чанк — React + motion (~170 КБ gzip); окна экспорта, данных и ИИ грузятся лениво.
  build: { chunkSizeWarningLimit: 600 },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
