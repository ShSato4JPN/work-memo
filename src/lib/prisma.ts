import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Prisma 7 では datasource の url をスキーマに書けなくなったため、
// PrismaClient にドライバアダプタを明示的に渡す必要がある。
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "" });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
