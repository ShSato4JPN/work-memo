import { describe, expect, it } from "vitest";
import {
  groupBlocksByTask,
  initialScrollLeft,
  layoutDay,
  type TimelineInput,
} from "@/lib/timeline";

function input(partial: Partial<TimelineInput> & { startedAt: Date }): TimelineInput {
  return {
    id: 1,
    taskId: 1,
    title: "タスク",
    categoryColor: "#4c8df6",
    endedAt: null,
    ...partial,
  };
}

const DAY = new Date(2026, 7, 29);
const NOW = new Date(2026, 7, 29, 23, 0);

describe("layoutDay", () => {
  it("開始と終了から、その日の中の位置と高さを分の単位で返す", () => {
    const [block] = layoutDay(
      [
        input({
          startedAt: new Date(2026, 7, 29, 9, 0),
          endedAt: new Date(2026, 7, 29, 10, 30),
        }),
      ],
      DAY,
      NOW,
    );

    expect(block.startMinute).toBe(9 * 60);
    expect(block.endMinute).toBe(10 * 60 + 30);
  });

  it("重なっていないブロックは、どれも全幅を使う", () => {
    const blocks = layoutDay(
      [
        input({
          id: 1,
          startedAt: new Date(2026, 7, 29, 9, 0),
          endedAt: new Date(2026, 7, 29, 10, 0),
        }),
        input({
          id: 2,
          startedAt: new Date(2026, 7, 29, 11, 0),
          endedAt: new Date(2026, 7, 29, 12, 0),
        }),
      ],
      DAY,
      NOW,
    );

    expect(blocks.map((block) => [block.column, block.columnCount])).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });

  it("重なったブロックは横に並べ、同じ重なりの中では列数を揃える", () => {
    const blocks = layoutDay(
      [
        input({
          id: 1,
          startedAt: new Date(2026, 7, 29, 9, 0),
          endedAt: new Date(2026, 7, 29, 11, 0),
        }),
        input({
          id: 2,
          startedAt: new Date(2026, 7, 29, 10, 0),
          endedAt: new Date(2026, 7, 29, 12, 0),
        }),
      ],
      DAY,
      NOW,
    );

    expect(blocks.map((block) => block.column)).toEqual([0, 1]);
    // 同じ重なりに属するので、幅の分母は揃っていなければならない
    expect(blocks.map((block) => block.columnCount)).toEqual([2, 2]);
  });

  it("3つ重なれば3列に割り、間に空きができれば列を再利用する", () => {
    const blocks = layoutDay(
      [
        input({
          id: 1,
          startedAt: new Date(2026, 7, 29, 9, 0),
          endedAt: new Date(2026, 7, 29, 12, 0),
        }),
        input({
          id: 2,
          startedAt: new Date(2026, 7, 29, 9, 30),
          endedAt: new Date(2026, 7, 29, 10, 0),
        }),
        input({
          id: 3,
          startedAt: new Date(2026, 7, 29, 9, 45),
          endedAt: new Date(2026, 7, 29, 11, 0),
        }),
        // 2 が終わったあとなので、空いた列を使い回せる
        input({
          id: 4,
          startedAt: new Date(2026, 7, 29, 10, 30),
          endedAt: new Date(2026, 7, 29, 11, 30),
        }),
      ],
      DAY,
      NOW,
    );

    const byId = new Map(blocks.map((block) => [block.id, block]));
    expect(byId.get(1)!.column).toBe(0);
    expect(byId.get(2)!.column).toBe(1);
    expect(byId.get(3)!.column).toBe(2);
    expect(byId.get(4)!.column).toBe(1);
    // 4 つとも同じ重なりのかたまりに属する
    expect(blocks.every((block) => block.columnCount === 3)).toBe(true);
  });

  it("計測中のブロックは now まで伸ばし、計測中であることを示す", () => {
    const [block] = layoutDay(
      [input({ startedAt: new Date(2026, 7, 29, 22, 0), endedAt: null })],
      DAY,
      new Date(2026, 7, 29, 22, 30),
    );

    expect(block.endMinute).toBe(22 * 60 + 30);
    expect(block.running).toBe(true);
  });

  it("前日から続くブロックは、その日の 0 時から始まったものとして切り出す", () => {
    const [block] = layoutDay(
      [
        input({
          startedAt: new Date(2026, 7, 28, 23, 30),
          endedAt: new Date(2026, 7, 29, 0, 30),
        }),
      ],
      DAY,
      NOW,
    );

    expect(block.startMinute).toBe(0);
    expect(block.endMinute).toBe(30);
    expect(block.continuesFromPreviousDay).toBe(true);
  });

  it("翌日まで続くブロックは、その日の終わりで打ち切る", () => {
    const [block] = layoutDay(
      [
        input({
          startedAt: new Date(2026, 7, 29, 23, 30),
          endedAt: new Date(2026, 7, 30, 0, 30),
        }),
      ],
      DAY,
      new Date(2026, 7, 30, 1, 0),
    );

    expect(block.startMinute).toBe(23 * 60 + 30);
    expect(block.endMinute).toBe(24 * 60);
    expect(block.continuesToNextDay).toBe(true);
  });

  it("その日にかからないエントリは返さない", () => {
    expect(
      layoutDay(
        [
          input({
            startedAt: new Date(2026, 7, 28, 9, 0),
            endedAt: new Date(2026, 7, 28, 10, 0),
          }),
        ],
        DAY,
        NOW,
      ),
    ).toEqual([]);
  });

  it("長さ0のエントリも1件のブロックとして返す（最小の高さは描画側の責任）", () => {
    const at = new Date(2026, 7, 29, 9, 0);
    const [block] = layoutDay([input({ startedAt: at, endedAt: at })], DAY, NOW);

    expect(block.startMinute).toBe(9 * 60);
    expect(block.endMinute).toBe(9 * 60);
  });

  it("隙間なく連続しているだけの記録は、重なりとみなさず1列に収める", () => {
    const blocks = layoutDay(
      [
        input({
          id: 1,
          startedAt: new Date(2026, 7, 29, 9, 0),
          endedAt: new Date(2026, 7, 29, 9, 30),
        }),
        input({
          id: 2,
          startedAt: new Date(2026, 7, 29, 9, 30),
          endedAt: new Date(2026, 7, 29, 10, 0),
        }),
        // 長さ0の記録が挟まっても列は増えない
        input({
          id: 3,
          startedAt: new Date(2026, 7, 29, 10, 0),
          endedAt: new Date(2026, 7, 29, 10, 0),
        }),
      ],
      DAY,
      NOW,
    );

    expect(blocks.every((block) => block.column === 0)).toBe(true);
    expect(blocks.every((block) => block.columnCount === 1)).toBe(true);
  });
});

describe("groupBlocksByTask", () => {
  const day = new Date(2026, 7, 30);
  const now = new Date(2026, 7, 30, 12, 0);

  function input(
    id: number,
    taskId: number,
    title: string,
    fromHour: number,
    toHour: number,
  ): TimelineInput {
    return {
      id,
      taskId,
      title,
      categoryColor: "#4c8df6",
      startedAt: new Date(2026, 7, 30, fromHour, 0),
      endedAt: new Date(2026, 7, 30, toHour, 0),
    };
  }

  it("同じタスクの記録を1行にまとめ、合計時間を出す", () => {
    const blocks = layoutDay([input(1, 10, "実装", 9, 10), input(2, 10, "実装", 11, 12)], day, now);

    const rows = groupBlocksByTask(blocks);

    expect(rows).toHaveLength(1);
    expect(rows[0].taskId).toBe(10);
    expect(rows[0].blocks).toHaveLength(2);
    expect(rows[0].totalMinutes).toBe(120);
  });

  // 一日を左から右へ読むので、行の並びも最初に触った順にする
  it("行の順番はその日に最初に触った順になる", () => {
    const blocks = layoutDay(
      [input(1, 20, "あとから", 11, 12), input(2, 10, "さきに", 9, 10)],
      day,
      now,
    );

    expect(groupBlocksByTask(blocks).map((row) => row.title)).toEqual(["さきに", "あとから"]);
  });

  it("記録がなければ行もない", () => {
    expect(groupBlocksByTask([])).toEqual([]);
  });
});

describe("initialScrollLeft", () => {
  const day = new Date(2026, 7, 30);
  const now = new Date(2026, 7, 30, 12, 0);

  function blocksFrom(hour: number) {
    return layoutDay(
      [
        {
          id: 1,
          taskId: 1,
          title: "実装",
          categoryColor: "#4c8df6",
          startedAt: new Date(2026, 7, 30, hour, 0),
          endedAt: new Date(2026, 7, 30, hour + 1, 0),
        },
      ],
      day,
      now,
    );
  }

  it("最初の記録の30分手前まで寄せる", () => {
    expect(initialScrollLeft(blocksFrom(9), 1)).toBe(9 * 60 - 30);
  });

  it("0時台の記録では左端のまま（負の位置にしない）", () => {
    expect(initialScrollLeft(blocksFrom(0), 1)).toBe(0);
  });

  it("記録がなければ左端", () => {
    expect(initialScrollLeft([], 1)).toBe(0);
  });
});
