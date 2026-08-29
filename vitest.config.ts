import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    // テストは src と並べず test/ にまとめる。src 側の構成をそのまま写した階層にする
    include: ["test/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    env: { DATABASE_URL: "file:./prisma/test.db" },
    fileParallelism: false,
  },
});
