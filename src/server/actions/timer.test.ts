import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createTaskAndStart,
  getRunningEntry,
  startTimer,
  stopTimer,
  updateEntryTimes,
} from "./timer";

async function resetDatabase() {
  await prisma.entry.deleteMany();
  await prisma.task.deleteMany();
  await prisma.category.deleteMany();
}

async function seedCategory() {
  return prisma.category.create({
    data: { name: "開発", color: "#2563eb", sortOrder: 1 },
  });
}

describe("タイマー操作", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("startTimer で計測中のエントリが1件できる", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: 60 },
    });

    await startTimer(task.id);

    const running = await getRunningEntry();
    expect(running?.taskId).toBe(task.id);
  });

  it("計測中に startTimer すると前のエントリが自動で止まり parentEntryId が入る", async () => {
    const category = await seedCategory();
    const first = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: 60 },
    });
    const second = await prisma.task.create({
      data: { title: "レビュー対応", categoryId: category.id, estimateMin: 30 },
    });

    await startTimer(first.id);
    const firstEntry = await getRunningEntry();
    await startTimer(second.id);

    const previous = await prisma.entry.findUniqueOrThrow({ where: { id: firstEntry!.id } });
    expect(previous.endedAt).not.toBeNull();

    const running = await getRunningEntry();
    expect(running?.taskId).toBe(second.id);

    const currentEntry = await prisma.entry.findUniqueOrThrow({ where: { id: running!.id } });
    expect(currentEntry.parentEntryId).toBe(firstEntry!.id);
  });

  it("計測中のエントリは常に1件を超えない", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: 60 },
    });

    await startTimer(task.id);
    await startTimer(task.id);

    const runningCount = await prisma.entry.count({ where: { endedAt: null } });
    expect(runningCount).toBe(1);
  });

  it("同じタスクを連続で startTimer しても新しいエントリを作らない（自己割り込みを記録しない）", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: 60 },
    });

    await startTimer(task.id);
    const first = await getRunningEntry();
    await startTimer(task.id);
    const second = await getRunningEntry();

    expect(second?.id).toBe(first!.id);
    expect(await prisma.entry.count({ where: { taskId: task.id } })).toBe(1);

    const currentEntry = await prisma.entry.findUniqueOrThrow({ where: { id: second!.id } });
    expect(currentEntry.parentEntryId).toBeNull();
  });

  it("部分ユニークインデックスにより計測中のエントリを直接2件目作ろうとすると拒否される", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: 60 },
    });

    await startTimer(task.id);

    await expect(
      prisma.entry.create({ data: { taskId: task.id, startedAt: new Date() } }),
    ).rejects.toThrow();
  });

  it("stopTimer で計測中のエントリがなくなる", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: 60 },
    });

    await startTimer(task.id);
    await stopTimer();

    expect(await getRunningEntry()).toBeNull();
  });

  it("createTaskAndStart はタスクを作って同時に計測を始める", async () => {
    const category = await seedCategory();

    await createTaskAndStart({ title: "新規タスク", categoryId: category.id, estimateMin: 45 });

    const task = await prisma.task.findUniqueOrThrow({ where: { title: "新規タスク" } });
    expect(task.status).toBe("doing");

    const running = await getRunningEntry();
    expect(running?.taskId).toBe(task.id);
  });

  it("createTaskAndStart は同じタイトルのタスクがあるとエラー結果を返し、例外を投げない", async () => {
    const category = await seedCategory();
    await prisma.task.create({ data: { title: "重複するタスク", categoryId: category.id } });

    const result = await createTaskAndStart({
      title: "重複するタスク",
      categoryId: category.id,
      estimateMin: null,
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain("同じ名前のタスク");
    expect(await getRunningEntry()).toBeNull();
  });

  it("createTaskAndStart はタスク名が空ならエラー結果を返す", async () => {
    const category = await seedCategory();

    const result = await createTaskAndStart({
      title: "   ",
      categoryId: category.id,
      estimateMin: null,
    });

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toBe("タスク名を入力してください");
    expect(await prisma.task.count()).toBe(0);
  });

  it("startTimer は done のタスクを doing に戻すとき completedAt も消す", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({
      data: {
        title: "完了済みタスク",
        categoryId: category.id,
        status: "done",
        completedAt: new Date(2026, 7, 28, 18, 0),
      },
    });

    await startTimer(task.id);

    const updated = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.status).toBe("doing");
    expect(updated.completedAt).toBeNull();
  });

  it("updateEntryTimes で Stop 忘れのエントリを後から修正できる", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: 60 },
    });

    await startTimer(task.id);
    const running = await getRunningEntry();

    const startedAt = new Date(2026, 7, 29, 9, 0);
    const endedAt = new Date(2026, 7, 29, 10, 0);
    await updateEntryTimes({ entryId: running!.id, startedAt, endedAt });

    const updated = await prisma.entry.findUniqueOrThrow({ where: { id: running!.id } });
    expect(updated.startedAt).toEqual(startedAt);
    expect(updated.endedAt).toEqual(endedAt);
    expect(await getRunningEntry()).toBeNull();
  });

  it("終了時刻が開始時刻より前なら更新できない", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: 60 },
    });

    await startTimer(task.id);
    const running = await getRunningEntry();

    await expect(
      updateEntryTimes({
        entryId: running!.id,
        startedAt: new Date(2026, 7, 29, 10, 0),
        endedAt: new Date(2026, 7, 29, 9, 0),
      }),
    ).rejects.toThrow();
  });
});
