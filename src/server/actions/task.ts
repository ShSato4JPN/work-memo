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

export async function updateTaskStatus(taskId: number, status: TaskStatus): Promise<void> {
  if (!TASK_STATUSES.includes(status)) throw new Error(`不正なステータス: ${status}`);

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      completedAt: status === "done" ? new Date() : null,
    },
  });

  revalidateAllViews();
}
