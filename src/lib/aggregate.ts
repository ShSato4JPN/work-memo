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
