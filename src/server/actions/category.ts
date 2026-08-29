"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { CATEGORY_COLOR_PATTERN } from "@/lib/category-colors";
import { revalidateAllViews } from "./revalidate";

export type CreateCategoryResult =
  | { ok: true; categoryId: number }
  | { ok: false; message: string };
export type UpdateCategoryResult = { ok: true } | { ok: false; message: string };

/** 名前と色の検証。追加と更新で同じ規則を使う */
function validate(input: { name: string; color: string }): { name: string } | { message: string } {
  const name = input.name.trim();
  if (name === "") return { message: "カテゴリ名を入力してください" };
  if (!CATEGORY_COLOR_PATTERN.test(input.color)) return { message: "色の指定が不正です" };
  return { name };
}

/**
 * カテゴリを追加する。
 * 名前は UNIQUE なので、重複は通常操作として起こりうる。例外でエラー画面に落とさず、
 * 画面にインライン表示できる結果として返す。
 */
export async function createCategory(input: {
  name: string;
  color: string;
}): Promise<CreateCategoryResult> {
  const checked = validate(input);
  if ("message" in checked) return { ok: false, message: checked.message };

  try {
    // 末尾に並ぶよう、既存の最大値の次を採番する
    const last = await prisma.category.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const category = await prisma.category.create({
      data: { name: checked.name, color: input.color, sortOrder: (last?.sortOrder ?? 0) + 1 },
    });

    revalidateAllViews();
    return { ok: true, categoryId: category.id };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, message: "同じ名前のカテゴリがあります" };
    }
    return { ok: false, message: "カテゴリを追加できませんでした" };
  }
}

/**
 * カテゴリの名前と色を変更する。
 *
 * タスクは categoryId で紐づいているので、名前を変えても過去の記録や集計は壊れない
 * （設計上、改名しても過去データが保たれることを意図している）。
 */
export async function updateCategory(input: {
  id: number;
  name: string;
  color: string;
}): Promise<UpdateCategoryResult> {
  const checked = validate(input);
  if ("message" in checked) return { ok: false, message: checked.message };

  try {
    await prisma.category.update({
      where: { id: input.id },
      data: { name: checked.name, color: input.color },
    });

    revalidateAllViews();
    return { ok: true };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, message: "同じ名前のカテゴリがあります" };
    }
    return { ok: false, message: "カテゴリを変更できませんでした" };
  }
}

export type DeleteCategoryResult = { ok: true } | { ok: false; message: string };

/**
 * カテゴリを削除する。
 *
 * タスクが1件でも紐づいていれば削除しない。カテゴリは集計の軸そのものなので、
 * 消すと過去の記録がどの分類だったのか復元できなくなる。archived なタスクも数える
 * （一覧から隠れているだけで、分析には残っているため）。
 * 紐づくタスクがなければ、残しても選択肢を増やすだけなので物理削除する。
 */
export async function deleteCategory(categoryId: number): Promise<DeleteCategoryResult> {
  try {
    const taskCount = await prisma.task.count({ where: { categoryId } });
    if (taskCount > 0) {
      return {
        ok: false,
        message: `${taskCount}件のタスクで使われているため削除できません。先にタスクのカテゴリを変えてください。`,
      };
    }

    await prisma.category.delete({ where: { id: categoryId } });
  } catch {
    return { ok: false, message: "カテゴリを削除できませんでした" };
  }

  revalidateAllViews();
  return { ok: true };
}
