"use client";

import { useRef } from "react";

import { CategoryColorPicker } from "@/components/category-color-picker";
import { useAddCategoryForm } from "@/hooks/use-add-category-form";

export function AddCategoryForm() {
  const nameRef = useRef<HTMLInputElement>(null);
  // 続けて登録できるよう、追加できたら名前の欄に戻す
  const form = useAddCategoryForm(() => nameRef.current?.focus());

  if (!form.open) {
    return (
      <button
        type="button"
        onClick={form.openForm}
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
        action={form.submit}
        className="space-y-4"
        onKeyDown={(event) => {
          if (event.key === "Escape") form.closeForm();
        }}
      >
        <input
          ref={nameRef}
          autoFocus
          value={form.name}
          onChange={(event) => form.setName(event.target.value)}
          placeholder="カテゴリ名（例: 設計）"
          aria-label="カテゴリ名"
          className="border-input bg-background h-12 w-full rounded-2xl border px-4 text-base outline-none focus-visible:ring-4 focus-visible:ring-current/20"
        />

        <CategoryColorPicker
          value={form.color}
          onChange={form.setColor}
          name="new-category-color"
        />

        <div className="flex items-center gap-2">
          <span className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={form.closeForm}
              className="text-muted-foreground hover:bg-accent rounded-full px-4 py-2.5 text-sm font-bold"
            >
              閉じる
            </button>
            <button
              type="submit"
              disabled={form.pending}
              className="bg-primary focus-visible:ring-primary rounded-full px-6 py-2.5 text-sm font-bold text-white transition hover:brightness-95 focus-visible:ring-4 focus-visible:outline-none disabled:opacity-60"
            >
              {form.pending ? "追加中…" : "追加する"}
            </button>
          </span>
        </div>

        {form.error && <p className="text-live text-sm font-bold">{form.error}</p>}
      </form>
    </div>
  );
}
