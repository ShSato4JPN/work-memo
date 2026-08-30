"use client";

import { useState } from "react";

import { useActionState } from "@/hooks/use-action-state";
import { deleteCategory, updateCategory } from "@/server/actions/category";
import type { CategoryListItem } from "@/server/queries/categories";

export type UseCategoryRow = {
  editing: boolean;
  openEditor: () => void;
  cancelEdit: () => void;
  name: string;
  setName: (value: string) => void;
  color: string;
  setColor: (value: string) => void;
  save: () => Promise<void>;
  confirmingDelete: boolean;
  setConfirmingDelete: (value: boolean) => void;
  /** タスクに使われているカテゴリは、過去の集計の分類が失われるため消せない */
  canDelete: boolean;
  remove: () => Promise<void>;
  pending: boolean;
  error: string | null;
};

/** カテゴリ1行のふるまい。名前と色の編集、削除の確認をまとめる */
export function useCategoryRow(category: CategoryListItem): UseCategoryRow {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const { pending, error, run, clearError } = useActionState();

  return {
    editing,
    openEditor: () => setEditing(true),
    cancelEdit: () => {
      // 編集前の値に戻してから閉じる
      setName(category.name);
      setColor(category.color);
      clearError();
      setConfirmingDelete(false);
      setEditing(false);
    },

    name,
    setName: (value) => {
      clearError();
      setName(value);
    },
    color,
    setColor,
    save: async () => {
      const ok = await run(
        () => updateCategory({ id: category.id, name, color }),
        "カテゴリを変更できませんでした。もう一度お試しください。",
      );
      if (ok) setEditing(false);
    },

    confirmingDelete,
    setConfirmingDelete,
    canDelete: category.taskCount === 0,
    remove: async () => {
      // 成功すると行そのものが一覧から消えるので、閉じる操作は要らない
      const ok = await run(
        () => deleteCategory(category.id),
        "カテゴリを削除できませんでした。もう一度お試しください。",
      );
      if (!ok) setConfirmingDelete(false);
    },

    pending,
    error,
  };
}
