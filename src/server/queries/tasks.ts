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
};

export async function getTaskList(
  status?: TaskStatus,
  now: Date = new Date(),
): Promise<TaskListItem[]> {
  const tasks = await prisma.task.findMany({
    where: { archived: false, ...(status ? { status } : {}) },
    include: { category: true, entries: true },
    orderBy: { createdAt: "desc" },
  });

  return tasks.map((task) => {
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
    };
  });
}
