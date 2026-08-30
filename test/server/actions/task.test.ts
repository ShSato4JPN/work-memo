import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/prisma";
import { deleteTask, updateTask } from "@/server/actions/task";
import { startTimer } from "@/server/actions/timer";

async function resetDatabase() {
  await prisma.entry.deleteMany();
  await prisma.task.deleteMany();
  await prisma.category.deleteMany();
}

async function seedCategory(name = "開発", sortOrder = 1) {
  return prisma.category.create({ data: { name, color: "#2563eb", sortOrder } });
}

describe("タスクの編集", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("名前・カテゴリ・見積もりを変更できる", async () => {
    const category = await seedCategory();
    const other = await seedCategory("調査", 2);
    const task = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: 60 },
    });

    const result = await updateTask({
      id: task.id,
      title: "認証機能の実装（修正版）",
      categoryId: other.id,
      estimateMin: 90,
    });

    expect(result).toEqual({ ok: true });

    const updated = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.title).toBe("認証機能の実装（修正版）");
    expect(updated.categoryId).toBe(other.id);
    expect(updated.estimateMin).toBe(90);
  });

  it("名前を変えても記録は残る（記録は taskId で紐づくため）", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: 60 },
    });
    await startTimer(task.id);

    await updateTask({ id: task.id, title: "改名後", categoryId: category.id, estimateMin: 60 });

    expect(await prisma.entry.count({ where: { taskId: task.id } })).toBe(1);
  });

  it("空の名前は保存できない", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: null },
    });

    const result = await updateTask({
      id: task.id,
      title: "   ",
      categoryId: category.id,
      estimateMin: null,
    });

    expect(result).toEqual({ ok: false, message: "タスク名を入力してください" });
    const unchanged = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(unchanged.title).toBe("認証機能の実装");
  });

  it("既にある名前には変更できない", async () => {
    const category = await seedCategory();
    await prisma.task.create({ data: { title: "先にある名前", categoryId: category.id } });
    const task = await prisma.task.create({ data: { title: "あとから", categoryId: category.id } });

    const result = await updateTask({
      id: task.id,
      title: "先にある名前",
      categoryId: category.id,
      estimateMin: null,
    });

    expect(result.ok).toBe(false);
  });

  it("見積もりに0以下は保存できない", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({ data: { title: "見積もり", categoryId: category.id } });

    const result = await updateTask({
      id: task.id,
      title: "見積もり",
      categoryId: category.id,
      estimateMin: 0,
    });

    expect(result).toEqual({ ok: false, message: "見積もりは1分以上にしてください" });
  });
});

describe("タスクの削除", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("記録がないタスクは物理削除され、同じ名前を作り直せる", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({
      data: { title: "打ち間違い", categoryId: category.id },
    });

    expect(await deleteTask(task.id)).toEqual({ ok: true, archived: false });
    expect(await prisma.task.findUnique({ where: { id: task.id } })).toBeNull();

    // 名前が解放されているので、正しい名前で作り直せる
    await expect(
      prisma.task.create({ data: { title: "打ち間違い", categoryId: category.id } }),
    ).resolves.toBeDefined();
  });

  // archived は「一覧から隠すだけ」で過去集計は保持する（設計書 DDL）
  it("記録があるタスクは archived になり、記録は消えない", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({ data: { title: "作業済み", categoryId: category.id } });
    await startTimer(task.id);

    expect(await deleteTask(task.id)).toEqual({ ok: true, archived: true });

    const stored = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(stored.archived).toBe(true);
    expect(await prisma.entry.count({ where: { taskId: task.id } })).toBe(1);
  });

  it("計測中のタスクを削除すると計測も止まる", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({ data: { title: "計測中", categoryId: category.id } });
    await startTimer(task.id);

    await deleteTask(task.id);

    expect(await prisma.entry.count({ where: { taskId: task.id, endedAt: null } })).toBe(0);
  });
});
