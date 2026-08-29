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
    if (categoryId === undefined) continue;

    for (const slice of splitEntryByDay(entry, now)) {
      if (!isInRange(slice.date, range)) continue;
      minutesByCategoryId.set(categoryId, (minutesByCategoryId.get(categoryId) ?? 0) + slice.minutes);
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
