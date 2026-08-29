"use client";

import { useRef, useState } from "react";
import { CategoryColorPicker } from "@/components/category-color-picker";
import { CATEGORY_PALETTE } from "@/lib/category-colors";
import { createCategory } from "@/server/actions/category";

export function AddCategoryForm() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(CATEGORY_PALETTE[0]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  async function submit() {
    setPending(true);
    setError(null);
    try {
      const result = await createCategory({ name, color });
      // 重複などはサーバが理由を返すので、入力を残したまま見せる
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setName("");
      nameRef.current?.focus();
    } catch {
      setError("カテゴリを追加できませんでした。もう一度お試しください。");
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-card hover:bg-accent focus-visible:ring-primary flex w-full items-center justify-center gap-2 rounded-3xl px-6 py-4 text-base font-bold shadow-sm ring-1 ring-black/5 transition focus-visible:ring-4 focus-visible:outline-none dark:ring-white/5"
      >
        <span aria-hidden className="text-primary text-xl leading-none">
          ＋
        </span>
        カテゴリを追加
      </button>
    );
  }

  return (
    <div className="bg-card rounded-3xl p-5 shadow-sm ring-1 ring-black/5 dark:ring-white/5">
      <form
        action={submit}
        className="space-y-4"
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      >
        <input
          ref={nameRef}
          autoFocus
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="カテゴリ名（例: 設計）"
          aria-label="カテゴリ名"
          className="border-input bg-background h-12 w-full rounded-2xl border px-4 text-base outline-none focus-visible:ring-4 focus-visible:ring-current/20"
        />

        <CategoryColorPicker value={color} onChange={setColor} name="new-category-color" />

        <div className="flex items-center gap-2">
          <span className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:bg-accent rounded-full px-4 py-2.5 text-sm font-bold"
            >
              閉じる
            </button>
            <button
              type="submit"
              disabled={pending}
              className="bg-primary focus-visible:ring-primary rounded-full px-6 py-2.5 text-sm font-bold text-white transition hover:brightness-95 focus-visible:ring-4 focus-visible:outline-none disabled:opacity-60"
            >
              {pending ? "追加中…" : "追加する"}
            </button>
          </span>
        </div>

        {error && <p className="text-live text-sm font-bold">{error}</p>}
      </form>
    </div>
  );
}
