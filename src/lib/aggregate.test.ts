import { describe, expect, it } from "vitest";
import { minutesOnDate, splitEntryByDay, type EntryLike } from "./aggregate";
import { sumByCategory, taskActualMinutes, type CategoryLike, type TaskLike } from "./aggregate";
import { averageFocusMin, countInterruptions, dailyTotals, estimateComparisons } from "./aggregate";

function entry(partial: Partial<EntryLike> & { startedAt: Date }): EntryLike {
  return {
    id: 1,
    taskId: 1,
    endedAt: null,
    parentEntryId: null,
    ...partial,
  };
}

describe("splitEntryByDay", () => {
  it("同一日に収まるエントリは1スライスになる", () => {
    const result = splitEntryByDay(
      entry({
        startedAt: new Date(2026, 7, 29, 10, 0),
        endedAt: new Date(2026, 7, 29, 11, 30),
      }),
      new Date(2026, 7, 29, 12, 0),
    );
    expect(result).toEqual([{ date: "2026-08-29", minutes: 90 }]);
  });

  it("日を跨ぐエントリは日ごとに分割される", () => {
    const result = splitEntryByDay(
      entry({
        startedAt: new Date(2026, 7, 29, 23, 30),
        endedAt: new Date(2026, 7, 30, 0, 30),
      }),
      new Date(2026, 7, 30, 1, 0),
    );
    expect(result).toEqual([
      { date: "2026-08-29", minutes: 30 },
      { date: "2026-08-30", minutes: 30 },
    ]);
  });

  it("計測中のエントリは now までを対象にする", () => {
    const result = splitEntryByDay(
      entry({ startedAt: new Date(2026, 7, 29, 9, 0), endedAt: null }),
      new Date(2026, 7, 29, 9, 45),
    );
    expect(result).toEqual([{ date: "2026-08-29", minutes: 45 }]);
  });

  it("開始直後で経過0分なら空配列を返す", () => {
    const at = new Date(2026, 7, 29, 9, 0);
    expect(splitEntryByDay(entry({ startedAt: at, endedAt: null }), at)).toEqual([]);
  });

  it("endedAt が startedAt より前の逆転データは空配列を返す（0分として扱う契約）", () => {
    const result = splitEntryByDay(
      entry({
        startedAt: new Date(2026, 7, 29, 10, 0),
        endedAt: new Date(2026, 7, 29, 9, 0),
      }),
      new Date(2026, 7, 29, 12, 0),
    );
    expect(result).toEqual([]);
  });
});

describe("minutesOnDate", () => {
  it("日を跨ぐエントリは、その日に属する分だけを返す（ログ行と合計を一致させる）", () => {
    const crossMidnight = entry({
      startedAt: new Date(2026, 7, 29, 23, 30),
      endedAt: new Date(2026, 7, 30, 0, 30),
    });
    const now = new Date(2026, 7, 30, 1, 0);

    expect(minutesOnDate(crossMidnight, "2026-08-29", now)).toBe(30);
    expect(minutesOnDate(crossMidnight, "2026-08-30", now)).toBe(30);
  });

  it("その日に属さないエントリは0分を返す", () => {
    expect(
      minutesOnDate(
        entry({
          startedAt: new Date(2026, 7, 29, 9, 0),
          endedAt: new Date(2026, 7, 29, 10, 0),
        }),
        "2026-08-30",
        new Date(2026, 7, 30, 1, 0),
      ),
    ).toBe(0);
  });

  it("計測中のエントリは now までのうち、その日に属する分を返す", () => {
    expect(
      minutesOnDate(
        entry({ startedAt: new Date(2026, 7, 29, 23, 30), endedAt: null }),
        "2026-08-30",
        new Date(2026, 7, 30, 0, 15),
      ),
    ).toBe(15);
  });
});

const CATEGORIES: CategoryLike[] = [
  { id: 1, name: "開発", color: "#2563eb" },
  { id: 2, name: "調査", color: "#f59e0b" },
];

const TASKS: TaskLike[] = [
  { id: 10, title: "認証機能の実装", categoryId: 1, estimateMin: 120 },
  { id: 20, title: "認証ライブラリの調査", categoryId: 2, estimateMin: 60 },
];

describe("sumByCategory", () => {
  it("タスク経由でカテゴリ別に合計し、多い順に並べる", () => {
    const entries: EntryLike[] = [
      entry({
        id: 1,
        taskId: 10,
        startedAt: new Date(2026, 7, 29, 9, 0),
        endedAt: new Date(2026, 7, 29, 10, 0),
      }),
      entry({
        id: 2,
        taskId: 20,
        startedAt: new Date(2026, 7, 29, 10, 0),
        endedAt: new Date(2026, 7, 29, 12, 0),
      }),
    ];
    const result = sumByCategory(
      entries,
      TASKS,
      CATEGORIES,
      { from: "2026-08-29", to: "2026-08-29" },
      new Date(2026, 7, 29, 13, 0),
    );
    expect(result).toEqual([
      { categoryId: 2, name: "調査", color: "#f59e0b", minutes: 120 },
      { categoryId: 1, name: "開発", color: "#2563eb", minutes: 60 },
    ]);
  });

  it("期間外のスライスは含めない", () => {
    const entries: EntryLike[] = [
      entry({
        id: 1,
        taskId: 10,
        startedAt: new Date(2026, 7, 28, 23, 30),
        endedAt: new Date(2026, 7, 29, 0, 30),
      }),
    ];
    const result = sumByCategory(
      entries,
      TASKS,
      CATEGORIES,
      { from: "2026-08-29", to: "2026-08-29" },
      new Date(2026, 7, 29, 1, 0),
    );
    expect(result).toEqual([{ categoryId: 1, name: "開発", color: "#2563eb", minutes: 30 }]);
  });

  it("合計0のカテゴリは返さない", () => {
    const result = sumByCategory(
      [],
      TASKS,
      CATEGORIES,
      { from: "2026-08-29", to: "2026-08-29" },
      new Date(2026, 7, 29, 1, 0),
    );
    expect(result).toEqual([]);
  });

  it("tasks に存在しない taskId の entry は無視する（仕様）", () => {
    const entries: EntryLike[] = [
      entry({
        id: 1,
        taskId: 999,
        startedAt: new Date(2026, 7, 29, 9, 0),
        endedAt: new Date(2026, 7, 29, 10, 0),
      }),
    ];
    const result = sumByCategory(
      entries,
      TASKS,
      CATEGORIES,
      { from: "2026-08-29", to: "2026-08-29" },
      new Date(2026, 7, 29, 11, 0),
    );
    expect(result).toEqual([]);
  });
});

describe("taskActualMinutes", () => {
  it("タスクごとの実績合計を返す", () => {
    const entries: EntryLike[] = [
      entry({
        id: 1,
        taskId: 10,
        startedAt: new Date(2026, 7, 29, 9, 0),
        endedAt: new Date(2026, 7, 29, 10, 0),
      }),
      entry({
        id: 2,
        taskId: 10,
        startedAt: new Date(2026, 7, 29, 11, 0),
        endedAt: new Date(2026, 7, 29, 11, 30),
      }),
    ];
    const result = taskActualMinutes(entries, new Date(2026, 7, 29, 12, 0));
    expect(result.get(10)).toBe(90);
  });
});

describe("countInterruptions", () => {
  it("parentEntryId を持つエントリを期間内で数える", () => {
    const entries: EntryLike[] = [
      entry({
        id: 1,
        taskId: 10,
        startedAt: new Date(2026, 7, 29, 9, 0),
        endedAt: new Date(2026, 7, 29, 9, 30),
      }),
      entry({
        id: 2,
        taskId: 20,
        startedAt: new Date(2026, 7, 29, 9, 30),
        endedAt: new Date(2026, 7, 29, 10, 0),
        parentEntryId: 1,
      }),
      entry({
        id: 3,
        taskId: 20,
        startedAt: new Date(2026, 7, 30, 9, 30),
        endedAt: new Date(2026, 7, 30, 10, 0),
        parentEntryId: 1,
      }),
    ];
    expect(countInterruptions(entries, { from: "2026-08-29", to: "2026-08-29" })).toBe(1);
    expect(countInterruptions(entries, { from: "2026-08-29", to: "2026-08-30" })).toBe(2);
  });
});

describe("averageFocusMin", () => {
  it("期間内に開始したエントリの平均継続時間を返す", () => {
    const entries: EntryLike[] = [
      entry({
        id: 1,
        taskId: 10,
        startedAt: new Date(2026, 7, 29, 9, 0),
        endedAt: new Date(2026, 7, 29, 10, 0),
      }),
      entry({
        id: 2,
        taskId: 10,
        startedAt: new Date(2026, 7, 29, 10, 0),
        endedAt: new Date(2026, 7, 29, 10, 30),
      }),
    ];
    expect(
      averageFocusMin(
        entries,
        { from: "2026-08-29", to: "2026-08-29" },
        new Date(2026, 7, 29, 11, 0),
      ),
    ).toBe(45);
  });

  it("対象エントリがなければ0を返す", () => {
    expect(
      averageFocusMin([], { from: "2026-08-29", to: "2026-08-29" }, new Date(2026, 7, 29, 11, 0)),
    ).toBe(0);
  });

  it("期間の前日に開始し期間内に終了したエントリは対象外になる", () => {
    const entries: EntryLike[] = [
      entry({
        id: 1,
        taskId: 10,
        startedAt: new Date(2026, 7, 28, 23, 30),
        endedAt: new Date(2026, 7, 29, 0, 30),
      }),
    ];
    expect(
      averageFocusMin(
        entries,
        { from: "2026-08-29", to: "2026-08-29" },
        new Date(2026, 7, 29, 1, 0),
      ),
    ).toBe(0);
  });

  it("期間内に開始し期間外に終了したエントリは全継続時間で平均に入る", () => {
    const entries: EntryLike[] = [
      entry({
        id: 1,
        taskId: 10,
        startedAt: new Date(2026, 7, 29, 23, 30),
        endedAt: new Date(2026, 7, 30, 1, 30),
      }),
    ];
    expect(
      averageFocusMin(
        entries,
        { from: "2026-08-29", to: "2026-08-29" },
        new Date(2026, 7, 30, 2, 0),
      ),
    ).toBe(120);
  });
});

describe("estimateComparisons", () => {
  it("見積もりのあるタスクだけ実績と比較する", () => {
    const tasks: TaskLike[] = [
      { id: 10, title: "認証機能の実装", categoryId: 1, estimateMin: 60 },
      { id: 20, title: "見積もりなしタスク", categoryId: 1, estimateMin: null },
    ];
    const entries: EntryLike[] = [
      entry({
        id: 1,
        taskId: 10,
        startedAt: new Date(2026, 7, 29, 9, 0),
        endedAt: new Date(2026, 7, 29, 10, 30),
      }),
      entry({
        id: 2,
        taskId: 20,
        startedAt: new Date(2026, 7, 29, 11, 0),
        endedAt: new Date(2026, 7, 29, 12, 0),
      }),
    ];
    expect(estimateComparisons(tasks, entries, new Date(2026, 7, 29, 13, 0))).toEqual([
      {
        taskId: 10,
        title: "認証機能の実装",
        estimateMin: 60,
        actualMin: 90,
        diffMin: 30,
        ratio: 1.5,
      },
    ]);
  });

  it("実績0のタスクは含めない", () => {
    const tasks: TaskLike[] = [{ id: 10, title: "未着手", categoryId: 1, estimateMin: 60 }];
    expect(estimateComparisons(tasks, [], new Date(2026, 7, 29, 13, 0))).toEqual([]);
  });

  it("見積もりが0のタスクは含めない（ゼロ除算を避ける）", () => {
    const tasks: TaskLike[] = [{ id: 10, title: "見積もり0タスク", categoryId: 1, estimateMin: 0 }];
    const entries: EntryLike[] = [
      entry({
        id: 1,
        taskId: 10,
        startedAt: new Date(2026, 7, 29, 9, 0),
        endedAt: new Date(2026, 7, 29, 10, 0),
      }),
    ];
    expect(estimateComparisons(tasks, entries, new Date(2026, 7, 29, 13, 0))).toEqual([]);
  });
});

describe("dailyTotals", () => {
  it("期間内の全日を、作業のない日も含めて返す", () => {
    const entries: EntryLike[] = [
      entry({
        id: 1,
        taskId: 10,
        startedAt: new Date(2026, 7, 29, 9, 0),
        endedAt: new Date(2026, 7, 29, 10, 0),
      }),
    ];
    const result = dailyTotals(
      entries,
      TASKS,
      { from: "2026-08-29", to: "2026-08-30" },
      new Date(2026, 7, 30, 12, 0),
    );
    expect(result).toEqual([
      { date: "2026-08-29", byCategory: [{ categoryId: 1, minutes: 60 }] },
      { date: "2026-08-30", byCategory: [] },
    ]);
  });
});
