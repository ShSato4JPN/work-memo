"use server";

import { prisma } from "@/lib/prisma";
import { revalidateAllViews } from "./revalidate";
import { createTaskRecord, toCreateTaskErrorMessage } from "./task-core";

export type TaskStatus = "todo" | "doing" | "done";

const TASK_STATUSES: TaskStatus[] = ["todo", "doing", "done"];

export async function createTask(input: {
  title: string;
  categoryId: number;
  estimateMin: number | null;
}): Promise<number> {
  const task = await createTaskRecord(prisma, input);

  revalidateAllViews();
  return task.id;
}

/**
 * タスクの状態を変える。
 *
 * `done` にするときは、そのタスクが計測中なら同じトランザクションで計測も終了させる。
 * 完了したのに時間が伸び続ける状態を残さないため。
 */
export async function updateTaskStatus(taskId: number, status: TaskStatus): Promise<void> {
  if (!TASK_STATUSES.includes(status)) throw new Error(`不正なステータス: ${status}`);

  await prisma.$transaction(async (tx) => {
    if (status === "done") {
      const running = await tx.entry.findFirst({ where: { taskId, endedAt: null } });
      if (running) {
        const now = new Date();
        // 経過0秒のエントリを作らないよう1ミリ秒進める
        const endedAt = now > running.startedAt ? now : new Date(running.startedAt.getTime() + 1);
        await tx.entry.update({ where: { id: running.id }, data: { endedAt } });
      }
    }

    await tx.task.update({
      where: { id: taskId },
      data: {
        status,
        completedAt: status === "done" ? new Date() : null,
      },
    });
  });

  revalidateAllViews();
}

export type UpdateTaskResult = { ok: true } | { ok: false; message: string };

/**
 * タスクの名前・カテゴリ・見積もりを変更する。
 *
 * 打ち間違えた名前を直せることが主目的。タイトルは表記ゆれ防止のため UNIQUE なので、
 * 重複は通常操作として起こりうる。例外でエラー画面に落とさず結果として返す。
 * 記録は taskId で紐づいているので、名前を変えても過去の集計は壊れない。
 */
export async function updateTask(input: {
  id: number;
  title: string;
  categoryId: number;
  estimateMin: number | null;
}): Promise<UpdateTaskResult> {
  const title = input.title.trim();
  if (title === "") return { ok: false, message: "タスク名を入力してください" };
  if (input.estimateMin !== null && input.estimateMin <= 0) {
    return { ok: false, message: "見積もりは1分以上にしてください" };
  }

  try {
    await prisma.task.update({
      where: { id: input.id },
      data: { title, categoryId: input.categoryId, estimateMin: input.estimateMin },
    });
  } catch (error) {
    return { ok: false, message: toCreateTaskErrorMessage(error) };
  }

  revalidateAllViews();
  return { ok: true };
}

export type DeleteTaskResult = { ok: true; archived: boolean } | { ok: false; message: string };

/**
 * タスクを一覧から消す。
 *
 * 記録が1件でもあるタスクは物理削除せず archived にする。過去の集計を保つためで、
 * 設計書の「archived は隠すだけ。過去集計は保持」に従う。
 * 記録がまったくないタスク（打ち間違えて作っただけ等）は、残しても集計に何も寄与せず
 * 名前だけを占有し続けるので物理削除する。
 *
 * 計測中なら同じトランザクションで止める。消えた行の計測だけが動き続けるのを防ぐ。
 */
export async function deleteTask(taskId: number): Promise<DeleteTaskResult> {
  try {
    const archived = await prisma.$transaction(async (tx) => {
      const running = await tx.entry.findFirst({ where: { taskId, endedAt: null } });
      if (running) {
        const now = new Date();
        const endedAt = now > running.startedAt ? now : new Date(running.startedAt.getTime() + 1);
        await tx.entry.update({ where: { id: running.id }, data: { endedAt } });
      }

      const entryCount = await tx.entry.count({ where: { taskId } });
      if (entryCount === 0) {
        await tx.task.delete({ where: { id: taskId } });
        return false;
      }

      await tx.task.update({ where: { id: taskId }, data: { archived: true } });
      return true;
    });

    revalidateAllViews();
    return { ok: true, archived };
  } catch {
    return { ok: false, message: "タスクを削除できませんでした" };
  }
}
