"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type TaskStatus = "todo" | "doing" | "done";

const TASK_STATUSES: TaskStatus[] = ["todo", "doing", "done"];

export async function createTask(input: {
  title: string;
  categoryId: number;
  estimateMin: number | null;
}): Promise<number> {
  const title = input.title.trim();
  if (title === "") throw new Error("タスク名を入力してください");

  const task = await prisma.task.create({
    data: { title, categoryId: input.categoryId, estimateMin: input.estimateMin },
  });

  revalidatePath("/tasks");
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

  revalidatePath("/tasks");
  revalidatePath("/");
}
