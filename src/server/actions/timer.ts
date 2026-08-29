"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { revalidateAllViews } from "./revalidate";
import { createTaskRecord, toCreateTaskErrorMessage, type CreateTaskResult } from "./task-core";

/** 計測中のエントリはタスクごとに最大1件。並行計測なので全体では複数ありうる */
export async function getRunningEntry(taskId: number): Promise<{
  id: number;
  taskId: number;
  startedAt: Date;
} | null> {
  return prisma.entry.findFirst({
    where: { taskId, endedAt: null },
    select: { id: true, taskId: true, startedAt: true },
  });
}

/**
 * 計測開始の中身。`tx` を受け取ることで `startTimer` 単体からも、
 * `createTaskAndStart` のようにタスク作成と同じトランザクション内からも呼べる。
 *
 * 並行計測なので、他タスクが計測中でも止めない。
 * 同じタスクが既に計測中の場合だけ、二重の計測を作らないよう何もしない（no-op）。
 */
async function startTimerInTx(tx: Prisma.TransactionClient, taskId: number): Promise<void> {
  const alreadyRunning = await tx.entry.findFirst({ where: { taskId, endedAt: null } });
  if (alreadyRunning) return;

  await tx.entry.create({ data: { taskId, startedAt: new Date() } });

  // done から再開した場合に完了日時が残らないよう、status を戻すときは completedAt も戻す
  await tx.task.update({ where: { id: taskId }, data: { status: "doing", completedAt: null } });
}

export async function startTimer(taskId: number): Promise<void> {
  await prisma.$transaction((tx) => startTimerInTx(tx, taskId));

  revalidateAllViews();
}

/**
 * 指定したタスクの計測を止める。
 * 並行計測では「いま走っているもの」が一意に決まらないため、必ず対象を指定する。
 */
export async function stopTimer(taskId: number): Promise<void> {
  const running = await prisma.entry.findFirst({ where: { taskId, endedAt: null } });
  if (!running) return;

  const now = new Date();
  // 経過0秒のエントリを作らないよう1ミリ秒進める（意味のある区間にするための調整）
  const endedAt = now > running.startedAt ? now : new Date(running.startedAt.getTime() + 1);
  await prisma.entry.update({ where: { id: running.id }, data: { endedAt } });

  revalidateAllViews();
}

/**
 * タスクを作るだけ（計測は始めない）。重複タイトル（UNIQUE 制約違反）は通常操作なので、
 * 例外を投げてエラー画面に落とさず、画面にインライン表示できる結果として返す。
 */
export async function createTaskOnly(input: {
  title: string;
  categoryId: number;
  estimateMin: number | null;
}): Promise<CreateTaskResult> {
  let taskId: number;
  try {
    const task = await createTaskRecord(prisma, input);
    taskId = task.id;
  } catch (error) {
    return { ok: false, message: toCreateTaskErrorMessage(error) };
  }

  revalidateAllViews();
  return { ok: true, taskId };
}

/** タスク作成と計測開始をひとつのトランザクションで行う */
export async function createTaskAndStart(input: {
  title: string;
  categoryId: number;
  estimateMin: number | null;
}): Promise<CreateTaskResult> {
  let taskId: number;
  try {
    taskId = await prisma.$transaction(async (tx) => {
      const task = await createTaskRecord(tx, input);
      await startTimerInTx(tx, task.id);
      return task.id;
    });
  } catch (error) {
    return { ok: false, message: toCreateTaskErrorMessage(error) };
  }

  revalidateAllViews();
  return { ok: true, taskId };
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

  revalidateAllViews();
}
