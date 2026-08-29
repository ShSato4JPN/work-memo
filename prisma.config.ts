import { existsSync } from "node:fs";
import { defineConfig, env } from "prisma/config";

// .env は開発者の手元にしかない（gitignore 済み）。CI やコンテナでは環境変数が
// 直接渡されるので、ファイルが無いことを失敗にしない。
if (existsSync(".env")) process.loadEnvFile(".env");

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DATABASE_URL"),
  },
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
