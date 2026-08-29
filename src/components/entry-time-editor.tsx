"use client";

import { format } from "date-fns";
import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Input } from "@/components/ui/input";
import { updateEntryTimes } from "@/server/actions/timer";

function toInputValue(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

/**
 * ログ1行の開始・終了時刻をその場で修正する。
 *
 * 計測中（endedAt が null）のエントリは開始時刻だけを編集できる。
 * ここで終了時刻を入れられると「停止したつもりがない計測が終わる」ことになり、
 * 計測を終わらせる手段が「停止」ボタンと復旧パネルに一本化されなくなるため。
 *
 * 入力は制御コンポーネントにしている。エラーで弾かれたときに打った値が消えると、
 * 何が悪かったのか確かめられないまま入れ直しになるため。
 */
export function EntryTimeEditor({
  entryId,
  title,
  startedAt,
  endedAt,
}: {
  entryId: number;
  title: string;
  startedAt: Date;
  endedAt: Date | null;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startValue, setStartValue] = useState(() => toInputValue(startedAt));
  const [endValue, setEndValue] = useState(() => (endedAt === null ? "" : toInputValue(endedAt)));

  const isRunning = endedAt === null;

  function close() {
    // 編集前の値に戻してから閉じる
    setStartValue(toInputValue(startedAt));
    setEndValue(endedAt === null ? "" : toInputValue(endedAt));
    setError(null);
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`「${title}」の時刻を修正`}
        className="border-input hover:bg-accent focus-visible:ring-primary rounded-full border px-4 py-2 text-sm font-bold transition focus-visible:ring-4 focus-visible:outline-none"
      >
        時刻を修正
      </button>
    );
  }

  return (
    <div className="bg-background mt-3 basis-full space-y-3 rounded-2xl p-4">
      <form
        action={async () => {
          if (startValue === "") {
            setError("開始時刻を入力してください");
            return;
          }
          const nextStartedAt = new Date(startValue);
          if (Number.isNaN(nextStartedAt.getTime())) {
            setError("開始時刻の形式が正しくありません");
            return;
          }

          let nextEndedAt: Date | null = null;
          if (!isRunning) {
            if (endValue === "") {
              setError("終了時刻を入力してください");
              return;
            }
            nextEndedAt = new Date(endValue);
            if (Number.isNaN(nextEndedAt.getTime())) {
              setError("終了時刻の形式が正しくありません");
              return;
            }
          }

          setError(null);
          try {
            // 未来時刻かどうかの最終判断はサーバに任せる。クライアントの時計は当てにできない
            const result = await updateEntryTimes({
              entryId,
              startedAt: nextStartedAt,
              endedAt: nextEndedAt,
            });
            if (!result.ok) {
              setError(result.message);
              return;
            }
            setOpen(false);
          } catch {
            setError("保存に失敗しました。もう一度お試しください。");
          }
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <Input
          type="datetime-local"
          name="startedAt"
          aria-label="開始時刻"
          value={startValue}
          onChange={(event) => setStartValue(event.target.value)}
          className="border-input bg-card h-11 w-56 rounded-xl border px-3 text-base"
          required
        />
        {isRunning ? (
          <p className="text-muted-foreground text-sm">
            計測中の記録は開始時刻のみ修正できます（終了は「停止」から）
          </p>
        ) : (
          <Input
            type="datetime-local"
            name="endedAt"
            aria-label="終了時刻"
            value={endValue}
            onChange={(event) => setEndValue(event.target.value)}
            className="border-input bg-card h-11 w-56 rounded-xl border px-3 text-base"
            required
          />
        )}
        <SubmitButton className="bg-primary rounded-full px-6 py-2.5 text-sm font-bold text-white hover:brightness-95">
          保存
        </SubmitButton>
        <button
          type="button"
          onClick={close}
          className="text-muted-foreground hover:bg-accent rounded-full px-4 py-2.5 text-sm font-bold"
        >
          キャンセル
        </button>
      </form>

      {error && <p className="text-live text-sm font-bold">{error}</p>}
    </div>
  );
}
