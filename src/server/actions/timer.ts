"use server";

import type { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createTaskRecord } from "./task-core";

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
 * 計測開始の中身。`tx` を受け取ることで `startTimer` 単体からも、
 * `createTaskAndStart` のようにタスク作成と同じトランザクション内からも呼べる。
 *
 * 既に計測中のエントリがあれば、それを終了させたうえで
 * 新しいエントリの parentEntryId に設定する（＝割り込みとして記録する）。
 * ただし計測中のタスクと同じタスクを再度 Start した場合は、
 * 自分自身への割り込みという偽の記録を作らないよう何もしない（no-op）。
 */
async function startTimerInTx(tx: Prisma.TransactionClient, taskId: number): Promise<void> {
  const now = new Date();
  const running = await tx.entry.findFirst({ where: { endedAt: null } });

  if (running && running.taskId === taskId) {
    return;
  }

  if (running) {
    // 経過0秒のエントリを作らないよう1ミリ秒進める（DB 上の制約ではなく、意味のある区間にするための調整）
    const endedAt = now > running.startedAt ? now : new Date(running.startedAt.getTime() + 1);
    await tx.entry.update({ where: { id: running.id }, data: { endedAt } });
  }

  await tx.entry.create({
    data: { taskId, startedAt: now, parentEntryId: running?.id ?? null },
  });

  await tx.task.update({ where: { id: taskId }, data: { status: "doing" } });
}

export async function startTimer(taskId: number): Promise<void> {
  await prisma.$transaction((tx) => startTimerInTx(tx, taskId));

  revalidatePath("/");
}

export async function stopTimer(): Promise<void> {
  const running = await prisma.entry.findFirst({ where: { endedAt: null } });
  if (!running) return;

  const now = new Date();
  // 経過0秒のエントリを作らないよう1ミリ秒進める（DB 上の制約ではなく、意味のある区間にするための調整）
  const endedAt = now > running.startedAt ? now : new Date(running.startedAt.getTime() + 1);
  await prisma.entry.update({ where: { id: running.id }, data: { endedAt } });

  revalidatePath("/");
}

export async function createTaskAndStart(input: {
  title: string;
  categoryId: number;
  estimateMin: number | null;
}): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const task = await createTaskRecord(tx, input);
    await startTimerInTx(tx, task.id);
  });

  revalidatePath("/tasks");
  revalidatePath("/");
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
