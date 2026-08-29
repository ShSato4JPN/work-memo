import { describe, expect, it } from "vitest";
import { splitEntryByDay, type EntryLike } from "./aggregate";

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
});
