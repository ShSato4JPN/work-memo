import type { Prisma, PrismaClient, Task } from "@prisma/client";

type TaskWriteClient = PrismaClient | Prisma.TransactionClient;

export type CreateTaskInput = {
  title: string;
  categoryId: number;
  estimateMin: number | null;
};

/**
 * タスク作成のバリデーションと生成。`createTask`（単独トランザクション）と
 * `createTaskAndStart`（タスク作成＋計測開始を1トランザクションにまとめる場合）の
 * 両方から、通常の PrismaClient / トランザクションクライアントいずれでも呼べる。
 */
export async function createTaskRecord(
  client: TaskWriteClient,
  input: CreateTaskInput,
): Promise<Task> {
  const title = input.title.trim();
  if (title === "") throw new Error("タスク名を入力してください");

  return client.task.create({
    data: { title, categoryId: input.categoryId, estimateMin: input.estimateMin },
  });
}
