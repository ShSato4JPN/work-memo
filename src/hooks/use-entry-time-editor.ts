"use client";

import { format } from "date-fns";
import { useState } from "react";
import { useActionState } from "@/hooks/use-action-state";
import { parseEntryTimeInput } from "@/lib/entry-time-input";
import { updateEntryTimes } from "@/server/actions/timer";

function toInputValue(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

export type UseEntryTimeEditor = {
  open: boolean;
  openEditor: () => void;
  close: () => void;
  /** 計測中の記録は開始時刻だけを直せる。終了は「停止」に一本化している */
  isRunning: boolean;
  startValue: string;
  setStartValue: (value: string) => void;
  endValue: string;
  setEndValue: (value: string) => void;
  save: () => Promise<void>;
  error: string | null;
};

/**
 * 記録1件の時刻修正フォームのふるまい。
 *
 * 入力は制御コンポーネントとして持つ。エラーで弾かれたときに打った値が消えると、
 * 何が悪かったのか確かめられないまま入れ直しになるため。
 */
export function useEntryTimeEditor(input: {
  entryId: number;
  startedAt: Date;
  endedAt: Date | null;
}): UseEntryTimeEditor {
  const isRunning = input.endedAt === null;
  const initialStart = toInputValue(input.startedAt);
  const initialEnd = input.endedAt === null ? "" : toInputValue(input.endedAt);

  const [open, setOpen] = useState(false);
  const [startValue, setStartValue] = useState(initialStart);
  const [endValue, setEndValue] = useState(initialEnd);
  const { error, run, clearError } = useActionState();
  const [inputError, setInputError] = useState<string | null>(null);

  return {
    open,
    openEditor: () => setOpen(true),
    close: () => {
      // 編集前の値に戻してから閉じる
      setStartValue(initialStart);
      setEndValue(initialEnd);
      setInputError(null);
      clearError();
      setOpen(false);
    },

    isRunning,
    startValue,
    setStartValue: (value) => {
      setInputError(null);
      clearError();
      setStartValue(value);
    },
    endValue,
    setEndValue: (value) => {
      setInputError(null);
      clearError();
      setEndValue(value);
    },

    save: async () => {
      const parsed = parseEntryTimeInput({ startValue, endValue, isRunning });
      if (!parsed.ok) {
        setInputError(parsed.message);
        return;
      }
      setInputError(null);

      // 未来かどうかの判断はサーバに任せる。クライアントの時計は当てにできない
      const ok = await run(
        () =>
          updateEntryTimes({
            entryId: input.entryId,
            startedAt: parsed.startedAt,
            endedAt: parsed.endedAt,
          }),
        "保存に失敗しました。もう一度お試しください。",
      );
      if (ok) setOpen(false);
    },

    error: inputError ?? error,
  };
}
