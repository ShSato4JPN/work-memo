"use client";

import { useState } from "react";
import { useActionState } from "@/hooks/use-action-state";
import { CATEGORY_PALETTE } from "@/lib/category-colors";
import { createCategory } from "@/server/actions/category";

export type UseAddCategoryForm = {
  open: boolean;
  openForm: () => void;
  closeForm: () => void;
  name: string;
  setName: (value: string) => void;
  color: string;
  setColor: (value: string) => void;
  submit: () => Promise<void>;
  pending: boolean;
  error: string | null;
};

/**
 * カテゴリ追加フォームのふるまい。
 * タスク追加と同じく、追加してもフォームは閉じず続けて登録できる。
 * 入力欄への再フォーカスは onAdded で呼び出し側に任せる。
 */
export function useAddCategoryForm(onAdded?: () => void): UseAddCategoryForm {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(CATEGORY_PALETTE[0]);
  const { pending, error, run, clearError } = useActionState();

  return {
    open,
    openForm: () => setOpen(true),
    closeForm: () => setOpen(false),

    name,
    setName: (value) => {
      clearError();
      setName(value);
    },
    color,
    setColor,

    submit: async () => {
      const ok = await run(
        () => createCategory({ name, color }),
        "カテゴリを追加できませんでした。もう一度お試しください。",
      );
      if (!ok) return;

      setName("");
      onAdded?.();
    },

    pending,
    error,
  };
}
