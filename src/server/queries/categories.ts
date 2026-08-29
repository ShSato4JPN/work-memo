import { prisma } from "@/lib/prisma";

/** 選択肢として提示するカテゴリ。アーカイブ済みは出さない（集計では引き続き数える） */
export async function getCategories(): Promise<{ id: number; name: string; color: string }[]> {
  const categories = await prisma.category.findMany({
    where: { archived: false },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, color: true },
  });
  return categories;
}
