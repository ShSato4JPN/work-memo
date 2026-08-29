"use server";

import { prisma } from "@/lib/prisma";
import { revalidateAllViews } from "./revalidate";
import { createTaskRecord } from "./task-core";

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
