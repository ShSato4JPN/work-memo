import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { updateTaskStatus } from "@/server/actions/task";
import {
  createTaskAndStart,
  createTaskOnly,
  getRunningEntry,
  startTimer,
  stopTimer,
  updateEntryTimes,
} from "@/server/actions/timer";

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

    const running = await getRunningEntry(task.id);
    expect(running?.taskId).toBe(task.id);
  });

  it("別タスクを開始しても先に走っているタスクは止まらない（並行計測）", async () => {
    const category = await seedCategory();
    const first = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: 60 },
    });
    const second = await prisma.task.create({
      data: { title: "レビュー対応", categoryId: category.id, estimateMin: 30 },
    });

    await startTimer(first.id);
    await startTimer(second.id);

    // 2件が同時に計測中であること
    expect(await prisma.entry.count({ where: { endedAt: null } })).toBe(2);
    expect((await getRunningEntry(first.id))?.taskId).toBe(first.id);
    expect((await getRunningEntry(second.id))?.taskId).toBe(second.id);

    // 割り込みとしては記録しない
    const entries = await prisma.entry.findMany();
    expect(entries.every((entry) => entry.parentEntryId === null)).toBe(true);
  });

  it("片方を停止しても、もう片方の計測は続く", async () => {
    const category = await seedCategory();
    const first = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: 60 },
    });
    const second = await prisma.task.create({
      data: { title: "レビュー対応", categoryId: category.id, estimateMin: 30 },
    });

    await startTimer(first.id);
    await startTimer(second.id);
    await stopTimer(first.id);

    expect(await getRunningEntry(first.id)).toBeNull();
    expect((await getRunningEntry(second.id))?.taskId).toBe(second.id);
  });

  it("同じタスクを連続で startTimer しても二重に計測しない", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: 60 },
    });

    await startTimer(task.id);
    const first = await getRunningEntry(task.id);
    await startTimer(task.id);
    const second = await getRunningEntry(task.id);

    expect(second?.id).toBe(first!.id);
    expect(await prisma.entry.count({ where: { taskId: task.id } })).toBe(1);

    const currentEntry = await prisma.entry.findUniqueOrThrow({ where: { id: second!.id } });
    expect(currentEntry.parentEntryId).toBeNull();
  });

  it("createTaskOnly はタスクを作るだけで計測を始めない", async () => {
    const category = await seedCategory();

    const result = await createTaskOnly({
      title: "あとでやるタスク",
      categoryId: category.id,
      estimateMin: null,
    });
    expect(result.ok).toBe(true);

    const task = await prisma.task.findUniqueOrThrow({ where: { title: "あとでやるタスク" } });
    expect(task.status).toBe("todo");
    expect(await getRunningEntry(task.id)).toBeNull();
  });

  it("createTaskOnly は重複タイトルを例外ではなく結果として返す", async () => {
    const category = await seedCategory();
    await prisma.task.create({ data: { title: "重複するタスク", categoryId: category.id } });

    const result = await createTaskOnly({
      title: "重複するタスク",
      categoryId: category.id,
      estimateMin: null,
    });

    expect(result.ok).toBe(false);
  });

  it("stopTimer で計測中のエントリがなくなる", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: 60 },
    });

    await startTimer(task.id);
    await stopTimer(task.id);

    expect(await getRunningEntry(task.id)).toBeNull();
  });

  it("createTaskAndStart はタスクを作って同時に計測を始める", async () => {
    const category = await seedCategory();

    await createTaskAndStart({ title: "新規タスク", categoryId: category.id, estimateMin: 45 });

    const task = await prisma.task.findUniqueOrThrow({ where: { title: "新規タスク" } });
    expect(task.status).toBe("doing");

    const running = await getRunningEntry(task.id);
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
    expect(await prisma.entry.count({ where: { endedAt: null } })).toBe(0);
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

  it("完了にすると、計測中だった場合はその計測も終了する", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: 60 },
    });

    await startTimer(task.id);
    await updateTaskStatus(task.id, "done");

    expect(await getRunningEntry(task.id)).toBeNull();
    const updated = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.status).toBe("done");
    expect(updated.completedAt).not.toBeNull();
  });

  it("完了を取り消すと doing に戻り、completedAt が消える（計測は始まらない）", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({
      data: {
        title: "完了済みタスク",
        categoryId: category.id,
        status: "done",
        completedAt: new Date(2026, 7, 28, 18, 0),
      },
    });

    await updateTaskStatus(task.id, "doing");

    const updated = await prisma.task.findUniqueOrThrow({ where: { id: task.id } });
    expect(updated.status).toBe("doing");
    expect(updated.completedAt).toBeNull();
    expect(await getRunningEntry(task.id)).toBeNull();
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
    const running = await getRunningEntry(task.id);

    const startedAt = new Date(2026, 7, 29, 9, 0);
    const endedAt = new Date(2026, 7, 29, 10, 0);
    expect(await updateEntryTimes({ entryId: running!.id, startedAt, endedAt })).toEqual({
      ok: true,
    });

    const updated = await prisma.entry.findUniqueOrThrow({ where: { id: running!.id } });
    expect(updated.startedAt).toEqual(startedAt);
    expect(updated.endedAt).toEqual(endedAt);
    expect(await getRunningEntry(task.id)).toBeNull();
  });

  it("終了時刻が開始時刻より前なら更新できない", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: 60 },
    });

    await startTimer(task.id);
    const running = await getRunningEntry(task.id);

    const result = await updateEntryTimes({
      entryId: running!.id,
      startedAt: new Date(2026, 7, 29, 10, 0),
      endedAt: new Date(2026, 7, 29, 9, 0),
    });

    expect(result).toEqual({ ok: false, message: "終了時刻は開始時刻より後にしてください" });
  });

  // 未来の開始時刻を許すと、経過が負になって集計から消え、そのまま停止すると
  // 開始＝終了の記録が確定して実際に作業した時間が失われる。入口で止まることを固定する。
  it("計測中のエントリに未来の開始時刻は保存できず、元の時刻が保たれる", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: 60 },
    });

    await startTimer(task.id);
    const running = await getRunningEntry(task.id);

    const now = new Date();
    const result = await updateEntryTimes(
      {
        entryId: running!.id,
        startedAt: new Date(now.getTime() + 60 * 60 * 1000),
        endedAt: null,
      },
      now,
    );

    expect(result).toEqual({ ok: false, message: "開始時刻に未来は指定できません" });

    const unchanged = await prisma.entry.findUniqueOrThrow({ where: { id: running!.id } });
    expect(unchanged.startedAt).toEqual(running!.startedAt);
    expect(unchanged.endedAt).toBeNull();
  });

  it("未来の終了時刻も保存できない", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: 60 },
    });

    await startTimer(task.id);
    const running = await getRunningEntry(task.id);

    const now = new Date();
    const result = await updateEntryTimes(
      {
        entryId: running!.id,
        startedAt: new Date(now.getTime() - 60 * 60 * 1000),
        endedAt: new Date(now.getTime() + 60 * 60 * 1000),
      },
      now,
    );

    expect(result).toEqual({ ok: false, message: "終了時刻に未来は指定できません" });
  });

  // 入力欄は分単位なので、いまの時刻を選んだだけの操作が時計のずれで弾かれてはいけない
  it("いまの時刻ちょうどは未来として弾かれない", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: 60 },
    });

    await startTimer(task.id);
    const running = await getRunningEntry(task.id);

    const now = new Date();
    const result = await updateEntryTimes(
      {
        entryId: running!.id,
        startedAt: new Date(now.getTime() - 60 * 60 * 1000),
        endedAt: now,
      },
      now,
    );

    expect(result).toEqual({ ok: true });
  });
});
