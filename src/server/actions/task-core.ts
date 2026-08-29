import type { Prisma, PrismaClient, Task } from "@prisma/client";

type TaskWriteClient = PrismaClient | Prisma.TransactionClient;

export type CreateTaskResult = { ok: true; taskId: number } | { ok: false; message: string };

/** 入力内容の問題（そのままユーザーに見せてよいメッセージ） */
export class TaskValidationError extends Error {}

/**
 * タスク作成の失敗を、画面にそのまま出せる日本語メッセージに変換する。
 * P2002 は Prisma の一意制約違反。tasks.title は表記ゆれ防止のため UNIQUE なので、
 * 「既にある名前を打つ」という通常操作でここに来る。
 */
export function toCreateTaskErrorMessage(error: unknown): string {
  if (error instanceof TaskValidationError) return error.message;
  if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
    return "同じ名前のタスクがあります。別の名前にしてください。";
  }
  return "タスクを作成できませんでした。もう一度お試しください。";
}

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
  if (title === "") throw new TaskValidationError("タスク名を入力してください");

  return client.task.create({
    data: { title, categoryId: input.categoryId, estimateMin: input.estimateMin },
  });
}
