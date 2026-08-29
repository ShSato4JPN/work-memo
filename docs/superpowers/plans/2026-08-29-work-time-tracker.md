# 作業時間トラッカー Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 日々の作業をタイマーで記録し、日/週/月単位でカテゴリ別の時間配分・割り込み回数・見積もりズレを可視化するローカル Web アプリを作る。

**Architecture:** Next.js App Router の単一プロセスで画面と更新処理を完結させる。データは Prisma 経由でローカルの SQLite ファイルに保存する。集計ロジックは DB に触らない純粋関数として `src/lib/aggregate.ts` に隔離し、そこにテストを集中させる。画面は原則 Server Component とし、`use client` は経過時間のカウントアップなどクライアント状態が必要な箇所に限定する。

**Tech Stack:** Next.js 16 (App Router) / React 19 / TypeScript / Prisma 7 + SQLite / shadcn/ui + Tailwind CSS v4 / Recharts / Vitest / oxlint / oxfmt

**Spec:** `docs/superpowers/specs/2026-08-29-work-time-tracker-design.md`

## Global Constraints

- Node.js 24 系（検証環境: v24.1.0 / npm 11.3.0）を前提とする。
- **Prisma は `prisma` `@prisma/client` ともに `7.10.0` で固定する。** npm の `prisma` パッケージは `latest` タグが `8.0.0-rc.12`（リリース候補）を指しており、`@prisma/client` の `latest`（`7.10.0`）とメジャーバージョンがずれる。`@latest` でのインストールは禁止。
- ESLint / Prettier は導入しない。Lint は `oxlint`、フォーマットは `oxfmt` のみを使う。`create-next-app` は必ず `--no-eslint` を付ける。
- テストランナーは Vitest。UI コンポーネントのテストは書かない。テストは `src/lib/aggregate.ts` の集計ロジックと Server Actions のタイマー操作に限定する。
- 時刻の唯一の真実は DB の `startedAt` とする。クライアントは経過時間を保持せず、`startedAt` からの差分を描画するだけにする。
- 「計測中」の判定は常に `entries.endedAt IS NULL` で行う。`tasks.status` の `doing` は別概念であり、計測中の判定に使ってはいけない。
- `entries` に `duration` に相当するカラムを持たせない。所要時間は常に `endedAt - startedAt` で導出する。
- 日付の区切りはすべてローカルタイムで扱う。集計 API に渡す日付は `yyyy-MM-dd` 形式の文字列とする。
- カテゴリ名は初期投入時点で `開発` `調査` `レビュー` `会議` `その他` の5件とする。

---

## File Structure

| パス                              | 責務                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------- |
| `prisma/schema.prisma`            | データモデル定義                                                                |
| `prisma/migrations/**`            | マイグレーション。部分ユニークインデックスは生 SQL を手で追記する               |
| `prisma/seed.ts`                  | カテゴリ5件の初期投入                                                           |
| `src/lib/prisma.ts`               | PrismaClient のシングルトン                                                     |
| `src/lib/aggregate.ts`            | **DB に触らない純粋関数**。日跨ぎ分割・カテゴリ別集計・割り込み集計・見積もり比 |
| `src/lib/aggregate.test.ts`       | 上記のユニットテスト                                                            |
| `src/server/actions/timer.ts`     | `startTimer` / `stopTimer` / `createTaskAndStart` / `updateEntryTimes`          |
| `src/server/actions/task.ts`      | `createTask` / `updateTaskStatus`                                               |
| `src/server/queries/today.ts`     | 今日の画面が必要とするデータ取得                                                |
| `src/server/queries/tasks.ts`     | タスク一覧（実績合計・最終作業日つき）                                          |
| `src/server/queries/analytics.ts` | 期間集計。`aggregate.ts` に entries を渡すだけ                                  |
| `src/app/page.tsx`                | 今日の画面                                                                      |
| `src/app/tasks/page.tsx`          | タスク一覧                                                                      |
| `src/app/analytics/page.tsx`      | 分析                                                                            |
| `src/components/`                 | 画面固有のコンポーネント                                                        |
| `src/components/ui/`              | shadcn/ui の生成物。手で編集しない                                              |

---

## Task 1: プロジェクト初期化

**Files:**

- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`
- Create: `.oxlintrc.json`, `vitest.config.ts`, `src/lib/smoke.test.ts`, `.gitignore`

**Interfaces:**

- Consumes: なし
- Produces: `npm run dev` / `npm run lint` / `npm run format` / `npm test` の4コマンド。パスエイリアス `@/*` → `src/*`

- [ ] **Step 1: Next.js プロジェクトを一時ディレクトリに生成して中身を移す**

リポジトリ直下には既に `docs/` があり、`create-next-app` は空でないディレクトリを拒否する。一時ディレクトリに生成してから中身を移動する。

```bash
cd /Users/shsato4/ghq/github.com/ShSato4JPN/work-memo
npx create-next-app@latest .tmp-init \
  --typescript --tailwind --app --src-dir --no-eslint --turbopack \
  --import-alias "@/*" --use-npm --yes
rsync -a .tmp-init/ ./ --exclude node_modules --exclude .git
rm -rf .tmp-init
npm install
```

- [ ] **Step 2: 動作確認**

```bash
npm run build
```

Expected: ビルドが成功する。

- [ ] **Step 3: oxlint / oxfmt / Vitest を入れる**

```bash
npm install -D oxlint@1.80.0 oxfmt@0.65.0 vitest@4.1.11 date-fns@4.4.0
```

- [ ] **Step 4: oxlint の設定ファイルを作る**

`.oxlintrc.json`:

```json
{
  "$schema": "https://raw.githubusercontent.com/oxc-project/oxc/main/npm/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "unicorn"],
  "env": { "browser": true, "node": true, "es2024": true },
  "ignorePatterns": ["node_modules", ".next", "src/components/ui"],
  "rules": {
    "no-unused-vars": "error",
    "no-console": "warn"
  }
}
```

`src/components/ui` を除外しているのは、shadcn/ui の生成物を手で直さない方針のため。

- [ ] **Step 5: Vitest の設定ファイルを作る**

`vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 6: package.json の scripts を書き換える**

`package.json` の `scripts` を以下に置き換える。

```json
{
  "dev": "next dev --turbopack",
  "build": "next build",
  "start": "next start",
  "lint": "oxlint",
  "format": "oxfmt .",
  "format:check": "oxfmt --check .",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 7: 失敗するスモークテストを書く**

`src/lib/smoke.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { greet } from "./smoke";

describe("greet", () => {
  it("名前を受け取って挨拶を返す", () => {
    expect(greet("world")).toBe("hello, world");
  });
});
```

- [ ] **Step 8: テストが失敗することを確認する**

Run: `npm test`
Expected: FAIL。`Failed to resolve import "./smoke"` というエラーになる。

- [ ] **Step 9: 最小の実装を書く**

`src/lib/smoke.ts`:

```ts
export function greet(name: string): string {
  return `hello, ${name}`;
}
```

- [ ] **Step 10: テストが通ることを確認する**

Run: `npm test`
Expected: PASS（1 passed）

- [ ] **Step 11: lint とフォーマットが動くことを確認する**

```bash
npm run lint
npm run format
```

Expected: `npm run lint` がエラー0で終了する。`npm run format` がファイルを整形して正常終了する。

- [ ] **Step 12: .gitignore に SQLite ファイルを追加する**

`.gitignore` の末尾に追記する。

```
# database
/prisma/*.db
/prisma/*.db-journal
/prisma/test.db
```

- [ ] **Step 13: コミット**

```bash
git add -A
git commit -m "chore: Next.js + oxlint + oxfmt + Vitest でプロジェクトを初期化"
```

---

## Task 2: Prisma スキーマとマイグレーション

**Files:**

- Create: `prisma/schema.prisma`, `prisma/seed.ts`, `src/lib/prisma.ts`, `.env`
- Modify: `package.json`（`prisma.seed` 設定を追加）

**Interfaces:**

- Consumes: Task 1 の `@/*` エイリアス
- Produces:
  - `import { prisma } from "@/lib/prisma"` — PrismaClient のシングルトン
  - Prisma モデル `Category` / `Task` / `Entry`
  - フィールド名: `Entry.taskId`, `Entry.startedAt`, `Entry.endedAt`, `Entry.parentEntryId`, `Entry.note`, `Task.categoryId`, `Task.estimateMin`, `Task.status`, `Task.archived`, `Category.color`, `Category.sortOrder`

- [ ] **Step 1: Prisma をバージョン固定でインストールする**

`latest` は使わない（Global Constraints 参照）。

```bash
npm install -D prisma@7.10.0 tsx@4.20.6
npm install @prisma/client@7.10.0
```

- [ ] **Step 2: .env に接続先を書く**

`.env`:

```
DATABASE_URL="file:./dev.db"
```

- [ ] **Step 3: スキーマを書く**

`prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Category {
  id        Int      @id @default(autoincrement())
  name      String   @unique
  color     String
  sortOrder Int      @default(0) @map("sort_order")
  archived  Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")
  tasks     Task[]

  @@map("categories")
}

model Task {
  id           Int       @id @default(autoincrement())
  title        String    @unique
  categoryId   Int       @map("category_id")
  estimateMin  Int?      @map("estimate_min")
  status       String    @default("todo")
  archived     Boolean   @default(false)
  createdAt    DateTime  @default(now()) @map("created_at")
  completedAt  DateTime? @map("completed_at")
  category     Category  @relation(fields: [categoryId], references: [id])
  entries      Entry[]

  @@index([categoryId])
  @@map("tasks")
}

model Entry {
  id            Int       @id @default(autoincrement())
  taskId        Int       @map("task_id")
  startedAt     DateTime  @map("started_at")
  endedAt       DateTime? @map("ended_at")
  parentEntryId Int?      @map("parent_entry_id")
  note          String?
  task          Task      @relation(fields: [taskId], references: [id])
  parentEntry   Entry?    @relation("Interruption", fields: [parentEntryId], references: [id])
  children      Entry[]   @relation("Interruption")

  @@index([startedAt])
  @@index([taskId])
  @@map("entries")
}
```

`status` は SQLite に enum がないため String で持つ。値の検証は Server Action 側で行う。

- [ ] **Step 4: 初回マイグレーションを生成する**

```bash
npx prisma migrate dev --name init --create-only
```

`--create-only` にするのは、次のステップで生 SQL を手で追記してから適用するため。

- [ ] **Step 5: マイグレーションに部分ユニークインデックスを追記する**

`prisma/migrations/<タイムスタンプ>_init/migration.sql` の末尾に追記する。Prisma のスキーマ言語では部分インデックスを表現できないため、ここだけ生 SQL で書く。

```sql
-- 計測中(ended_at IS NULL)のエントリは全体で最大1件、をDBレベルで保証する
CREATE UNIQUE INDEX "idx_entries_single_running"
  ON "entries" ((1)) WHERE "ended_at" IS NULL;
```

- [ ] **Step 6: マイグレーションを適用する**

```bash
npx prisma migrate dev
```

Expected: 適用が成功し、`prisma/dev.db` が生成される。

- [ ] **Step 7: 部分ユニークインデックスが実際に効くことを手で確認する**

```bash
sqlite3 prisma/dev.db "SELECT name FROM sqlite_master WHERE type='index' AND name='idx_entries_single_running';"
```

Expected: `idx_entries_single_running` が出力される。

- [ ] **Step 8: PrismaClient のシングルトンを作る**

`src/lib/prisma.ts`。Next.js の開発時ホットリロードで接続が増殖するのを防ぐため、globalThis に載せる。

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 9: seed スクリプトを書く**

`prisma/seed.ts`:

```ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: "開発", color: "#2563eb", sortOrder: 1 },
  { name: "調査", color: "#f59e0b", sortOrder: 2 },
  { name: "レビュー", color: "#10b981", sortOrder: 3 },
  { name: "会議", color: "#ef4444", sortOrder: 4 },
  { name: "その他", color: "#6b7280", sortOrder: 5 },
];

async function main() {
  for (const category of CATEGORIES) {
    await prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    });
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
```

`upsert` にしているので、何度実行しても重複しない。

- [ ] **Step 10: package.json に seed の設定を追加する**

`package.json` のトップレベル（`scripts` と同じ階層）に追加する。

```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 11: seed を実行して確認する**

```bash
npx prisma db seed
sqlite3 prisma/dev.db "SELECT id, name, color FROM categories ORDER BY sort_order;"
```

Expected: 開発 / 調査 / レビュー / 会議 / その他 の5行が出力される。

- [ ] **Step 12: コミット**

```bash
git add -A
git commit -m "feat: Prisma スキーマとマイグレーション、カテゴリの初期投入を追加"
```

---

## Task 3: 集計ロジック（純粋関数）

このタスクがアプリの心臓部であり、最もバグりやすい。DB に一切触らない純粋関数として書き、テストを厚くする。

**Files:**

- Create: `src/lib/aggregate.ts`, `src/lib/aggregate.test.ts`
- Delete: `src/lib/smoke.ts`, `src/lib/smoke.test.ts`（Task 1 の足場なので不要になる）

**Interfaces:**

- Consumes: `date-fns`
- Produces（後続タスクはこの型と関数名に依存する）:

  ```ts
  type EntryLike = { id: number; taskId: number; startedAt: Date; endedAt: Date | null; parentEntryId: number | null };
  type TaskLike = { id: number; title: string; categoryId: number; estimateMin: number | null };
  type CategoryLike = { id: number; name: string; color: string };
  type DaySlice = { date: string; minutes: number };
  type DateRange = { from: string; to: string }; // 'yyyy-MM-dd' 両端を含む
  type CategoryTotal = { categoryId: number; name: string; color: string; minutes: number };
  type DailyTotal = { date: string; byCategory: { categoryId: number; minutes: number }[] };
  type EstimateComparison = { taskId: number; title: string; estimateMin: number; actualMin: number; diffMin: number; ratio: number };

  splitEntryByDay(entry: EntryLike, now: Date): DaySlice[]
  taskActualMinutes(entries: EntryLike[], now: Date): Map<number, number>
  sumByCategory(entries: EntryLike[], tasks: TaskLike[], categories: CategoryLike[], range: DateRange, now: Date): CategoryTotal[]
  dailyTotals(entries: EntryLike[], tasks: TaskLike[], range: DateRange, now: Date): DailyTotal[]
  countInterruptions(entries: EntryLike[], range: DateRange): number
  averageFocusMin(entries: EntryLike[], range: DateRange, now: Date): number
  estimateComparisons(tasks: TaskLike[], entries: EntryLike[], now: Date): EstimateComparison[]
  ```

- [ ] **Step 1: Task 1 のスモーク用ファイルを削除する**

```bash
rm src/lib/smoke.ts src/lib/smoke.test.ts
```

- [ ] **Step 2: 日跨ぎ分割の失敗するテストを書く**

`src/lib/aggregate.test.ts`:

```ts
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
```

- [ ] **Step 3: テストが失敗することを確認する**

Run: `npm test`
Expected: FAIL。`Failed to resolve import "./aggregate"`

- [ ] **Step 4: splitEntryByDay を実装する**

`src/lib/aggregate.ts`:

```ts
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
```

- [ ] **Step 5: テストが通ることを確認する**

Run: `npm test`
Expected: PASS（4 passed）

- [ ] **Step 6: コミット**

```bash
git add -A
git commit -m "feat: エントリを日境界で分割する集計関数を追加"
```

- [ ] **Step 7: カテゴリ別集計の失敗するテストを書く**

`src/lib/aggregate.test.ts` に追記する。

```ts
import { sumByCategory, taskActualMinutes, type CategoryLike, type TaskLike } from "./aggregate";

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
```

- [ ] **Step 8: テストが失敗することを確認する**

Run: `npm test`
Expected: FAIL。`sumByCategory is not a function`

- [ ] **Step 9: sumByCategory と taskActualMinutes を実装する**

`src/lib/aggregate.ts` に追記する。

```ts
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
      minutesByCategoryId.set(
        categoryId,
        (minutesByCategoryId.get(categoryId) ?? 0) + slice.minutes,
      );
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
```

- [ ] **Step 10: テストが通ることを確認する**

Run: `npm test`
Expected: PASS（8 passed）

- [ ] **Step 11: コミット**

```bash
git add -A
git commit -m "feat: カテゴリ別・タスク別の時間集計を追加"
```

- [ ] **Step 12: 割り込み指標と見積もり比の失敗するテストを書く**

`src/lib/aggregate.test.ts` に追記する。

```ts
import { averageFocusMin, countInterruptions, dailyTotals, estimateComparisons } from "./aggregate";

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
```

- [ ] **Step 13: テストが失敗することを確認する**

Run: `npm test`
Expected: FAIL。`countInterruptions is not a function`

- [ ] **Step 14: 残りの集計関数を実装する**

`src/lib/aggregate.ts` に追記する。

```ts
export type DailyTotal = {
  date: string;
  byCategory: { categoryId: number; minutes: number }[];
};

export type EstimateComparison = {
  taskId: number;
  title: string;
  estimateMin: number;
  actualMin: number;
  diffMin: number;
  ratio: number;
};

/** 割り込み回数。parentEntryId を持ち、期間内に開始したエントリの数 */
export function countInterruptions(entries: EntryLike[], range: DateRange): number {
  return entries.filter(
    (entry) => entry.parentEntryId !== null && isInRange(toDateKey(entry.startedAt), range),
  ).length;
}

/** 1エントリあたりの平均継続時間（分）。集中の途切れにくさの指標 */
export function averageFocusMin(entries: EntryLike[], range: DateRange, now: Date): number {
  const targets = entries.filter((entry) => isInRange(toDateKey(entry.startedAt), range));
  if (targets.length === 0) return 0;

  const total = targets.reduce(
    (sum, entry) => sum + splitEntryByDay(entry, now).reduce((s, slice) => s + slice.minutes, 0),
    0,
  );
  return total / targets.length;
}

/** 日ごと・カテゴリごとの合計。作業のない日も空配列つきで返す（グラフの横軸を欠けさせないため） */
export function dailyTotals(
  entries: EntryLike[],
  tasks: TaskLike[],
  range: DateRange,
  now: Date,
): DailyTotal[] {
  const categoryIdByTaskId = new Map(tasks.map((task) => [task.id, task.categoryId]));
  const byDate = new Map<string, Map<number, number>>();

  for (const entry of entries) {
    const categoryId = categoryIdByTaskId.get(entry.taskId);
    if (categoryId === undefined) continue;

    for (const slice of splitEntryByDay(entry, now)) {
      if (!isInRange(slice.date, range)) continue;
      const perCategory = byDate.get(slice.date) ?? new Map<number, number>();
      perCategory.set(categoryId, (perCategory.get(categoryId) ?? 0) + slice.minutes);
      byDate.set(slice.date, perCategory);
    }
  }

  const result: DailyTotal[] = [];
  let cursor = startOfDay(new Date(`${range.from}T00:00:00`));
  const last = startOfDay(new Date(`${range.to}T00:00:00`));

  while (cursor <= last) {
    const dateKey = toDateKey(cursor);
    const perCategory = byDate.get(dateKey);
    result.push({
      date: dateKey,
      byCategory: perCategory
        ? [...perCategory.entries()].map(([categoryId, minutes]) => ({ categoryId, minutes }))
        : [],
    });
    cursor = addDays(cursor, 1);
  }

  return result;
}

/** 見積もりと実績の比較。見積もり未設定、または実績0のタスクは対象外 */
export function estimateComparisons(
  tasks: TaskLike[],
  entries: EntryLike[],
  now: Date,
): EstimateComparison[] {
  const actuals = taskActualMinutes(entries, now);

  return tasks
    .filter((task): task is TaskLike & { estimateMin: number } => task.estimateMin !== null)
    .map((task) => {
      const actualMin = actuals.get(task.id) ?? 0;
      return {
        taskId: task.id,
        title: task.title,
        estimateMin: task.estimateMin,
        actualMin,
        diffMin: actualMin - task.estimateMin,
        ratio: actualMin / task.estimateMin,
      };
    })
    .filter((comparison) => comparison.actualMin > 0)
    .sort((a, b) => b.ratio - a.ratio);
}
```

- [ ] **Step 15: テストが通ることを確認する**

Run: `npm test`
Expected: PASS（14 passed）

- [ ] **Step 16: lint とフォーマットを通す**

```bash
npm run format
npm run lint
```

Expected: どちらもエラーなく終了する。

- [ ] **Step 17: コミット**

```bash
git add -A
git commit -m "feat: 割り込み指標・見積もり比較・日次集計を追加"
```

---

## Task 4: タイマーの Server Actions

**Files:**

- Create: `src/server/actions/timer.ts`, `src/server/actions/task.ts`
- Create: `src/server/actions/timer.test.ts`, `vitest.setup.ts`
- Modify: `vitest.config.ts`

**Interfaces:**

- Consumes: `@/lib/prisma` の `prisma`
- Produces:

  ```ts
  // timer.ts — すべて "use server"
  startTimer(taskId: number): Promise<void>
  stopTimer(): Promise<void>
  createTaskAndStart(input: { title: string; categoryId: number; estimateMin: number | null }): Promise<void>
  updateEntryTimes(input: { entryId: number; startedAt: Date; endedAt: Date | null }): Promise<void>
  getRunningEntry(): Promise<{ id: number; taskId: number; startedAt: Date } | null>

  // task.ts
  createTask(input: { title: string; categoryId: number; estimateMin: number | null }): Promise<number>
  updateTaskStatus(taskId: number, status: "todo" | "doing" | "done"): Promise<void>
  ```

- [ ] **Step 1: テスト用 DB のセットアップを書く**

`vitest.setup.ts`。部分ユニークインデックスは生 SQL でマイグレーションに書いてあるため、`db push` ではなく `migrate deploy` を使う。ここを `db push` にすると二重 Start のテストが通らなくなる。

```ts
import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { beforeAll } from "vitest";

const TEST_DB_PATH = "prisma/test.db";

beforeAll(() => {
  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: "file:./prisma/test.db" },
    stdio: "inherit",
  });
});
```

- [ ] **Step 2: vitest.config.ts を更新する**

`vitest.config.ts` を以下に置き換える。

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
    env: { DATABASE_URL: "file:./prisma/test.db" },
    fileParallelism: false,
  },
});
```

`fileParallelism: false` にするのは、テストファイル間で同じ SQLite ファイルを共有するため。

- [ ] **Step 3: テストが今まで通り通ることを確認する**

Run: `npm test`
Expected: PASS（14 passed）。集計関数のテストは DB に触らないので影響を受けない。

- [ ] **Step 4: タイマー操作の失敗するテストを書く**

`src/server/actions/timer.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createTaskAndStart,
  getRunningEntry,
  startTimer,
  stopTimer,
  updateEntryTimes,
} from "./timer";

async function resetDatabase() {
  await prisma.entry.deleteMany();
  await prisma.task.deleteMany();
  await prisma.category.deleteMany();
}

async function seedCategory() {
  return prisma.category.create({
    data: { name: "開発", color: "#2563eb", sortOrder: 1 },
  });
}

describe("タイマー操作", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("startTimer で計測中のエントリが1件できる", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: 60 },
    });

    await startTimer(task.id);

    const running = await getRunningEntry();
    expect(running?.taskId).toBe(task.id);
  });

  it("計測中に startTimer すると前のエントリが自動で止まり parentEntryId が入る", async () => {
    const category = await seedCategory();
    const first = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: 60 },
    });
    const second = await prisma.task.create({
      data: { title: "レビュー対応", categoryId: category.id, estimateMin: 30 },
    });

    await startTimer(first.id);
    const firstEntry = await getRunningEntry();
    await startTimer(second.id);

    const previous = await prisma.entry.findUniqueOrThrow({ where: { id: firstEntry!.id } });
    expect(previous.endedAt).not.toBeNull();

    const running = await getRunningEntry();
    expect(running?.taskId).toBe(second.id);

    const currentEntry = await prisma.entry.findUniqueOrThrow({ where: { id: running!.id } });
    expect(currentEntry.parentEntryId).toBe(firstEntry!.id);
  });

  it("計測中のエントリは常に1件を超えない", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: 60 },
    });

    await startTimer(task.id);
    await startTimer(task.id);

    const runningCount = await prisma.entry.count({ where: { endedAt: null } });
    expect(runningCount).toBe(1);
  });

  it("stopTimer で計測中のエントリがなくなる", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: 60 },
    });

    await startTimer(task.id);
    await stopTimer();

    expect(await getRunningEntry()).toBeNull();
  });

  it("createTaskAndStart はタスクを作って同時に計測を始める", async () => {
    const category = await seedCategory();

    await createTaskAndStart({ title: "新規タスク", categoryId: category.id, estimateMin: 45 });

    const task = await prisma.task.findUniqueOrThrow({ where: { title: "新規タスク" } });
    expect(task.status).toBe("doing");

    const running = await getRunningEntry();
    expect(running?.taskId).toBe(task.id);
  });

  it("updateEntryTimes で Stop 忘れのエントリを後から修正できる", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: 60 },
    });

    await startTimer(task.id);
    const running = await getRunningEntry();

    const startedAt = new Date(2026, 7, 29, 9, 0);
    const endedAt = new Date(2026, 7, 29, 10, 0);
    await updateEntryTimes({ entryId: running!.id, startedAt, endedAt });

    const updated = await prisma.entry.findUniqueOrThrow({ where: { id: running!.id } });
    expect(updated.startedAt).toEqual(startedAt);
    expect(updated.endedAt).toEqual(endedAt);
    expect(await getRunningEntry()).toBeNull();
  });

  it("終了時刻が開始時刻より前なら更新できない", async () => {
    const category = await seedCategory();
    const task = await prisma.task.create({
      data: { title: "認証機能の実装", categoryId: category.id, estimateMin: 60 },
    });

    await startTimer(task.id);
    const running = await getRunningEntry();

    await expect(
      updateEntryTimes({
        entryId: running!.id,
        startedAt: new Date(2026, 7, 29, 10, 0),
        endedAt: new Date(2026, 7, 29, 9, 0),
      }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 5: テストが失敗することを確認する**

Run: `npm test src/server/actions/timer.test.ts`
Expected: FAIL。`Failed to resolve import "./timer"`

- [ ] **Step 6: タスク操作の Server Action を書く**

`src/server/actions/task.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export type TaskStatus = "todo" | "doing" | "done";

const TASK_STATUSES: TaskStatus[] = ["todo", "doing", "done"];

export async function createTask(input: {
  title: string;
  categoryId: number;
  estimateMin: number | null;
}): Promise<number> {
  const title = input.title.trim();
  if (title === "") throw new Error("タスク名を入力してください");

  const task = await prisma.task.create({
    data: { title, categoryId: input.categoryId, estimateMin: input.estimateMin },
  });

  revalidatePath("/tasks");
  return task.id;
}

export async function updateTaskStatus(taskId: number, status: TaskStatus): Promise<void> {
  if (!TASK_STATUSES.includes(status)) throw new Error(`不正なステータス: ${status}`);

  await prisma.task.update({
    where: { id: taskId },
    data: {
      status,
      completedAt: status === "done" ? new Date() : null,
    },
  });

  revalidatePath("/tasks");
  revalidatePath("/");
}
```

- [ ] **Step 7: タイマーの Server Action を書く**

`src/server/actions/timer.ts`。割り込みの連鎖はトランザクションで一括して行う。

```ts
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function getRunningEntry(): Promise<{
  id: number;
  taskId: number;
  startedAt: Date;
} | null> {
  const entry = await prisma.entry.findFirst({
    where: { endedAt: null },
    select: { id: true, taskId: true, startedAt: true },
  });
  return entry;
}

/**
 * 計測を開始する。
 * 既に計測中のエントリがあれば、それを終了させたうえで
 * 新しいエントリの parentEntryId に設定する（＝割り込みとして記録する）。
 */
export async function startTimer(taskId: number): Promise<void> {
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    const running = await tx.entry.findFirst({ where: { endedAt: null } });

    if (running) {
      // 経過0秒だと CHECK 制約 (ended_at > started_at) に触れるため1ミリ秒進める
      const endedAt = now > running.startedAt ? now : new Date(running.startedAt.getTime() + 1);
      await tx.entry.update({ where: { id: running.id }, data: { endedAt } });
    }

    await tx.entry.create({
      data: { taskId, startedAt: now, parentEntryId: running?.id ?? null },
    });

    await tx.task.update({ where: { id: taskId }, data: { status: "doing" } });
  });

  revalidatePath("/");
}

export async function stopTimer(): Promise<void> {
  const running = await prisma.entry.findFirst({ where: { endedAt: null } });
  if (!running) return;

  const now = new Date();
  const endedAt = now > running.startedAt ? now : new Date(running.startedAt.getTime() + 1);
  await prisma.entry.update({ where: { id: running.id }, data: { endedAt } });

  revalidatePath("/");
}

export async function createTaskAndStart(input: {
  title: string;
  categoryId: number;
  estimateMin: number | null;
}): Promise<void> {
  const title = input.title.trim();
  if (title === "") throw new Error("タスク名を入力してください");

  const task = await prisma.task.create({
    data: { title, categoryId: input.categoryId, estimateMin: input.estimateMin },
  });

  await startTimer(task.id);
  revalidatePath("/tasks");
}

/** Stop 忘れなどの時刻を後から修正する */
export async function updateEntryTimes(input: {
  entryId: number;
  startedAt: Date;
  endedAt: Date | null;
}): Promise<void> {
  if (input.endedAt !== null && input.endedAt <= input.startedAt) {
    throw new Error("終了時刻は開始時刻より後にしてください");
  }

  await prisma.entry.update({
    where: { id: input.entryId },
    data: { startedAt: input.startedAt, endedAt: input.endedAt },
  });

  revalidatePath("/");
}
```

- [ ] **Step 8: テストが通ることを確認する**

Run: `npm test`
Expected: PASS（21 passed）

もし `revalidatePath` が Next.js のリクエストコンテキスト外で呼ばれてテストが落ちる場合は、`vitest.setup.ts` の先頭に以下を追加してモックする。

```ts
import { vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));
```

- [ ] **Step 9: lint とフォーマットを通す**

```bash
npm run format
npm run lint
```

- [ ] **Step 10: コミット**

```bash
git add -A
git commit -m "feat: タイマー操作の Server Actions を追加"
```

---

## Task 5: shadcn/ui の導入と今日の画面

**Files:**

- Create: `components.json`, `src/components/ui/*`（shadcn CLI が生成）
- Create: `src/server/queries/today.ts`, `src/components/running-timer.tsx`, `src/components/start-panel.tsx`, `src/components/today-log.tsx`
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`

**Interfaces:**

- Consumes: `startTimer`, `stopTimer`, `createTaskAndStart`, `getRunningEntry`（Task 4）/ `sumByCategory`, `toDateKey`（Task 3）
- Produces: `getTodayView(): Promise<TodayView>`

  ```ts
  type TodayView = {
    running: {
      entryId: number;
      taskId: number;
      title: string;
      categoryName: string;
      categoryColor: string;
      startedAt: Date;
    } | null;
    entries: {
      id: number;
      taskId: number;
      title: string;
      categoryName: string;
      categoryColor: string;
      startedAt: Date;
      endedAt: Date | null;
      isInterruption: boolean;
    }[];
    categoryTotals: CategoryTotal[];
    totalMinutes: number;
    activeTasks: { id: number; title: string; categoryName: string }[];
    categories: { id: number; name: string; color: string }[];
  };
  ```

- [ ] **Step 1: shadcn/ui を初期化する**

```bash
npx shadcn@4.19.0 init --yes --base-color slate
```

- [ ] **Step 2: 使うコンポーネントを追加する**

```bash
npx shadcn@4.19.0 add button card input select table badge dialog label chart --yes
```

- [ ] **Step 3: ビルドが通ることを確認する**

Run: `npm run build`
Expected: 成功する。

- [ ] **Step 4: コミット**

```bash
git add -A
git commit -m "chore: shadcn/ui を導入"
```

- [ ] **Step 5: 今日の画面用のクエリを書く**

`src/server/queries/today.ts`:

```ts
import { endOfDay, startOfDay } from "date-fns";
import { prisma } from "@/lib/prisma";
import { sumByCategory, toDateKey, type CategoryTotal } from "@/lib/aggregate";

export type TodayViewEntry = {
  id: number;
  taskId: number;
  title: string;
  categoryName: string;
  categoryColor: string;
  startedAt: Date;
  endedAt: Date | null;
  isInterruption: boolean;
};

export type TodayView = {
  running: {
    entryId: number;
    taskId: number;
    title: string;
    categoryName: string;
    categoryColor: string;
    startedAt: Date;
  } | null;
  entries: TodayViewEntry[];
  categoryTotals: CategoryTotal[];
  totalMinutes: number;
  activeTasks: { id: number; title: string; categoryName: string }[];
  categories: { id: number; name: string; color: string }[];
};

export async function getTodayView(now: Date = new Date()): Promise<TodayView> {
  const from = startOfDay(now);
  const to = endOfDay(now);

  const [rawEntries, categories, tasks] = await Promise.all([
    prisma.entry.findMany({
      where: {
        OR: [{ startedAt: { gte: from, lte: to } }, { endedAt: null }],
      },
      include: { task: { include: { category: true } } },
      orderBy: { startedAt: "asc" },
    }),
    prisma.category.findMany({ where: { archived: false }, orderBy: { sortOrder: "asc" } }),
    prisma.task.findMany({
      where: { archived: false, status: { in: ["todo", "doing"] } },
      include: { category: true },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  const entries: TodayViewEntry[] = rawEntries.map((entry) => ({
    id: entry.id,
    taskId: entry.taskId,
    title: entry.task.title,
    categoryName: entry.task.category.name,
    categoryColor: entry.task.category.color,
    startedAt: entry.startedAt,
    endedAt: entry.endedAt,
    isInterruption: entry.parentEntryId !== null,
  }));

  const runningRaw = rawEntries.find((entry) => entry.endedAt === null);

  const dateKey = toDateKey(now);
  const categoryTotals = sumByCategory(
    rawEntries.map((entry) => ({
      id: entry.id,
      taskId: entry.taskId,
      startedAt: entry.startedAt,
      endedAt: entry.endedAt,
      parentEntryId: entry.parentEntryId,
    })),
    rawEntries.map((entry) => ({
      id: entry.task.id,
      title: entry.task.title,
      categoryId: entry.task.categoryId,
      estimateMin: entry.task.estimateMin,
    })),
    categories,
    { from: dateKey, to: dateKey },
    now,
  );

  return {
    running: runningRaw
      ? {
          entryId: runningRaw.id,
          taskId: runningRaw.taskId,
          title: runningRaw.task.title,
          categoryName: runningRaw.task.category.name,
          categoryColor: runningRaw.task.category.color,
          startedAt: runningRaw.startedAt,
        }
      : null,
    entries,
    categoryTotals,
    totalMinutes: categoryTotals.reduce((sum, total) => sum + total.minutes, 0),
    activeTasks: tasks.map((task) => ({
      id: task.id,
      title: task.title,
      categoryName: task.category.name,
    })),
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
    })),
  };
}
```

`sumByCategory` に渡す tasks を entries 由来にしているのは、その日に作業のあったタスクだけが集計対象で十分なため。

- [ ] **Step 6: 経過時間を表示するクライアントコンポーネントを書く**

`src/components/running-timer.tsx`。**保持するのは `startedAt` だけで、経過時間は毎秒 `Date.now()` から再計算する。** これによりリロードやタブ復帰でズレない。

```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { stopTimer } from "@/server/actions/timer";

const WARN_THRESHOLD_MIN = 120;

function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function RunningTimer({
  title,
  categoryName,
  categoryColor,
  startedAt,
}: {
  title: string;
  categoryName: string;
  categoryColor: string;
  startedAt: Date;
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    Math.floor((Date.now() - startedAt.getTime()) / 1000),
  );

  useEffect(() => {
    const timerId = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(timerId);
  }, [startedAt]);

  const label = formatElapsed(elapsedSeconds);

  useEffect(() => {
    document.title = `${label} ${title}`;
    return () => {
      document.title = "作業時間トラッカー";
    };
  }, [label, title]);

  const isTooLong = elapsedSeconds > WARN_THRESHOLD_MIN * 60;

  return (
    <div className="flex items-center gap-4 rounded-lg border p-4">
      <span
        className="size-3 shrink-0 rounded-full"
        style={{ backgroundColor: categoryColor }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        <p className="text-muted-foreground text-sm">{categoryName}</p>
      </div>
      <p className="font-mono text-3xl tabular-nums">{label}</p>
      {isTooLong && (
        <p className="text-destructive text-sm">
          {WARN_THRESHOLD_MIN / 60}時間を超えています。Stop 忘れではありませんか？
        </p>
      )}
      <form action={stopTimer}>
        <Button type="submit" variant="secondary">
          Stop
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 7: Start パネルを書く**

`src/components/start-panel.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTaskAndStart, startTimer } from "@/server/actions/timer";

export function StartPanel({
  activeTasks,
  categories,
}: {
  activeTasks: { id: number; title: string; categoryName: string }[];
  categories: { id: number; name: string; color: string }[];
}) {
  const [keyword, setKeyword] = useState("");

  const matched = activeTasks.filter((task) => task.title.includes(keyword));

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <Label htmlFor="task-keyword">タスクを選ぶ</Label>
        <Input
          id="task-keyword"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="タスク名で絞り込む"
        />
      </div>

      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {matched.map((task) => (
          <li key={task.id}>
            <form action={startTimer.bind(null, task.id)}>
              <Button type="submit" variant="ghost" className="w-full justify-start">
                <span className="truncate">{task.title}</span>
                <span className="text-muted-foreground ml-auto text-xs">{task.categoryName}</span>
              </Button>
            </form>
          </li>
        ))}
      </ul>

      <form
        action={async (formData: FormData) => {
          const estimate = formData.get("estimateMin");
          await createTaskAndStart({
            title: String(formData.get("title") ?? ""),
            categoryId: Number(formData.get("categoryId")),
            estimateMin: estimate ? Number(estimate) : null,
          });
          setKeyword("");
        }}
        className="space-y-2 border-t pt-4"
      >
        <Label htmlFor="new-title">新しいタスクを作って開始</Label>
        <Input id="new-title" name="title" placeholder="タスク名" required />
        <div className="flex gap-2">
          <select
            name="categoryId"
            className="border-input h-9 flex-1 rounded-md border px-3 text-sm"
            required
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <Input
            name="estimateMin"
            type="number"
            min={1}
            placeholder="見積もり(分)"
            className="w-36"
          />
        </div>
        <Button type="submit" className="w-full">
          作成して Start
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 8: 今日のログ一覧を書く**

`src/components/today-log.tsx`:

```tsx
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { startTimer } from "@/server/actions/timer";
import type { TodayViewEntry } from "@/server/queries/today";

function durationLabel(startedAt: Date, endedAt: Date | null): string {
  if (endedAt === null) return "計測中";
  const minutes = Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000);
  return `${minutes}分`;
}

export function TodayLog({ entries }: { entries: TodayViewEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-muted-foreground text-sm">まだ今日の記録はありません。</p>;
  }

  return (
    <ul className="divide-y">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-center gap-3 py-2">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: entry.categoryColor }}
            aria-hidden
          />
          <span className="text-muted-foreground w-28 shrink-0 font-mono text-xs">
            {format(entry.startedAt, "HH:mm")}–{entry.endedAt ? format(entry.endedAt, "HH:mm") : ""}
          </span>
          <span className="min-w-0 flex-1 truncate">{entry.title}</span>
          {entry.isInterruption && <Badge variant="outline">割り込み</Badge>}
          <span className="w-16 shrink-0 text-right text-sm">
            {durationLabel(entry.startedAt, entry.endedAt)}
          </span>
          <form action={startTimer.bind(null, entry.taskId)}>
            <Button type="submit" variant="ghost" size="sm">
              再開
            </Button>
          </form>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 9: 今日の画面を組み立てる**

`src/app/page.tsx`。Server Component のまま書く。

```tsx
import { RunningTimer } from "@/components/running-timer";
import { StartPanel } from "@/components/start-panel";
import { TodayLog } from "@/components/today-log";
import { getTodayView } from "@/server/queries/today";

export const dynamic = "force-dynamic";

export default async function TodayPage() {
  const view = await getTodayView();

  return (
    <main className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">今日</h1>

      {view.running ? (
        <RunningTimer
          title={view.running.title}
          categoryName={view.running.categoryName}
          categoryColor={view.running.categoryColor}
          startedAt={view.running.startedAt}
        />
      ) : (
        <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
          計測していません。下から作業を開始してください。
        </p>
      )}

      <StartPanel activeTasks={view.activeTasks} categories={view.categories} />

      <section className="space-y-2">
        <h2 className="font-semibold">今日のログ</h2>
        <TodayLog entries={view.entries} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">今日の合計 {Math.round(view.totalMinutes)}分</h2>
        <div className="flex h-4 overflow-hidden rounded-full">
          {view.categoryTotals.map((total) => (
            <div
              key={total.categoryId}
              style={{
                backgroundColor: total.color,
                width: `${(total.minutes / view.totalMinutes) * 100}%`,
              }}
              title={`${total.name} ${Math.round(total.minutes)}分`}
            />
          ))}
        </div>
        <ul className="text-sm">
          {view.categoryTotals.map((total) => (
            <li key={total.categoryId} className="flex justify-between">
              <span>{total.name}</span>
              <span className="tabular-nums">{Math.round(total.minutes)}分</span>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
```

- [ ] **Step 10: layout にタイトルとナビゲーションを入れる**

`src/app/layout.tsx` の `metadata` と `body` の中身を差し替える。

```tsx
export const metadata = {
  title: "作業時間トラッカー",
  description: "日々の作業時間を記録して、ボトルネックを見つける",
};
```

`body` の直下に、`{children}` の前へ以下を追加する。

```tsx
<nav className="flex gap-4 border-b px-6 py-3 text-sm">
  <a href="/" className="hover:underline">
    今日
  </a>
  <a href="/tasks" className="hover:underline">
    タスク
  </a>
  <a href="/analytics" className="hover:underline">
    分析
  </a>
</nav>
```

- [ ] **Step 11: 手で動作確認する**

```bash
npm run dev
```

ブラウザで `http://localhost:3000` を開き、以下を確認する。

1. 新しいタスクを作って Start すると、上部に経過時間が秒単位で進む
2. ページをリロードしても経過時間がリセットされない
3. 別のタスクを Start すると前のタスクが自動で止まり、ログに「割り込み」バッジが付く
4. Stop すると計測中の表示が消える
5. ブラウザのタブに経過時間が表示される

- [ ] **Step 12: lint / format / build を通す**

```bash
npm run format
npm run lint
npm run build
```

- [ ] **Step 13: コミット**

```bash
git add -A
git commit -m "feat: 今日の画面（タイマー・Start パネル・ログ一覧）を追加"
```

---

## Task 6: タスク一覧画面

**Files:**

- Create: `src/server/queries/tasks.ts`, `src/app/tasks/page.tsx`, `src/components/task-row.tsx`

**Interfaces:**

- Consumes: `taskActualMinutes`（Task 3）/ `startTimer`（Task 4）/ `updateTaskStatus`（Task 4）
- Produces: `getTaskList(status?: TaskStatus): Promise<TaskListItem[]>`

  ```ts
  type TaskListItem = {
    id: number;
    title: string;
    categoryName: string;
    categoryColor: string;
    status: string;
    estimateMin: number | null;
    actualMin: number;
    diffMin: number | null;
    lastWorkedAt: Date | null;
  };
  ```

- [ ] **Step 1: タスク一覧のクエリを書く**

`src/server/queries/tasks.ts`:

```ts
import { prisma } from "@/lib/prisma";
import { taskActualMinutes } from "@/lib/aggregate";
import type { TaskStatus } from "@/server/actions/task";

export type TaskListItem = {
  id: number;
  title: string;
  categoryName: string;
  categoryColor: string;
  status: string;
  estimateMin: number | null;
  actualMin: number;
  diffMin: number | null;
  lastWorkedAt: Date | null;
};

export async function getTaskList(
  status?: TaskStatus,
  now: Date = new Date(),
): Promise<TaskListItem[]> {
  const tasks = await prisma.task.findMany({
    where: { archived: false, ...(status ? { status } : {}) },
    include: { category: true, entries: true },
    orderBy: { createdAt: "desc" },
  });

  return tasks.map((task) => {
    const actuals = taskActualMinutes(
      task.entries.map((entry) => ({
        id: entry.id,
        taskId: entry.taskId,
        startedAt: entry.startedAt,
        endedAt: entry.endedAt,
        parentEntryId: entry.parentEntryId,
      })),
      now,
    );
    const actualMin = actuals.get(task.id) ?? 0;

    const lastWorkedAt = task.entries.reduce<Date | null>(
      (latest, entry) => (latest === null || entry.startedAt > latest ? entry.startedAt : latest),
      null,
    );

    return {
      id: task.id,
      title: task.title,
      categoryName: task.category.name,
      categoryColor: task.category.color,
      status: task.status,
      estimateMin: task.estimateMin,
      actualMin,
      diffMin: task.estimateMin === null ? null : actualMin - task.estimateMin,
      lastWorkedAt,
    };
  });
}
```

- [ ] **Step 2: タスク行のコンポーネントを書く**

`src/components/task-row.tsx`:

```tsx
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { updateTaskStatus } from "@/server/actions/task";
import { startTimer } from "@/server/actions/timer";
import type { TaskListItem } from "@/server/queries/tasks";

function diffLabel(diffMin: number | null): string {
  if (diffMin === null) return "—";
  const rounded = Math.round(diffMin);
  return rounded >= 0 ? `+${rounded}分` : `${rounded}分`;
}

export function TaskRow({ task }: { task: TaskListItem }) {
  return (
    <tr className="border-b">
      <td className="py-2">
        <div className="flex items-center gap-2">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: task.categoryColor }}
            aria-hidden
          />
          <span className="truncate">{task.title}</span>
        </div>
      </td>
      <td className="text-muted-foreground py-2 text-sm">{task.categoryName}</td>
      <td className="py-2 text-right tabular-nums">
        {task.estimateMin === null ? "—" : `${task.estimateMin}分`}
      </td>
      <td className="py-2 text-right tabular-nums">{Math.round(task.actualMin)}分</td>
      <td
        className={`py-2 text-right tabular-nums ${
          task.diffMin !== null && task.diffMin > 0 ? "text-destructive" : ""
        }`}
      >
        {diffLabel(task.diffMin)}
      </td>
      <td className="text-muted-foreground py-2 text-right text-sm">
        {task.lastWorkedAt ? format(task.lastWorkedAt, "MM/dd") : "—"}
      </td>
      <td className="py-2 text-right">
        <div className="flex justify-end gap-1">
          <form action={startTimer.bind(null, task.id)}>
            <Button type="submit" size="sm" variant="ghost">
              Start
            </Button>
          </form>
          {task.status !== "done" && (
            <form action={updateTaskStatus.bind(null, task.id, "done")}>
              <Button type="submit" size="sm" variant="ghost">
                完了
              </Button>
            </form>
          )}
        </div>
      </td>
    </tr>
  );
}
```

- [ ] **Step 3: タスク一覧ページを書く**

`src/app/tasks/page.tsx`:

```tsx
import { TaskRow } from "@/components/task-row";
import { getTaskList } from "@/server/queries/tasks";
import type { TaskStatus } from "@/server/actions/task";

export const dynamic = "force-dynamic";

const FILTERS: { label: string; value: TaskStatus | undefined }[] = [
  { label: "すべて", value: undefined },
  { label: "未着手", value: "todo" },
  { label: "進行中", value: "doing" },
  { label: "完了", value: "done" },
];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = FILTERS.find((item) => item.value === status)?.value;
  const tasks = await getTaskList(filter);

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">タスク</h1>

      <nav className="flex gap-2 text-sm">
        {FILTERS.map((item) => (
          <a
            key={item.label}
            href={item.value ? `/tasks?status=${item.value}` : "/tasks"}
            className={`rounded-md border px-3 py-1 ${filter === item.value ? "bg-accent" : ""}`}
          >
            {item.label}
          </a>
        ))}
      </nav>

      <table className="w-full">
        <thead>
          <tr className="text-muted-foreground border-b text-left text-sm">
            <th className="py-2">タスク</th>
            <th className="py-2">カテゴリ</th>
            <th className="py-2 text-right">見積もり</th>
            <th className="py-2 text-right">実績</th>
            <th className="py-2 text-right">差分</th>
            <th className="py-2 text-right">最終作業</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </tbody>
      </table>

      {tasks.length === 0 && (
        <p className="text-muted-foreground text-sm">該当するタスクがありません。</p>
      )}
    </main>
  );
}
```

- [ ] **Step 4: 手で動作確認する**

```bash
npm run dev
```

`http://localhost:3000/tasks` を開き、以下を確認する。

1. Task 5 で作ったタスクが実績つきで並ぶ
2. 見積もりを超えたタスクの差分が赤く表示される
3. フィルタのリンクで絞り込める
4. 一覧の Start ボタンで計測が始まり、今日の画面に反映される

- [ ] **Step 5: lint / format / build を通す**

```bash
npm run format
npm run lint
npm run build
```

- [ ] **Step 6: コミット**

```bash
git add -A
git commit -m "feat: タスク一覧画面を追加"
```

---

## Task 7: 分析画面

**Files:**

- Create: `src/server/queries/analytics.ts`, `src/app/analytics/page.tsx`, `src/components/category-pie.tsx`, `src/components/daily-stack-chart.tsx`

**Interfaces:**

- Consumes: `sumByCategory`, `dailyTotals`, `countInterruptions`, `averageFocusMin`, `estimateComparisons`, `toDateKey`（すべて Task 3）
- Produces: `getAnalytics(period: "day" | "week" | "month", now?: Date): Promise<AnalyticsView>`

- [ ] **Step 0: recharts をインストールする**

Task 5 の `npx shadcn add chart` で入る場合もあるが、確実にするため明示的に入れる。

```bash
npm install recharts@3.10.1
```

- [ ] **Step 1: 分析クエリを書く**

`src/server/queries/analytics.ts`:

```ts
import { endOfMonth, endOfWeek, startOfDay, endOfDay, startOfMonth, startOfWeek } from "date-fns";
import { prisma } from "@/lib/prisma";
import {
  averageFocusMin,
  countInterruptions,
  dailyTotals,
  estimateComparisons,
  sumByCategory,
  toDateKey,
  type CategoryTotal,
  type DailyTotal,
  type DateRange,
  type EstimateComparison,
} from "@/lib/aggregate";

export type Period = "day" | "week" | "month";

export type AnalyticsView = {
  range: DateRange;
  categoryTotals: CategoryTotal[];
  daily: DailyTotal[];
  categories: { id: number; name: string; color: string }[];
  totalMinutes: number;
  interruptionCount: number;
  averageFocusMinutes: number;
  estimates: EstimateComparison[];
};

function resolveRange(period: Period, now: Date): { from: Date; to: Date } {
  if (period === "day") return { from: startOfDay(now), to: endOfDay(now) };
  if (period === "week") {
    return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
  }
  return { from: startOfMonth(now), to: endOfMonth(now) };
}

export async function getAnalytics(period: Period, now: Date = new Date()): Promise<AnalyticsView> {
  const { from, to } = resolveRange(period, now);
  const range: DateRange = { from: toDateKey(from), to: toDateKey(to) };

  const [rawEntries, categories] = await Promise.all([
    prisma.entry.findMany({
      where: { startedAt: { lte: to }, OR: [{ endedAt: null }, { endedAt: { gte: from } }] },
      include: { task: true },
    }),
    prisma.category.findMany({ where: { archived: false }, orderBy: { sortOrder: "asc" } }),
  ]);

  const entries = rawEntries.map((entry) => ({
    id: entry.id,
    taskId: entry.taskId,
    startedAt: entry.startedAt,
    endedAt: entry.endedAt,
    parentEntryId: entry.parentEntryId,
  }));

  const tasks = [...new Map(rawEntries.map((entry) => [entry.task.id, entry.task])).values()].map(
    (task) => ({
      id: task.id,
      title: task.title,
      categoryId: task.categoryId,
      estimateMin: task.estimateMin,
    }),
  );

  const categoryTotals = sumByCategory(entries, tasks, categories, range, now);

  return {
    range,
    categoryTotals,
    daily: dailyTotals(entries, tasks, range, now),
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
    })),
    totalMinutes: categoryTotals.reduce((sum, total) => sum + total.minutes, 0),
    interruptionCount: countInterruptions(entries, range),
    averageFocusMinutes: averageFocusMin(entries, range, now),
    estimates: estimateComparisons(tasks, entries, now),
  };
}
```

- [ ] **Step 2: カテゴリ別の円グラフを書く**

`src/components/category-pie.tsx`:

```tsx
"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { CategoryTotal } from "@/lib/aggregate";

export function CategoryPie({ totals }: { totals: CategoryTotal[] }) {
  if (totals.length === 0) {
    return <p className="text-muted-foreground text-sm">この期間の記録はありません。</p>;
  }

  const data = totals.map((total) => ({
    name: total.name,
    value: Math.round(total.minutes),
    color: total.color,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" outerRadius={100} label>
          {data.map((item) => (
            <Cell key={item.name} fill={item.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value: number) => `${value}分`} />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 3: 日別の積み上げ棒グラフを書く**

`src/components/daily-stack-chart.tsx`:

```tsx
"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DailyTotal } from "@/lib/aggregate";

export function DailyStackChart({
  daily,
  categories,
}: {
  daily: DailyTotal[];
  categories: { id: number; name: string; color: string }[];
}) {
  const data = daily.map((day) => {
    const row: Record<string, string | number> = { date: day.date.slice(5) };
    for (const category of categories) {
      const found = day.byCategory.find((item) => item.categoryId === category.id);
      row[category.name] = Math.round(found?.minutes ?? 0);
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} unit="分" />
        <Tooltip formatter={(value: number) => `${value}分`} />
        <Legend />
        {categories.map((category) => (
          <Bar key={category.id} dataKey={category.name} stackId="a" fill={category.color} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 4: 分析ページを書く**

`src/app/analytics/page.tsx`:

```tsx
import { CategoryPie } from "@/components/category-pie";
import { DailyStackChart } from "@/components/daily-stack-chart";
import { getAnalytics, type Period } from "@/server/queries/analytics";

export const dynamic = "force-dynamic";

const PERIODS: { label: string; value: Period }[] = [
  { label: "日", value: "day" },
  { label: "週", value: "week" },
  { label: "月", value: "month" },
];

function isPeriod(value: string | undefined): value is Period {
  return value === "day" || value === "week" || value === "month";
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;
  const selected: Period = isPeriod(period) ? period : "week";
  const view = await getAnalytics(selected);

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">分析</h1>
        <p className="text-muted-foreground text-sm">
          {view.range.from} 〜 {view.range.to}
        </p>
      </div>

      <nav className="flex gap-2 text-sm">
        {PERIODS.map((item) => (
          <a
            key={item.value}
            href={`/analytics?period=${item.value}`}
            className={`rounded-md border px-3 py-1 ${selected === item.value ? "bg-accent" : ""}`}
          >
            {item.label}
          </a>
        ))}
      </nav>

      <section className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">合計時間</p>
          <p className="text-2xl font-bold tabular-nums">{(view.totalMinutes / 60).toFixed(1)}h</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">割り込み回数</p>
          <p className="text-2xl font-bold tabular-nums">{view.interruptionCount}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-muted-foreground text-sm">平均継続時間</p>
          <p className="text-2xl font-bold tabular-nums">
            {Math.round(view.averageFocusMinutes)}分
          </p>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">カテゴリ別の時間配分</h2>
        <CategoryPie totals={view.categoryTotals} />
        <ul className="text-sm">
          {view.categoryTotals.map((total) => (
            <li key={total.categoryId} className="flex justify-between border-b py-1">
              <span>{total.name}</span>
              <span className="tabular-nums">
                {Math.round(total.minutes)}分（
                {((total.minutes / view.totalMinutes) * 100).toFixed(0)}%）
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">日ごとの推移</h2>
        <DailyStackChart daily={view.daily} categories={view.categories} />
      </section>

      <section className="space-y-2">
        <h2 className="font-semibold">見積もりと実績</h2>
        {view.estimates.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            見積もりを設定して作業したタスクがまだありません。
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left">
                <th className="py-2">タスク</th>
                <th className="py-2 text-right">見積もり</th>
                <th className="py-2 text-right">実績</th>
                <th className="py-2 text-right">比率</th>
              </tr>
            </thead>
            <tbody>
              {view.estimates.map((estimate) => (
                <tr key={estimate.taskId} className="border-b">
                  <td className="py-2">{estimate.title}</td>
                  <td className="py-2 text-right tabular-nums">{estimate.estimateMin}分</td>
                  <td className="py-2 text-right tabular-nums">
                    {Math.round(estimate.actualMin)}分
                  </td>
                  <td
                    className={`py-2 text-right tabular-nums ${
                      estimate.ratio > 1 ? "text-destructive" : ""
                    }`}
                  >
                    {estimate.ratio.toFixed(1)}倍
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
```

- [ ] **Step 5: 手で動作確認する**

```bash
npm run dev
```

`http://localhost:3000/analytics` を開き、日 / 週 / 月を切り替えて以下を確認する。

1. 円グラフがカテゴリの色で描かれる
2. 日ごとの積み上げ棒が、作業のない日も横軸に出る
3. 割り込み回数と平均継続時間が数値で出る
4. 見積もりを超えたタスクの比率が赤くなる

- [ ] **Step 6: lint / format / build を通す**

```bash
npm run format
npm run lint
npm run build
```

- [ ] **Step 7: コミット**

```bash
git add -A
git commit -m "feat: 分析画面（カテゴリ配分・日次推移・割り込み・見積もり比）を追加"
```

---

## Task 8: Stop 忘れの復旧

タブのタイトル表示と2時間超の警告は Task 5 で実装済み。ここでは残る「起動時に放置エントリを検出して終了時刻を確認する」を作る。

**Files:**

- Create: `src/components/stale-entry-dialog.tsx`
- Modify: `src/app/page.tsx`, `src/server/queries/today.ts`

**Interfaces:**

- Consumes: `updateEntryTimes`（Task 4）/ `TodayView`（Task 5）
- Produces: `TodayView` に `staleRunning: { entryId: number; title: string; startedAt: Date } | null` を追加する

- [ ] **Step 1: getTodayView に放置エントリの判定を足す**

`src/server/queries/today.ts` を編集する。まずファイル先頭の import に `differenceInHours` を追加する。

```ts
import { differenceInHours, endOfDay, startOfDay } from "date-fns";
```

`TodayView` 型に以下のフィールドを追加する。

```ts
  /** 開始から8時間以上経過した計測中エントリ。Stop 忘れの可能性が高い */
  staleRunning: { entryId: number; title: string; startedAt: Date } | null;
```

`return` 文の直前に判定を追加する。

```ts
const STALE_THRESHOLD_HOURS = 8;
const staleRunning =
  runningRaw && differenceInHours(now, runningRaw.startedAt) >= STALE_THRESHOLD_HOURS
    ? {
        entryId: runningRaw.id,
        title: runningRaw.task.title,
        startedAt: runningRaw.startedAt,
      }
    : null;
```

`return` するオブジェクトに `staleRunning,` を追加する。

- [ ] **Step 2: 復旧ダイアログを書く**

`src/components/stale-entry-dialog.tsx`。`window.confirm` などのブラウザモーダルは使わない。

```tsx
"use client";

import { format } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateEntryTimes } from "@/server/actions/timer";

export function StaleEntryDialog({
  entryId,
  title,
  startedAt,
}: {
  entryId: number;
  title: string;
  startedAt: Date;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="border-destructive space-y-3 rounded-lg border p-4">
      <div>
        <p className="font-medium">Stop 忘れかもしれません</p>
        <p className="text-muted-foreground text-sm">
          「{title}」が {format(startedAt, "M/d HH:mm")} から計測中のままです。
          実際の終了時刻を入れて直せます。
        </p>
      </div>

      <form
        action={async (formData: FormData) => {
          const value = String(formData.get("endedAt") ?? "");
          if (value === "") return;
          await updateEntryTimes({ entryId, startedAt, endedAt: new Date(value) });
          setDismissed(true);
        }}
        className="flex items-end gap-2"
      >
        <Input
          type="datetime-local"
          name="endedAt"
          defaultValue={format(startedAt, "yyyy-MM-dd'T'HH:mm")}
          required
        />
        <Button type="submit">この時刻で終了にする</Button>
        <Button type="button" variant="ghost" onClick={() => setDismissed(true)}>
          このまま続ける
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: 今日の画面に組み込む**

`src/app/page.tsx` の import に追加する。

```tsx
import { StaleEntryDialog } from "@/components/stale-entry-dialog";
```

`<h1>` の直後に以下を挿入する。

```tsx
{
  view.staleRunning && (
    <StaleEntryDialog
      entryId={view.staleRunning.entryId}
      title={view.staleRunning.title}
      startedAt={view.staleRunning.startedAt}
    />
  );
}
```

- [ ] **Step 4: 手で動作確認する**

放置エントリを再現するため、開発用 DB のエントリの開始時刻を直接過去にずらす。

```bash
npm run dev
```

別のターミナルで、計測を開始したうえで以下を実行する。

```bash
sqlite3 prisma/dev.db "UPDATE entries SET started_at = datetime('now', '-10 hours') WHERE ended_at IS NULL;"
```

`http://localhost:3000` をリロードし、以下を確認する。

1. 復旧ダイアログが表示される
2. 終了時刻を入れて送信すると計測が終了し、ログに反映される
3. 「このまま続ける」で表示だけ消せる

- [ ] **Step 5: 全テストと lint / format / build を通す**

```bash
npm test
npm run format
npm run lint
npm run build
```

Expected: テストは 21 passed。lint・build ともエラーなし。

- [ ] **Step 6: コミット**

```bash
git add -A
git commit -m "feat: Stop 忘れエントリの検出と復旧ダイアログを追加"
```

---

## 完了条件

- [ ] `npm test` が全て通る
- [ ] `npm run lint` がエラー0
- [ ] `npm run build` が成功する
- [ ] 今日 / タスク / 分析 の3画面が動作する
- [ ] 計測中に別タスクを Start すると割り込みとして記録される
- [ ] 計測中のエントリが2件になることがない
- [ ] リロードしても経過時間がズレない
