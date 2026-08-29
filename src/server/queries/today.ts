import { differenceInHours, endOfDay, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  minutesOnDate,
  sumByCategory,
  toDateKey,
  unionMinutes,
  type CategoryTotal,
} from "@/lib/aggregate";

export type TodayViewEntry = {
  id: number;
  taskId: number;
  title: string;
  categoryName: string;
  categoryColor: string;
  startedAt: Date;
  endedAt: Date | null;
  /** このエントリのうち「今日」に属する分数。今日の合計と必ず一致する */
  todayMinutes: number;
  /** 開始が今日ではない（＝日を跨いで続いてきた）エントリかどうか */
  startedOnEarlierDay: boolean;
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
  /**
   * 記録が重なっている分を二重に数えない、実際に経過した時間（分）。
   * 並行計測を許しているため totalMinutes はこれを超えることがある。
   */
  elapsedMinutes: number;
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
    // 集計には全カテゴリを渡す。archived は「選択肢から隠すだけ」で過去集計は保持する（設計書 DDL）
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    // Start パネルの選択肢。archived なタスクは選択肢から隠すだけで、集計（上の entries）には含まれる
    prisma.task.findMany({
      where: { archived: false, status: { in: ["todo", "doing"] } },
      include: { category: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const dateKey = toDateKey(now);

  const entries: TodayViewEntry[] = rawEntries.map((entry) => ({
    id: entry.id,
    taskId: entry.taskId,
    title: entry.task.title,
    categoryName: entry.task.category.name,
    categoryColor: entry.task.category.color,
    startedAt: entry.startedAt,
    endedAt: entry.endedAt,
    todayMinutes: minutesOnDate(
      {
        id: entry.id,
        taskId: entry.taskId,
        startedAt: entry.startedAt,
        endedAt: entry.endedAt,
        parentEntryId: entry.parentEntryId,
      },
      dateKey,
      now,
    ),
    startedOnEarlierDay: toDateKey(entry.startedAt) !== dateKey,
  }));

  const runningRaw = rawEntries.find((entry) => entry.endedAt === null);
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
    elapsedMinutes: unionMinutes(
      rawEntries.map((entry) => ({
        id: entry.id,
        taskId: entry.taskId,
        startedAt: entry.startedAt,
        endedAt: entry.endedAt,
        parentEntryId: entry.parentEntryId,
      })),
      from,
      to,
      now,
    ),
    activeTasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      categoryName: task.category.name,
    })),
    // Start パネルの選択肢だけは archived を除く
    categories: categories
      .filter((category) => !category.archived)
      .map((category) => ({
        id: category.id,
        name: category.name,
        color: category.color,
      })),
    staleRunning,
  };
}
