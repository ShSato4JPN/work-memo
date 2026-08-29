import { describe, expect, it } from "vitest";
import {
  entryKey,
  isSafeToOverwrite,
  parseSnapshot,
  SNAPSHOT_VERSION,
  sortBackupFileNames,
  type Snapshot,
} from "../../scripts/backup-format";

function snapshot(partial: Partial<Snapshot> = {}): Snapshot {
  return {
    version: SNAPSHOT_VERSION,
    exportedAt: "2026-08-30T00:00:00.000Z",
    categories: [],
    tasks: [],
    entries: [],
    ...partial,
  };
}

function entry(taskTitle: string, startedAt: string) {
  return { taskTitle, startedAt, endedAt: null, note: null, parentEntry: null };
}

describe("entryKey", () => {
  it("タスクと開始時刻が同じなら同じキーになる", () => {
    expect(entryKey({ taskTitle: "実装", startedAt: "2026-08-30T00:07:00.000Z" })).toBe(
      entryKey({ taskTitle: "実装", startedAt: "2026-08-30T00:07:00.000Z" }),
    );
  });

  it("開始時刻が違えば別のキーになる", () => {
    expect(entryKey({ taskTitle: "実装", startedAt: "2026-08-30T00:07:00.000Z" })).not.toBe(
      entryKey({ taskTitle: "実装", startedAt: "2026-08-30T00:08:00.000Z" }),
    );
  });

  it("同じ時刻でもタスクが違えば別のキーになる", () => {
    expect(entryKey({ taskTitle: "実装", startedAt: "2026-08-30T00:07:00.000Z" })).not.toBe(
      entryKey({ taskTitle: "調査", startedAt: "2026-08-30T00:07:00.000Z" }),
    );
  });
});

describe("sortBackupFileNames", () => {
  it("日付の古い順に並べる", () => {
    expect(sortBackupFileNames(["2026-09-01.json", "2026-08-30.json", "2026-08-31.json"])).toEqual([
      "2026-08-30.json",
      "2026-08-31.json",
      "2026-09-01.json",
    ]);
  });

  it("json 以外は対象にしない", () => {
    expect(sortBackupFileNames([".gitkeep", "README.md", "2026-08-30.json"])).toEqual([
      "2026-08-30.json",
    ]);
  });
});

describe("parseSnapshot", () => {
  it("正しい形なら通す", () => {
    const value = snapshot();
    expect(parseSnapshot(value, "test.json")).toEqual(value);
  });

  it("版数が違えば弾く", () => {
    expect(() => parseSnapshot({ ...snapshot(), version: 99 }, "test.json")).toThrow(
      /対応していないバージョン/,
    );
  });

  it("配列であるべき項目が欠けていれば弾く", () => {
    const { entries: _entries, ...rest } = snapshot();
    expect(() => parseSnapshot(rest, "test.json")).toThrow(/entries/);
  });

  it("オブジェクトでなければ弾く", () => {
    expect(() => parseSnapshot(null, "test.json")).toThrow(/形式ではありません/);
    expect(() => parseSnapshot([], "test.json")).toThrow(/形式ではありません/);
  });
});

// データが消えたあとにバックアップが走ると、空のファイルがその日の控えを潰してしまう。
// バックアップ自身がデータ消失を広げないことを、ここで固定する。
describe("isSafeToOverwrite", () => {
  it("記録が減っていれば上書きさせない", () => {
    const previous = snapshot({ entries: [entry("実装", "2026-08-30T00:07:00.000Z")] });
    const next = snapshot({ entries: [] });

    expect(isSafeToOverwrite(previous, next)).toBe(false);
  });

  it("記録が増えていれば上書きしてよい", () => {
    const previous = snapshot({ entries: [entry("実装", "2026-08-30T00:07:00.000Z")] });
    const next = snapshot({
      entries: [
        entry("実装", "2026-08-30T00:07:00.000Z"),
        entry("調査", "2026-08-30T01:00:00.000Z"),
      ],
    });

    expect(isSafeToOverwrite(previous, next)).toBe(true);
  });

  it("同じ件数なら上書きしてよい（同じ日に何度走らせても通る）", () => {
    const previous = snapshot({ entries: [entry("実装", "2026-08-30T00:07:00.000Z")] });
    const next = snapshot({ entries: [entry("実装", "2026-08-30T00:07:00.000Z")] });

    expect(isSafeToOverwrite(previous, next)).toBe(true);
  });
});
