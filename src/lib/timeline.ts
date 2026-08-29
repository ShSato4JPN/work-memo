import { addDays, startOfDay } from "date-fns";

export type TimelineInput = {
  id: number;
  taskId: number;
  title: string;
  categoryColor: string;
  startedAt: Date;
  /** null なら計測中 */
  endedAt: Date | null;
};

export type TimelineBlock = {
  id: number;
  taskId: number;
  title: string;
  categoryColor: string;
  /** その日の 0 時を 0 とした分。0〜1440 */
  startMinute: number;
  endMinute: number;
  /** 重なりの中での列位置（0 始まり）と、そのかたまりの列数 */
  column: number;
  columnCount: number;
  running: boolean;
  continuesFromPreviousDay: boolean;
  continuesToNextDay: boolean;
};

const MS_PER_MIN = 60_000;

/**
 * 1日分のエントリを、時間軸上のブロックに変換する。
 *
 * 並行計測では区間が重なりうるので、重なり合うものを横に並べる
 * （カレンダーが同時刻の予定を並べるのと同じ考え方）。
 *
 * 列の割り当ては 2 段階で行う:
 *   1. 開始順に見て、既に空いた列があれば再利用する
 *   2. 重なりが完全に途切れたところで「かたまり」を閉じ、その中の列数を全員に配る
 * こうすると、同じかたまりに属するブロックの幅の分母が揃う。
 */
export function layoutDay(entries: TimelineInput[], day: Date, now: Date): TimelineBlock[] {
  const dayStart = startOfDay(day);
  const dayEnd = addDays(dayStart, 1);

  const clipped = entries
    .map((entry) => {
      const rawEnd = entry.endedAt ?? now;
      // 開始より前に終わっている不正なデータは、その日には描けない
      if (rawEnd < entry.startedAt) return null;
      if (entry.startedAt >= dayEnd || rawEnd < dayStart) return null;

      const start = entry.startedAt < dayStart ? dayStart : entry.startedAt;
      const end = rawEnd > dayEnd ? dayEnd : rawEnd;

      const startMinute = (start.getTime() - dayStart.getTime()) / MS_PER_MIN;
      const rawEndMinute = (end.getTime() - dayStart.getTime()) / MS_PER_MIN;

      return {
        entry,
        startMinute,
        // 実際の終了時刻をそのまま使う。短すぎるブロックを潰さないための最小の高さは
        // 描画側の都合なので、ここで水増しすると連続しただけの記録が「重なっている」と
        // 誤判定され、列が無駄に増えてしまう。
        endMinute: Math.min(rawEndMinute, 24 * 60),
        continuesFromPreviousDay: entry.startedAt < dayStart,
        continuesToNextDay: rawEnd > dayEnd,
      };
    })
    .filter((value): value is NonNullable<typeof value> => value !== null)
    .sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute);

  const blocks: TimelineBlock[] = [];
  // 現在のかたまりの中で、各列が何分まで埋まっているか
  let columnEnds: number[] = [];
  let clusterStart = 0;

  function closeCluster(untilIndex: number) {
    const columnCount = Math.max(columnEnds.length, 1);
    for (let i = clusterStart; i < untilIndex; i += 1) {
      blocks[i].columnCount = columnCount;
    }
    columnEnds = [];
    clusterStart = untilIndex;
  }

  clipped.forEach((item, index) => {
    // どの列とも重ならなくなったら、そこでかたまりが切れる
    if (columnEnds.length > 0 && columnEnds.every((end) => end <= item.startMinute)) {
      closeCluster(index);
    }

    let column = columnEnds.findIndex((end) => end <= item.startMinute);
    if (column === -1) {
      column = columnEnds.length;
    }
    columnEnds[column] = item.endMinute;

    blocks.push({
      id: item.entry.id,
      taskId: item.entry.taskId,
      title: item.entry.title,
      categoryColor: item.entry.categoryColor,
      startMinute: item.startMinute,
      endMinute: item.endMinute,
      column,
      // かたまりを閉じるときに確定させる
      columnCount: 1,
      running: item.entry.endedAt === null,
      continuesFromPreviousDay: item.continuesFromPreviousDay,
      continuesToNextDay: item.continuesToNextDay,
    });
  });

  closeCluster(blocks.length);

  return blocks;
}

export type TimelineRow = {
  taskId: number;
  title: string;
  blocks: TimelineBlock[];
  /** その日にこのタスクへ使った分の合計。行の見出しに出す */
  totalMinutes: number;
};

/**
 * ブロックをタスクごとの行にまとめる。
 *
 * 行の順番は「その日に最初に触った順」。layoutDay が開始の早い順に返すので、
 * 初出の順に足していけばそのまま並ぶ。名前順や合計時間順にすると、
 * 一日を左から右へ読むという時間軸の読み方と行の並びが噛み合わなくなる。
 */
export function groupBlocksByTask(blocks: TimelineBlock[]): TimelineRow[] {
  const rows = new Map<number, TimelineRow>();

  for (const block of blocks) {
    const minutes = block.endMinute - block.startMinute;
    const row = rows.get(block.taskId);
    if (row) {
      row.blocks.push(block);
      row.totalMinutes += minutes;
      continue;
    }
    rows.set(block.taskId, {
      taskId: block.taskId,
      title: block.title,
      blocks: [block],
      totalMinutes: minutes,
    });
  }

  return [...rows.values()];
}

/**
 * 横スクロールの初期位置（px）。
 * 24時間ぶんの幅があるので、開いた時点で記録のある時間帯が見えるところまで寄せる。
 * 少し手前（30分ぶん）から見せて、最初の記録が画面の端に貼り付かないようにする。
 */
export function initialScrollLeft(blocks: TimelineBlock[], pxPerMinute: number): number {
  if (blocks.length === 0) return 0;
  const firstMinute = Math.min(...blocks.map((block) => block.startMinute));
  return Math.max(0, (firstMinute - 30) * pxPerMinute);
}
