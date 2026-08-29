import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Prisma 7 では datasource の url をスキーマに書けなくなったため、
// PrismaClient にドライバアダプタを明示的に渡す必要がある。
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

const CATEGORIES = [
  { name: "開発", color: "#2563eb", sortOrder: 1 },
  { name: "調査", color: "#f59e0b", sortOrder: 2 },
  { name: "レビュー", color: "#10b981", sortOrder: 3 },
  { name: "会議", color: "#ef4444", sortOrder: 4 },
  { name: "その他", color: "#6b7280", sortOrder: 5 },
];

async function main() {
  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
