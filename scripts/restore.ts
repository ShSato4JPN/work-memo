/**
 * backups/ にあるバックアップを全て読み込み、いまのデータベースに取り込む。
 *
 * 取り込みは「足りないものを足す」だけで、既にあるものは触らない。既存データを
 * 消さないので、消えた分だけを復元する用途でも、丸ごと復元する用途でも同じように使える。
 * 何度走らせても結果は変わらない（自然キーで突き合わせて重複を作らない）。
 *
 *   pnpm restore             取り込む
 *   pnpm restore --dry-run   何が追加されるかだけ表示して、書き込まない
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createPrismaClient } from "./prisma-client";
import {
  BACKUP_DIR,
  entryKey,
  parseSnapshot,
  sortBackupFileNames,
  type Snapshot,
} from "./backup-format";

function readSnapshots(): { fileName: string; snapshot: Snapshot }[] {
  let fileNames: string[];
  try {
    fileNames = sortBackupFileNames(readdirSync(BACKUP_DIR));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`${BACKUP_DIR}/ がありません。先に pnpm backup を実行してください。`);
    }
    throw error;
  }

  // 壊れたファイルが1つあると途中で止まって中途半端な状態になるため、
  // 書き込みを始める前に全ファイルを読んで検証しておく。
  return fileNames.map((fileName) => {
    const filePath = join(BACKUP_DIR, fileName);
    return {
      fileName,
      snapshot: parseSnapshot(JSON.parse(readFileSync(filePath, "utf8")), filePath),
    };
  });
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const files = readSnapshots();

  if (files.length === 0) {
    console.log(`${BACKUP_DIR}/ にバックアップがありません。`);
    return;
  }
  console.log(
    `${files.length}件のバックアップを古い順に取り込みます: ${files.map((f) => f.fileName).join(", ")}`,
  );

  const prisma = createPrismaClient();
  const added = { categories: 0, tasks: 0, entries: 0 };

  try {
    // いまあるものを先に読み、以降はメモリ上の対応表で突き合わせる
    const categoryIdByName = new Map(
      (await prisma.category.findMany()).map((category) => [category.name, category.id]),
    );
    const taskIdByTitle = new Map(
      (await prisma.task.findMany()).map((task) => [task.title, task.id]),
    );
    const existingEntries = await prisma.entry.findMany({ include: { task: true } });
    const entryIdByKey = new Map(
      existingEntries.map((entry) => [
        entryKey({ taskTitle: entry.task.title, startedAt: entry.startedAt.toISOString() }),
        entry.id,
      ]),
    );

    // 親記録の解決は、参照先の記録が入ったあとでないとできないので後回しにする
    const parentLinks: { childKey: string; parentKey: string }[] = [];

    for (const { fileName, snapshot } of files) {
      for (const category of snapshot.categories) {
        if (categoryIdByName.has(category.name)) continue;
        if (dryRun) {
          categoryIdByName.set(category.name, -1);
        } else {
          const created = await prisma.category.create({
            data: {
              name: category.name,
              color: category.color,
              sortOrder: category.sortOrder,
              archived: category.archived,
            },
          });
          categoryIdByName.set(category.name, created.id);
        }
        added.categories += 1;
        console.log(`  + カテゴリ ${category.name}（${fileName}）`);
      }

      for (const task of snapshot.tasks) {
        if (taskIdByTitle.has(task.title)) continue;
        const categoryId = categoryIdByName.get(task.categoryName);
        if (categoryId === undefined) {
          console.warn(
            `  ! タスク「${task.title}」はカテゴリ「${task.categoryName}」が見つからず飛ばしました`,
          );
          continue;
        }
        if (dryRun) {
          taskIdByTitle.set(task.title, -1);
        } else {
          const created = await prisma.task.create({
            data: {
              title: task.title,
              categoryId,
              estimateMin: task.estimateMin,
              status: task.status,
              archived: task.archived,
              createdAt: new Date(task.createdAt),
              completedAt: task.completedAt === null ? null : new Date(task.completedAt),
            },
          });
          taskIdByTitle.set(task.title, created.id);
        }
        added.tasks += 1;
        console.log(`  + タスク ${task.title}（${fileName}）`);
      }

      for (const entry of snapshot.entries) {
        const key = entryKey(entry);
        if (entryIdByKey.has(key)) continue;
        const taskId = taskIdByTitle.get(entry.taskTitle);
        if (taskId === undefined) {
          console.warn(`  ! 記録 ${key} はタスクが見つからず飛ばしました`);
          continue;
        }
        if (dryRun) {
          entryIdByKey.set(key, -1);
        } else {
          const created = await prisma.entry.create({
            data: {
              taskId,
              startedAt: new Date(entry.startedAt),
              endedAt: entry.endedAt === null ? null : new Date(entry.endedAt),
              note: entry.note,
            },
          });
          entryIdByKey.set(key, created.id);
          if (entry.parentEntry) {
            parentLinks.push({ childKey: key, parentKey: entryKey(entry.parentEntry) });
          }
        }
        added.entries += 1;
      }
    }

    // 全ての記録が入ってから、中断元への参照をつなぎ直す
    for (const link of parentLinks) {
      const childId = entryIdByKey.get(link.childKey);
      const parentId = entryIdByKey.get(link.parentKey);
      if (childId === undefined || parentId === undefined) continue;
      await prisma.entry.update({ where: { id: childId }, data: { parentEntryId: parentId } });
    }

    const headline = dryRun ? "取り込まれる予定" : "取り込みました";
    console.log(
      `${headline}: カテゴリ ${added.categories}件 / タスク ${added.tasks}件 / 記録 ${added.entries}件`,
    );
    if (dryRun) console.log("--dry-run なので書き込んでいません。");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
