"use client";

import { useState } from "react";
import { CategoryColorPicker } from "@/components/category-color-picker";
import { updateCategory } from "@/server/actions/category";
import type { CategoryListItem } from "@/server/queries/categories";

/**
 * カテゴリ1件の行。その場で名前と色を編集できる。
 *
 * タスクは categoryId で紐づいているので、名前を変えても過去の記録は壊れない。
 */
export function CategoryRow({ category }: { category: CategoryListItem }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function cancel() {
    // 編集前の値に戻してから閉じる
    setName(category.name);
    setColor(category.color);
    setError(null);
    setEditing(false);
  }

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const result = await updateCategory({ id: category.id, name, color });
      // 重複などはサーバが理由を返すので、入力を残したまま見せる
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setEditing(false);
    } catch {
      setError("カテゴリを変更できませんでした。もう一度お試しください。");
    } finally {
      setPending(false);
    }
  }

  if (!editing) {
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
          onClick={() => setEditing(true)}
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
        action={submit}
        className="space-y-4"
        onKeyDown={(event) => {
          if (event.key === "Escape") cancel();
        }}
      >
        <input
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          aria-label="カテゴリ名"
          className="border-input bg-background h-12 w-full rounded-2xl border px-4 text-base outline-none focus-visible:ring-4 focus-visible:ring-current/20"
        />

        <CategoryColorPicker value={color} onChange={setColor} name={`color-${category.id}`} />

        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">
            {category.taskCount === 0 ? "未使用" : `${category.taskCount}件のタスクで使用中`}
          </span>
          <span className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={cancel}
              className="text-muted-foreground hover:bg-accent rounded-full px-4 py-2.5 text-sm font-bold"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={pending}
              className="bg-primary focus-visible:ring-primary rounded-full px-6 py-2.5 text-sm font-bold text-white transition hover:brightness-95 focus-visible:ring-4 focus-visible:outline-none disabled:opacity-60"
            >
              {pending ? "保存中…" : "保存"}
            </button>
          </span>
        </div>

        {error && <p className="text-live text-sm font-bold">{error}</p>}
      </form>
    </li>
  );
}
