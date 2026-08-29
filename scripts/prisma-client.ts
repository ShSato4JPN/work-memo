import { existsSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

/**
 * スクリプトから使う Prisma クライアント。
 *
 * Prisma 7 では datasource の url をスキーマに書けないため、アダプタを明示的に渡す。
 * アプリ側（src/lib/prisma.ts）とは別に用意している。スクリプトは Next.js の外で
 * 単発のプロセスとして動くので、開発時の使い回し（globalThis へのキャッシュ）が要らない。
 */
export function createPrismaClient(): PrismaClient {
  // .env が無い環境（CI・コンテナ）では、環境変数が直接渡されている前提で進む
  if (existsSync(".env")) process.loadEnvFile(".env");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL が設定されていません（.env を確認してください）");

  return new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });
}
