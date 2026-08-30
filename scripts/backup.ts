/**
 * その日のデータを backups/YYYY-MM-DD.json に書き出す。
 *
 * 1日1ファイル。同じ日に何度走らせても上書きされるだけなので、
 * アプリを触るたびに実行しても構わない（pnpm dev の前に自動で走る）。
 *
 *   pnpm backup           通常のバックアップ
 *   pnpm backup --force   記録が減っていても上書きする
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  BACKUP_DIR,
  isSafeToOverwrite,
  parseSnapshot,
  SNAPSHOT_VERSION,
  type Snapshot,
} from "./backup-format";
import { createPrismaClient } from "./prisma-client";

/** ローカルタイムの YYYY-MM-DD。UTC にすると日本時間の朝が前日のファイルになる */
function todayKey(now: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function toIso(date: Date | null): string | null {
  return date === null ? null : date.toISOString();
}

async function main() {
  const force = process.argv.includes("--force");
  const prisma = createPrismaClient();

  try {
    const [categories, tasks, entries] = await Promise.all([
      prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
      prisma.task.findMany({ include: { category: true }, orderBy: { id: "asc" } }),
      prisma.entry.findMany({ include: { task: true }, orderBy: { id: "asc" } }),
    ]);

    // 親記録の参照を自然キーに置き換えるための対応表
    const entryById = new Map(entries.map((entry) => [entry.id, entry]));

    const snapshot: Snapshot = {
      version: SNAPSHOT_VERSION,
      exportedAt: new Date().toISOString(),
      categories: categories.map((category) => ({
        name: category.name,
        color: category.color,
        sortOrder: category.sortOrder,
        archived: category.archived,
      })),
      tasks: tasks.map((task) => ({
        title: task.title,
        categoryName: task.category.name,
        estimateMin: task.estimateMin,
        status: task.status,
        archived: task.archived,
        createdAt: task.createdAt.toISOString(),
        completedAt: toIso(task.completedAt),
      })),
      entries: entries.map((entry) => {
        const parent = entry.parentEntryId === null ? null : entryById.get(entry.parentEntryId);
        return {
          taskTitle: entry.task.title,
          startedAt: entry.startedAt.toISOString(),
          endedAt: toIso(entry.endedAt),
          note: entry.note,
          parentEntry:
            parent === undefined || parent === null
              ? null
              : { taskTitle: parent.task.title, startedAt: parent.startedAt.toISOString() },
        };
      }),
    };

    mkdirSync(BACKUP_DIR, { recursive: true });
    const filePath = join(BACKUP_DIR, `${todayKey(new Date())}.json`);

    // 既に今日のファイルがあるなら、記録が減っていないかを確かめてから上書きする。
    // データが消えたあとにバックアップが走ると、空のファイルで良い控えを潰してしまう。
    let previous: Snapshot | null = null;
    try {
      previous = parseSnapshot(JSON.parse(readFileSync(filePath, "utf8")), filePath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") throw error;
    }

    if (previous && !isSafeToOverwrite(previous, snapshot) && !force) {
      console.error(
        `中止しました: ${filePath} には記録が ${previous.entries.length} 件ありますが、` +
          `いまのデータは ${snapshot.entries.length} 件です。\n` +
          "データが消えている可能性があります。意図した上書きなら --force を付けてください。",
      );
      process.exitCode = 1;
      return;
    }

    writeFileSync(filePath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    console.log(
      `バックアップしました: ${filePath}\n` +
        `  カテゴリ ${snapshot.categories.length}件 / タスク ${snapshot.tasks.length}件 / 記録 ${snapshot.entries.length}件`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
