import { endOfMonth, endOfWeek, startOfDay, endOfDay, startOfMonth, startOfWeek } from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  averageFocusMin,
  dailyTotals,
  estimateComparisons,
  estimateSummary,
  sumByCategory,
  unestimatedWork,
  toDateKey,
  type CategoryTotal,
  type DailyTotal,
  type DateRange,
  type EstimateComparison,
  type EstimateSummary,
  type UnestimatedWork,
} from "@/lib/aggregate";

export type Period = "day" | "week" | "month";

export type AnalyticsView = {
  range: DateRange;
  categoryTotals: CategoryTotal[];
  daily: DailyTotal[];
  categories: { id: number; name: string; color: string }[];
  totalMinutes: number;
  averageFocusMinutes: number;
  estimates: EstimateComparison[];
  estimateSummary: EstimateSummary | null;
  /** 見積もりを付けないまま作業したタスク。比較表から漏れている分を示す */
  unestimated: UnestimatedWork[];
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
    // アーカイブ済みカテゴリも集計対象に含める。archived は選択肢から隠すためだけのフラグで、
    // 過去の集計は保持する（設計書 DDL）。ここで絞ると合計時間だけが減り、
    // 割り込み回数・平均継続時間・見積もり表と母集団が食い違う。
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);

  const entries = rawEntries.map((entry) => ({
    id: entry.id,
    taskId: entry.taskId,
    startedAt: entry.startedAt,
    endedAt: entry.endedAt,
    parentEntryId: entry.parentEntryId,
  }));

  // タスクも archived で絞らない（I2 と同じ方針：archived は一覧の表示から隠すためだけに使う）
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

  const comparisons = estimateComparisons(tasks, entriesForEstimate, now);

  const daily = dailyTotals(entries, tasks, range, now);

  // 積み上げグラフの凡例に出すのは、この期間に実際に時間があるカテゴリだけ。
  // 全カテゴリを並べると、色の付いていない名前ばかりが凡例を埋めて読みにくくなる。
  const usedCategoryIds = new Set(
    daily
      .flatMap((day) => day.byCategory.filter((item) => item.minutes > 0))
      .map((item) => item.categoryId),
  );

  return {
    range,
    categoryTotals,
    daily,
    categories: categories
      .filter((category) => usedCategoryIds.has(category.id))
      .map((category) => ({
        id: category.id,
        name: category.name,
        color: category.color,
      })),
    totalMinutes: categoryTotals.reduce((sum, total) => sum + total.minutes, 0),
    averageFocusMinutes: averageFocusMin(entries, range, now),
    estimates: comparisons,
    estimateSummary: estimateSummary(comparisons),
    unestimated: unestimatedWork(tasks, entriesForEstimate, now),
  };
}
