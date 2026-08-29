import { addDays, format, startOfDay } from "date-fns";

export type EntryLike = {
  id: number;
  taskId: number;
  startedAt: Date;
  endedAt: Date | null;
  parentEntryId: number | null;
};

export type DaySlice = { date: string; minutes: number };

const MS_PER_MIN = 60_000;

/** ローカルタイムの 'yyyy-MM-dd' に変換する */
export function toDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

/**
 * エントリをローカルタイムの日境界で分割する。
 * endedAt が null（計測中）の場合は now までを対象にする。
 */
export function splitEntryByDay(entry: EntryLike, now: Date): DaySlice[] {
  const end = entry.endedAt ?? now;
  const slices: DaySlice[] = [];
  let cursor = entry.startedAt;

  while (cursor < end) {
    const nextDayStart = addDays(startOfDay(cursor), 1);
    const sliceEnd = nextDayStart < end ? nextDayStart : end;
    slices.push({
      date: toDateKey(cursor),
      minutes: (sliceEnd.getTime() - cursor.getTime()) / MS_PER_MIN,
    });
    cursor = sliceEnd;
  }

  return slices;
}

/**
 * エントリのうち、指定日（ローカルタイムの 'yyyy-MM-dd'）に属する分数。
 * 日を跨ぐエントリで「合計に計上された分」と「行に表示する分」を一致させるために使う。
 */
export function minutesOnDate(entry: EntryLike, dateKey: string, now: Date): number {
  return splitEntryByDay(entry, now)
    .filter((slice) => slice.date === dateKey)
    .reduce((sum, slice) => sum + slice.minutes, 0);
}

export type TaskLike = {
  id: number;
  title: string;
  categoryId: number;
  estimateMin: number | null;
};

export type CategoryLike = { id: number; name: string; color: string };

/** 'yyyy-MM-dd' の両端を含む期間 */
export type DateRange = { from: string; to: string };

export type CategoryTotal = {
  categoryId: number;
  name: string;
  color: string;
  minutes: number;
};

function isInRange(dateKey: string, range: DateRange): boolean {
  return dateKey >= range.from && dateKey <= range.to;
}

/** タスクIDごとの実績合計（分）。期間で絞らず全期間を対象にする */
export function taskActualMinutes(entries: EntryLike[], now: Date): Map<number, number> {
  const totals = new Map<number, number>();
  for (const entry of entries) {
    const minutes = splitEntryByDay(entry, now).reduce((sum, slice) => sum + slice.minutes, 0);
    totals.set(entry.taskId, (totals.get(entry.taskId) ?? 0) + minutes);
  }
  return totals;
}

/** カテゴリ別の合計時間（分）を多い順に返す。合計0のカテゴリは含めない */
export function sumByCategory(
  entries: EntryLike[],
  tasks: TaskLike[],
  categories: CategoryLike[],
  range: DateRange,
  now: Date,
): CategoryTotal[] {
  const categoryIdByTaskId = new Map(tasks.map((task) => [task.id, task.categoryId]));
  const minutesByCategoryId = new Map<number, number>();

  for (const entry of entries) {
    const categoryId = categoryIdByTaskId.get(entry.taskId);
    // 対応する task が見つからない entry はカテゴリ不明なので集計対象から除外する（仕様）
    if (categoryId === undefined) continue;

    for (const slice of splitEntryByDay(entry, now)) {
      if (!isInRange(slice.date, range)) continue;
      minutesByCategoryId.set(
        categoryId,
        (minutesByCategoryId.get(categoryId) ?? 0) + slice.minutes,
      );
    }
  }

  return categories
    .map((category) => ({
      categoryId: category.id,
      name: category.name,
      color: category.color,
      minutes: minutesByCategoryId.get(category.id) ?? 0,
    }))
    .filter((total) => total.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes);
}

export type DailyTotal = {
  date: string;
  byCategory: { categoryId: number; minutes: number }[];
};

export type EstimateComparison = {
  taskId: number;
  title: string;
  estimateMin: number;
  actualMin: number;
  diffMin: number;
  ratio: number;
};

/**
 * 1エントリあたりの平均継続時間（分）。集中の途切れにくさの指標。
 * 「期間内に開始した」エントリのみが対象であり、期間内の経過時間で按分しない。
 * そのため、期間内に開始して期間外まで続いたエントリは全継続時間が平均に含まれる一方、
 * 期間の前日に開始し期間内に終了したエントリは対象外になる。
 */
export function averageFocusMin(entries: EntryLike[], range: DateRange, now: Date): number {
  const targets = entries.filter((entry) => isInRange(toDateKey(entry.startedAt), range));
  if (targets.length === 0) return 0;

  const total = targets.reduce(
    (sum, entry) => sum + splitEntryByDay(entry, now).reduce((s, slice) => s + slice.minutes, 0),
    0,
  );
  return total / targets.length;
}

/** 日ごと・カテゴリごとの合計。作業のない日も空配列つきで返す（グラフの横軸を欠けさせないため） */
export function dailyTotals(
  entries: EntryLike[],
  tasks: TaskLike[],
  range: DateRange,
  now: Date,
): DailyTotal[] {
  const categoryIdByTaskId = new Map(tasks.map((task) => [task.id, task.categoryId]));
  const byDate = new Map<string, Map<number, number>>();

  for (const entry of entries) {
    const categoryId = categoryIdByTaskId.get(entry.taskId);
    // 対応する task が見つからない entry はカテゴリ不明なので集計対象から除外する（仕様）
    if (categoryId === undefined) continue;

    for (const slice of splitEntryByDay(entry, now)) {
      if (!isInRange(slice.date, range)) continue;
      const perCategory = byDate.get(slice.date) ?? new Map<number, number>();
      perCategory.set(categoryId, (perCategory.get(categoryId) ?? 0) + slice.minutes);
      byDate.set(slice.date, perCategory);
    }
  }

  const result: DailyTotal[] = [];
  let cursor = startOfDay(new Date(`${range.from}T00:00:00`));
  const last = startOfDay(new Date(`${range.to}T00:00:00`));

  while (cursor <= last) {
    const dateKey = toDateKey(cursor);
    const perCategory = byDate.get(dateKey);
    result.push({
      date: dateKey,
      byCategory: perCategory
        ? [...perCategory.entries()].map(([categoryId, minutes]) => ({ categoryId, minutes }))
        : [],
    });
    cursor = addDays(cursor, 1);
  }

  return result;
}

/** 見積もりと実績の比較。見積もり未設定・見積もり0、または実績0のタスクは対象外 */
export function estimateComparisons(
  tasks: TaskLike[],
  entries: EntryLike[],
  now: Date,
): EstimateComparison[] {
  const actuals = taskActualMinutes(entries, now);

  return tasks
    .filter(
      (task): task is TaskLike & { estimateMin: number } =>
        task.estimateMin !== null && task.estimateMin > 0,
    )
    .map((task) => {
      const actualMin = actuals.get(task.id) ?? 0;
      return {
        taskId: task.id,
        title: task.title,
        estimateMin: task.estimateMin,
        actualMin,
        diffMin: actualMin - task.estimateMin,
        ratio: actualMin / task.estimateMin,
      };
    })
    .filter((comparison) => comparison.actualMin > 0)
    .sort((a, b) => b.ratio - a.ratio);
}
