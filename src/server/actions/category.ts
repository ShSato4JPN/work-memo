"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidateAllViews } from "./revalidate";

export type CreateCategoryResult =
  | { ok: true; categoryId: number }
  | { ok: false; message: string };

/** 色は #rrggbb だけ受け付ける。画面のパレット以外を直接送られても壊れないようにする */
const COLOR_PATTERN = /^#[0-9a-f]{6}$/i;

/**
 * カテゴリを追加する。
 * 名前は UNIQUE なので、重複は通常操作として起こりうる。例外でエラー画面に落とさず、
 * 画面にインライン表示できる結果として返す。
 */
export async function createCategory(input: {
  name: string;
  color: string;
}): Promise<CreateCategoryResult> {
  const name = input.name.trim();
  if (name === "") return { ok: false, message: "カテゴリ名を入力してください" };
  if (!COLOR_PATTERN.test(input.color)) return { ok: false, message: "色の指定が不正です" };

  try {
    // 末尾に並ぶよう、既存の最大値の次を採番する
    const last = await prisma.category.findFirst({
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    const category = await prisma.category.create({
      data: { name, color: input.color, sortOrder: (last?.sortOrder ?? 0) + 1 },
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
