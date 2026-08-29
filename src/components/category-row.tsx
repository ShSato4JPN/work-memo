"use client";

import { CategoryColorPicker } from "@/components/category-color-picker";
import { useCategoryRow } from "@/hooks/use-category-row";
import type { CategoryListItem } from "@/server/queries/categories";

/**
 * カテゴリ1件の行。その場で名前と色を編集でき、未使用なら削除もできる。
 *
 * タスクは categoryId で紐づいているので、名前を変えても過去の記録は壊れない。
 */
export function CategoryRow({ category }: { category: CategoryListItem }) {
  const row = useCategoryRow(category);

  if (!row.editing) {
    return (
      <li className="bg-card flex items-center gap-4 rounded-3xl px-5 py-4 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
        <span
          aria-hidden
          className="size-5 shrink-0 rounded-full"
          style={{ backgroundColor: category.color }}
        />
        <span className="min-w-0 flex-1 truncate text-base font-bold">{category.name}</span>
        <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
          {category.taskCount === 0 ? "未使用" : `${category.taskCount}件のタスク`}
        </span>
        <button
          type="button"
          onClick={row.openEditor}
          aria-label={`「${category.name}」を編集`}
          className="border-input hover:bg-accent focus-visible:ring-ring shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition focus-visible:ring-4 focus-visible:outline-none"
        >
          編集
        </button>
      </li>
    );
  }

  return (
    <li className="bg-card rounded-3xl p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
      <form
        action={row.save}
        className="space-y-4"
        onKeyDown={(event) => {
          if (event.key === "Escape") row.cancelEdit();
        }}
      >
        <input
          autoFocus
          value={row.name}
          onChange={(event) => row.setName(event.target.value)}
          aria-label="カテゴリ名"
          className="border-input bg-background h-12 w-full rounded-2xl border px-4 text-base outline-none focus-visible:ring-4 focus-visible:ring-current/20"
        />

        <CategoryColorPicker
          value={row.color}
          onChange={row.setColor}
          name={`color-${category.id}`}
        />

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">
            {category.taskCount === 0 ? "未使用" : `${category.taskCount}件のタスクで使用中`}
          </span>
          <span className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={row.cancelEdit}
              className="text-muted-foreground hover:bg-accent rounded-full px-4 py-2.5 text-sm font-bold"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={row.pending}
              className="bg-primary focus-visible:ring-primary rounded-full px-6 py-2.5 text-sm font-bold text-white transition hover:brightness-95 focus-visible:ring-4 focus-visible:outline-none disabled:opacity-60"
            >
              {row.pending ? "保存中…" : "保存"}
            </button>
          </span>
        </div>

        {row.error && <p className="text-live text-sm font-bold">{row.error}</p>}
      </form>

      <div className="border-border mt-4 border-t pt-4">
        {row.confirmingDelete ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-muted-foreground flex-1 text-sm">
              このカテゴリを削除します。元に戻せません。
            </p>
            <button
              type="button"
              onClick={() => row.setConfirmingDelete(false)}
              className="text-muted-foreground hover:bg-accent rounded-full px-4 py-2 text-sm font-bold"
            >
              やめる
            </button>
            <button
              type="button"
              onClick={row.remove}
              disabled={row.pending}
              className="bg-live focus-visible:ring-live rounded-full px-5 py-2 text-sm font-bold text-white transition hover:brightness-95 focus-visible:ring-4 focus-visible:outline-none disabled:opacity-60"
            >
              削除する
            </button>
          </div>
        ) : row.canDelete ? (
          <button
            type="button"
            onClick={() => row.setConfirmingDelete(true)}
            className="text-live hover:bg-live-soft rounded-full px-4 py-2 text-sm font-bold transition"
          >
            このカテゴリを削除
          </button>
        ) : (
          // 使用中のカテゴリを消すと、過去の記録がどの分類だったのか復元できなくなる
          <p className="text-muted-foreground text-sm">
            タスクで使われているカテゴリは削除できません。
          </p>
        )}
      </div>
    </li>
  );
}
