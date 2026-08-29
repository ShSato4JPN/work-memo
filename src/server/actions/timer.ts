"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function getRunningEntry(): Promise<{
  id: number;
  taskId: number;
  startedAt: Date;
} | null> {
  const entry = await prisma.entry.findFirst({
    where: { endedAt: null },
    select: { id: true, taskId: true, startedAt: true },
  });
  return entry;
}

/**
 * 計測を開始する。
 * 既に計測中のエントリがあれば、それを終了させたうえで
 * 新しいエントリの parentEntryId に設定する（＝割り込みとして記録する）。
 */
export async function startTimer(taskId: number): Promise<void> {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const running = await tx.entry.findFirst({ where: { endedAt: null } });

    if (running) {
      // 経過0秒だと CHECK 制約 (ended_at > started_at) に触れるため1ミリ秒進める
      const endedAt = now > running.startedAt ? now : new Date(running.startedAt.getTime() + 1);
      await tx.entry.update({ where: { id: running.id }, data: { endedAt } });
    }

    await tx.entry.create({
      data: { taskId, startedAt: now, parentEntryId: running?.id ?? null },
    });

    await tx.task.update({ where: { id: taskId }, data: { status: "doing" } });
  });

  revalidatePath("/");
}

export async function stopTimer(): Promise<void> {
  const running = await prisma.entry.findFirst({ where: { endedAt: null } });
  if (!running) return;

  const now = new Date();
  const endedAt = now > running.startedAt ? now : new Date(running.startedAt.getTime() + 1);
  await prisma.entry.update({ where: { id: running.id }, data: { endedAt } });

  revalidatePath("/");
}

export async function createTaskAndStart(input: {
  title: string;
  categoryId: number;
  estimateMin: number | null;
}): Promise<void> {
  const title = input.title.trim();
  if (title === "") throw new Error("タスク名を入力してください");

  const task = await prisma.task.create({
    data: { title, categoryId: input.categoryId, estimateMin: input.estimateMin },
  });

  await startTimer(task.id);
  revalidatePath("/tasks");
}

/** Stop 忘れなどの時刻を後から修正する */
export async function updateEntryTimes(input: {
  entryId: number;
  startedAt: Date;
  endedAt: Date | null;
}): Promise<void> {
  if (input.endedAt !== null && input.endedAt <= input.startedAt) {
    throw new Error("終了時刻は開始時刻より後にしてください");
  }

  await prisma.entry.update({
    where: { id: input.entryId },
    data: { startedAt: input.startedAt, endedAt: input.endedAt },
  });

  revalidatePath("/");
}
