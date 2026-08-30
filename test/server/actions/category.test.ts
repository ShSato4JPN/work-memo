import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { deleteCategory } from "@/server/actions/category";

async function resetDatabase() {
  await prisma.entry.deleteMany();
  await prisma.task.deleteMany();
  await prisma.category.deleteMany();
}

describe("カテゴリの削除", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("タスクが紐づいていなければ削除できる", async () => {
    const category = await prisma.category.create({
      data: { name: "学習", color: "#a78bfa", sortOrder: 1 },
    });

    expect(await deleteCategory(category.id)).toEqual({ ok: true });
    expect(await prisma.category.findUnique({ where: { id: category.id } })).toBeNull();
  });

  // カテゴリは集計の軸なので、消すと過去の記録がどの分類だったのか復元できなくなる
  it("使用中のカテゴリは削除できず、理由が返る", async () => {
    const category = await prisma.category.create({
      data: { name: "開発", color: "#2563eb", sortOrder: 1 },
    });
    await prisma.task.create({ data: { title: "認証機能の実装", categoryId: category.id } });

    const result = await deleteCategory(category.id);

    expect(result.ok).toBe(false);
    expect(await prisma.category.findUnique({ where: { id: category.id } })).not.toBeNull();
  });

  it("archived なタスクしか残っていなくても削除できない", async () => {
    const category = await prisma.category.create({
      data: { name: "開発", color: "#2563eb", sortOrder: 1 },
    });
    await prisma.task.create({
      data: { title: "隠したタスク", categoryId: category.id, archived: true },
    });

    expect((await deleteCategory(category.id)).ok).toBe(false);
  });
});
