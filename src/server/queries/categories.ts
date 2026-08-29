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

export type CategoryListItem = {
  id: number;
  name: string;
  color: string;
  /** このカテゴリに属するタスクの数。使われているかどうかの目安 */
  taskCount: number;
};

/** カテゴリ管理画面の一覧。並び順は sortOrder */
export async function getCategoryList(): Promise<CategoryListItem[]> {
  const categories = await prisma.category.findMany({
    where: { archived: false },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { tasks: true } } },
  });

  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
    taskCount: category._count.tasks,
  }));
}
