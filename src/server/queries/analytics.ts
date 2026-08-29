import { endOfMonth, endOfWeek, startOfDay, endOfDay, startOfMonth, startOfWeek } from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  averageFocusMin,
  countInterruptions,
  dailyTotals,
  estimateComparisons,
  sumByCategory,
  toDateKey,
  type CategoryTotal,
  type DailyTotal,
  type DateRange,
  type EstimateComparison,
} from "@/lib/aggregate";

export type Period = "day" | "week" | "month";

export type AnalyticsView = {
  range: DateRange;
  categoryTotals: CategoryTotal[];
  daily: DailyTotal[];
  categories: { id: number; name: string; color: string }[];
  totalMinutes: number;
  interruptionCount: number;
  averageFocusMinutes: number;
  estimates: EstimateComparison[];
};

function resolveRange(period: Period, now: Date): { from: Date; to: Date } {
  if (period === "day") return { from: startOfDay(now), to: endOfDay(now) };
  if (period === "week") {
    return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
  }
  return { from: startOfMonth(now), to: endOfMonth(now) };
}

export async function getAnalytics(period: Period, now: Date = new Date()): Promise<AnalyticsView> {
  const { from, to } = resolveRange(period, now);
  const range: DateRange = { from: toDateKey(from), to: toDateKey(to) };

  const [rawEntries, categories] = await Promise.all([
    prisma.entry.findMany({
      where: { startedAt: { lte: to }, OR: [{ endedAt: null }, { endedAt: { gte: from } }] },
      include: { task: true },
    }),
    prisma.category.findMany({ where: { archived: false }, orderBy: { sortOrder: "asc" } }),
  ]);

  const entries = rawEntries.map((entry) => ({
    id: entry.id,
    taskId: entry.taskId,
    startedAt: entry.startedAt,
    endedAt: entry.endedAt,
    parentEntryId: entry.parentEntryId,
  }));

  const tasks = [...new Map(rawEntries.map((entry) => [entry.task.id, entry.task])).values()].map(
    (task) => ({
      id: task.id,
      title: task.title,
      categoryId: task.categoryId,
      estimateMin: task.estimateMin,
    }),
  );

  const categoryTotals = sumByCategory(entries, tasks, categories, range, now);

  // 見積もり比較は「この期間に作業したタスク」を対象にするが、実績自体は
  // taskActualMinutes（estimateComparisons が内部で使う）の契約どおり全期間で計算する。
  // そのため、期間で絞った entries ではなく対象タスクの全エントリを別途取得する。
  const taskIds = tasks.map((task) => task.id);
  const rawEntriesForEstimate =
    taskIds.length > 0 ? await prisma.entry.findMany({ where: { taskId: { in: taskIds } } }) : [];
  const entriesForEstimate = rawEntriesForEstimate.map((entry) => ({
    id: entry.id,
    taskId: entry.taskId,
    startedAt: entry.startedAt,
    endedAt: entry.endedAt,
    parentEntryId: entry.parentEntryId,
  }));

  return {
    range,
    categoryTotals,
    daily: dailyTotals(entries, tasks, range, now),
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
    })),
    totalMinutes: categoryTotals.reduce((sum, total) => sum + total.minutes, 0),
    interruptionCount: countInterruptions(entries, range),
    averageFocusMinutes: averageFocusMin(entries, range, now),
    estimates: estimateComparisons(tasks, entriesForEstimate, now),
  };
}
