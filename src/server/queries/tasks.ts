import { prisma } from "@/lib/prisma";
import { taskActualMinutes } from "@/lib/aggregate";
import type { TaskStatus } from "@/server/actions/task";

export type TaskListItem = {
  id: number;
  title: string;
  categoryName: string;
  categoryColor: string;
  status: string;
  estimateMin: number | null;
  actualMin: number;
  diffMin: number | null;
  lastWorkedAt: Date | null;
  /** 計測中ならその開始時刻。行の時計と開始/停止トグルの状態はこれで決まる */
  runningSince: Date | null;
};

export async function getTaskList(
  status?: TaskStatus,
  now: Date = new Date(),
): Promise<TaskListItem[]> {
  // archived は「一覧の表示から隠すため」だけに使う。集計（分析画面・今日の合計）は
  // アーカイブ済みタスクの時間も保持する。
  const tasks = await prisma.task.findMany({
    where: { archived: false, ...(status ? { status } : {}) },
    include: { category: true, entries: true },
    orderBy: { createdAt: "desc" },
  });

  const items = tasks.map((task) => {
    const actuals = taskActualMinutes(
      task.entries.map((entry) => ({
        id: entry.id,
        taskId: entry.taskId,
        startedAt: entry.startedAt,
        endedAt: entry.endedAt,
        parentEntryId: entry.parentEntryId,
      })),
      now,
    );
    const actualMin = actuals.get(task.id) ?? 0;

    const runningSince = task.entries.find((entry) => entry.endedAt === null)?.startedAt ?? null;

    const lastWorkedAt = task.entries.reduce<Date | null>(
      (latest, entry) => (latest === null || entry.startedAt > latest ? entry.startedAt : latest),
      null,
    );

    return {
      id: task.id,
      title: task.title,
      categoryName: task.category.name,
      categoryColor: task.category.color,
      status: task.status,
      estimateMin: task.estimateMin,
      actualMin,
      diffMin: task.estimateMin === null ? null : actualMin - task.estimateMin,
      lastWorkedAt,
      runningSince,
    };
  });

  // 計測中のタスクを先頭に集める。並行計測では「いま動いているもの」が複数あるため、
  // 一覧の上で一望できることが操作のしやすさに直結する。
  return items.sort((a, b) => {
    if (a.runningSince && !b.runningSince) return -1;
    if (!a.runningSince && b.runningSince) return 1;
    return 0;
  });
}
