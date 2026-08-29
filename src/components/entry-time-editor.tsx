"use client";

import { format } from "date-fns";
import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateEntryTimes } from "@/server/actions/timer";

function toInputValue(date: Date): string {
  return format(date, "yyyy-MM-dd'T'HH:mm");
}

/**
 * ログ1行の開始・終了時刻をその場で修正する。
 *
 * 計測中（endedAt が null）のエントリは開始時刻だけを編集できる。
 * ここで終了時刻を入れられると「Stop したつもりがない計測が終わる」ことになり、
 * 計測を終わらせる手段が Stop ボタンと復旧パネルに一本化されなくなるため。
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

  const isRunning = endedAt === null;

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label={`「${title}」の時刻を修正`}
      >
        時刻
      </Button>
    );
  }

  return (
    <div className="bg-muted/40 basis-full space-y-2 rounded-md border p-3">
      <form
        action={async (formData: FormData) => {
          const startValue = String(formData.get("startedAt") ?? "");
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
            const endValue = String(formData.get("endedAt") ?? "");
            if (endValue === "") {
              setError("終了時刻を入力してください");
              return;
            }
            nextEndedAt = new Date(endValue);
            if (Number.isNaN(nextEndedAt.getTime())) {
              setError("終了時刻の形式が正しくありません");
              return;
            }
            if (nextEndedAt <= nextStartedAt) {
              setError("終了時刻は開始時刻より後にしてください");
              return;
            }
          }

          setError(null);
          try {
            await updateEntryTimes({ entryId, startedAt: nextStartedAt, endedAt: nextEndedAt });
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
          defaultValue={toInputValue(startedAt)}
          className="w-52"
          required
        />
        {isRunning ? (
          <p className="text-muted-foreground text-xs">
            計測中のエントリは開始時刻のみ修正できます（終了は Stop から）
          </p>
        ) : (
          <Input
            type="datetime-local"
            name="endedAt"
            aria-label="終了時刻"
            defaultValue={toInputValue(endedAt)}
            className="w-52"
            required
          />
        )}
        <SubmitButton size="sm">保存</SubmitButton>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          キャンセル
        </Button>
      </form>

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
