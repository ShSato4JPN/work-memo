import { differenceInHours, endOfDay, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { sumByCategory, toDateKey, type CategoryTotal } from "@/lib/aggregate";

export type TodayViewEntry = {
  id: number;
  taskId: number;
  title: string;
  categoryName: string;
  categoryColor: string;
  startedAt: Date;
  endedAt: Date | null;
  isInterruption: boolean;
};

export type TodayView = {
  running: {
    entryId: number;
    taskId: number;
    title: string;
    categoryName: string;
    categoryColor: string;
    startedAt: Date;
  } | null;
  entries: TodayViewEntry[];
  categoryTotals: CategoryTotal[];
  totalMinutes: number;
  activeTasks: { id: number; title: string; categoryName: string }[];
  categories: { id: number; name: string; color: string }[];
  /** 開始から8時間以上経過した計測中エントリ。Stop 忘れの可能性が高い */
  staleRunning: { entryId: number; title: string; startedAt: Date } | null;
};

export async function getTodayView(now: Date = new Date()): Promise<TodayView> {
  const from = startOfDay(now);
  const to = endOfDay(now);

  const [rawEntries, categories, tasks] = await Promise.all([
    prisma.entry.findMany({
      where: {
        startedAt: { lte: to },
        OR: [{ endedAt: null }, { endedAt: { gte: from } }],
      },
      include: { task: { include: { category: true } } },
      orderBy: { startedAt: "asc" },
    }),
    prisma.category.findMany({ where: { archived: false }, orderBy: { sortOrder: "asc" } }),
    prisma.task.findMany({
      where: { archived: false, status: { in: ["todo", "doing"] } },
      include: { category: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const entries: TodayViewEntry[] = rawEntries.map((entry) => ({
    id: entry.id,
    taskId: entry.taskId,
    title: entry.task.title,
    categoryName: entry.task.category.name,
    categoryColor: entry.task.category.color,
    startedAt: entry.startedAt,
    endedAt: entry.endedAt,
    isInterruption: entry.parentEntryId !== null,
  }));

  const runningRaw = rawEntries.find((entry) => entry.endedAt === null);

  const dateKey = toDateKey(now);
  const categoryTotals = sumByCategory(
    rawEntries.map((entry) => ({
      id: entry.id,
      taskId: entry.taskId,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      parentEntryId: entry.parentEntryId,
    })),
    rawEntries.map((entry) => ({
      id: entry.task.id,
      title: entry.task.title,
      categoryId: entry.task.categoryId,
      estimateMin: entry.task.estimateMin,
    })),
    categories,
    { from: dateKey, to: dateKey },
    now,
  );

  const STALE_THRESHOLD_HOURS = 8;
  const staleRunning =
    runningRaw && differenceInHours(now, runningRaw.startedAt) >= STALE_THRESHOLD_HOURS
      ? {
          entryId: runningRaw.id,
          title: runningRaw.task.title,
          startedAt: runningRaw.startedAt,
        }
      : null;

  return {
    running: runningRaw
      ? {
          entryId: runningRaw.id,
          taskId: runningRaw.taskId,
          title: runningRaw.task.title,
          categoryName: runningRaw.task.category.name,
          categoryColor: runningRaw.task.category.color,
          startedAt: runningRaw.startedAt,
        }
      : null,
    entries,
    categoryTotals,
    totalMinutes: categoryTotals.reduce((sum, total) => sum + total.minutes, 0),
    activeTasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      categoryName: task.category.name,
    })),
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
    })),
    staleRunning,
  };
}
