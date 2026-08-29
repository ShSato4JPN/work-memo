import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

// Prisma 7 では datasource の url をスキーマに書けなくなったため、
// PrismaClient にドライバアダプタを明示的に渡す必要がある。
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "" });
const prisma = new PrismaClient({ adapter });

const CATEGORIES = [
  { name: "開発", color: "#4c8df6", sortOrder: 1 },
  { name: "調査", color: "#f2a93b", sortOrder: 2 },
  { name: "レビュー", color: "#35c08a", sortOrder: 3 },
  { name: "会議", color: "#f2705c", sortOrder: 4 },
  { name: "その他", color: "#98a6b8", sortOrder: 5 },
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
