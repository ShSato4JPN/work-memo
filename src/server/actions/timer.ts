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
  if (!running) {
    // 別のタブで既に停止済みのことがある。何もせず戻ると押した側の画面が古いままになり、
    // 「ボタンが効かない」ように見えるので、対象がなくても必ず画面を作り直す。
    revalidateAllViews();
    return;
  }

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
export type UpdateEntryTimesResult = { ok: true } | { ok: false; message: string };

/**
 * 入力欄が分単位なので、クライアントとサーバの時計のわずかなずれで
 * 「いま」を指定しただけの操作が弾かれないよう1分だけ猶予を持たせる。
 */
const FUTURE_TOLERANCE_MS = 60 * 1000;

/**
 * 記録の開始・終了時刻を手で直す。
 *
 * 未来の時刻を拒む理由：計測中のエントリに未来の開始時刻を入れると、経過が負になって
 * 集計から丸ごと消え、そのまま停止すると「開始＝終了」という、この関数自身が不正と
 * 判定する記録が確定してしまう。実際に作業した時間が復元できなくなるため入口で止める。
 *
 * 失敗は例外ではなく結果として返す。時刻の打ち間違いは通常操作で、
 * エラー画面に落とさず入力欄のそばに理由を出したいため。
 */
export async function updateEntryTimes(
  input: {
    entryId: number;
    startedAt: Date;
    endedAt: Date | null;
  },
  now: Date = new Date(),
): Promise<UpdateEntryTimesResult> {
  const limit = now.getTime() + FUTURE_TOLERANCE_MS;

  if (input.startedAt.getTime() > limit) {
    return { ok: false, message: "開始時刻に未来は指定できません" };
  }
  if (input.endedAt !== null && input.endedAt.getTime() > limit) {
    return { ok: false, message: "終了時刻に未来は指定できません" };
  }
  if (input.endedAt !== null && input.endedAt <= input.startedAt) {
    return { ok: false, message: "終了時刻は開始時刻より後にしてください" };
  }

  await prisma.entry.update({
    where: { id: input.entryId },
    data: { startedAt: input.startedAt, endedAt: input.endedAt },
  });

  revalidateAllViews();
  return { ok: true };
}
