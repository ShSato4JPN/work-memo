import { prisma } from "@/lib/prisma";

export type TimerBarTask = {
  id: number;
  title: string;
  categoryName: string;
  categoryColor: string;
  estimateMin: number | null;
  /** 直近に作業した日時。パレットの並び順に使う */
  lastWorkedAt: Date | null;
};

export type TimerBarView = {
  running: {
    entryId: number;
    taskId: number;
    title: string;
    categoryName: string;
    categoryColor: string;
    estimateMin: number | null;
    startedAt: Date;
    /** このタスクの実績合計（分）。計測中の分は含まない。ゲージの起点になる */
    priorMinutes: number;
  } | null;
  /** パレットに出す候補。よく使う順（直近作業日時の降順） */
  tasks: TimerBarTask[];
  categories: { id: number; name: string; color: string }[];
};

const MS_PER_MIN = 60_000;

/**
 * 全画面に常駐する計測バーが必要とするデータ。
 * 「今日」の集計とは用途が別なので getTodayView とは独立させている。
 */
export async function getTimerBarView(): Promise<TimerBarView> {
  const [runningEntry, tasks, categories] = await Promise.all([
    prisma.entry.findFirst({
      where: { endedAt: null },
      include: { task: { include: { category: true } } },
    }),
    prisma.task.findMany({
      where: { archived: false, status: { in: ["todo", "doing"] } },
      include: { category: true, entries: { select: { startedAt: true } } },
    }),
    prisma.category.findMany({ where: { archived: false }, orderBy: { sortOrder: "asc" } }),
  ]);

  let running: TimerBarView["running"] = null;

  if (runningEntry) {
    const finished = await prisma.entry.findMany({
      where: { taskId: runningEntry.taskId, endedAt: { not: null } },
      select: { startedAt: true, endedAt: true },
    });
    const priorMinutes = finished.reduce(
      (sum, entry) => sum + (entry.endedAt!.getTime() - entry.startedAt.getTime()) / MS_PER_MIN,
      0,
    );

    running = {
      entryId: runningEntry.id,
      taskId: runningEntry.taskId,
      title: runningEntry.task.title,
      categoryName: runningEntry.task.category.name,
      categoryColor: runningEntry.task.category.color,
      estimateMin: runningEntry.task.estimateMin,
      startedAt: runningEntry.startedAt,
      priorMinutes,
    };
  }

  const withLastWorked: TimerBarTask[] = tasks.map((task) => ({
    id: task.id,
    title: task.title,
    categoryName: task.category.name,
    categoryColor: task.category.color,
    estimateMin: task.estimateMin,
    lastWorkedAt: task.entries.reduce<Date | null>(
      (latest, entry) => (latest === null || entry.startedAt > latest ? entry.startedAt : latest),
      null,
    ),
  }));

  withLastWorked.sort((a, b) => {
    // 作業履歴のあるタスクを先に、その中では直近に触ったものから
    if (a.lastWorkedAt && b.lastWorkedAt)
      return b.lastWorkedAt.getTime() - a.lastWorkedAt.getTime();
    if (a.lastWorkedAt) return -1;
    if (b.lastWorkedAt) return 1;
    return b.id - a.id;
  });

  return {
    running,
    tasks: withLastWorked,
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
    })),
  };
}
