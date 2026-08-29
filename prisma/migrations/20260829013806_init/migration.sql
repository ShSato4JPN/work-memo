-- CreateTable
CREATE TABLE "categories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "tasks" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "category_id" INTEGER NOT NULL,
    "estimate_min" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'todo',
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" DATETIME,
    CONSTRAINT "tasks_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "entries" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "task_id" INTEGER NOT NULL,
    "started_at" DATETIME NOT NULL,
    "ended_at" DATETIME,
    "parent_entry_id" INTEGER,
    "note" TEXT,
    CONSTRAINT "entries_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "entries_parent_entry_id_fkey" FOREIGN KEY ("parent_entry_id") REFERENCES "entries" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tasks_title_key" ON "tasks"("title");

-- CreateIndex
CREATE INDEX "tasks_category_id_idx" ON "tasks"("category_id");

-- CreateIndex
CREATE INDEX "entries_started_at_idx" ON "entries"("started_at");

-- CreateIndex
CREATE INDEX "entries_task_id_idx" ON "entries"("task_id");

-- 計測中(ended_at IS NULL)のエントリは全体で最大1件、をDBレベルで保証する
CREATE UNIQUE INDEX "idx_entries_single_running"
  ON "entries" ((1)) WHERE "ended_at" IS NULL;
