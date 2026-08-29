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
