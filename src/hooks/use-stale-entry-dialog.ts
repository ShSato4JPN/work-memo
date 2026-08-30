"use client";

import { format } from "date-fns";
import { useState } from "react";

import { useActionState } from "@/hooks/use-action-state";
import { updateEntryTimes } from "@/server/actions/timer";

export type UseStaleEntryDialog = {
  dismissed: boolean;
  dismiss: () => void;
  endValue: string;
  setEndValue: (value: string) => void;
  save: () => Promise<void>;
  error: string | null;
};

/**
 * 停止し忘れの記録を、実際の終了時刻で締めるパネルのふるまい。
 *
 * 開始より前の時刻はここで弾き、未来かどうかの判断はサーバに任せる
 * （クライアントの時計は当てにできない）。
 */
export function useStaleEntryDialog(input: {
  entryId: number;
  startedAt: Date;
  now: Date;
}): UseStaleEntryDialog {
  const [dismissed, setDismissed] = useState(false);
  const [endValue, setEndValue] = useState(() => format(input.now, "yyyy-MM-dd'T'HH:mm"));
  const [inputError, setInputError] = useState<string | null>(null);
  const { error, run, clearError } = useActionState();

  return {
    dismissed,
    dismiss: () => setDismissed(true),

    endValue,
    setEndValue: (value) => {
      setInputError(null);
      clearError();
      setEndValue(value);
    },

    save: async () => {
      if (endValue === "") {
        setInputError("終了時刻を入力してください");
        return;
      }
      const endedAt = new Date(endValue);
      if (Number.isNaN(endedAt.getTime())) {
        setInputError("終了時刻の形式が正しくありません");
        return;
      }
      if (endedAt <= input.startedAt) {
        setInputError("終了時刻は開始時刻より後にしてください");
        return;
      }
      setInputError(null);

      const ok = await run(
        () => updateEntryTimes({ entryId: input.entryId, startedAt: input.startedAt, endedAt }),
        "保存に失敗しました。もう一度お試しください。",
      );
      if (ok) setDismissed(true);
    },

    error: inputError ?? error,
  };
}
