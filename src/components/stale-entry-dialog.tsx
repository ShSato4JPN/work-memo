"use client";

import { format } from "date-fns";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateEntryTimes } from "@/server/actions/timer";

export function StaleEntryDialog({
  entryId,
  title,
  startedAt,
  now,
}: {
  entryId: number;
  title: string;
  startedAt: Date;
  now: Date;
}) {
  const [dismissed, setDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (dismissed) return null;

  return (
    <div className="border-destructive space-y-3 rounded-lg border p-4">
      <div>
        <p className="font-medium">Stop 忘れかもしれません</p>
        <p className="text-muted-foreground text-sm">
          「{title}」が {format(startedAt, "M/d HH:mm")} から計測中のままです。
          実際の終了時刻を入れて直せます。
        </p>
      </div>

      <form
        action={async (formData: FormData) => {
          const value = String(formData.get("endedAt") ?? "");
          if (value === "") return;
          const endedAt = new Date(value);
          if (endedAt <= startedAt) {
            setError("終了時刻は開始時刻より後にしてください");
            return;
          }
          setError(null);
          try {
            await updateEntryTimes({ entryId, startedAt, endedAt });
            setDismissed(true);
          } catch {
            setError("保存に失敗しました。もう一度お試しください。");
          }
        }}
        className="flex items-end gap-2"
      >
        <Input
          type="datetime-local"
          name="endedAt"
          aria-label="実際の終了時刻"
          defaultValue={format(now, "yyyy-MM-dd'T'HH:mm")}
          required
        />
        <Button type="submit">この時刻で終了にする</Button>
        <Button type="button" variant="ghost" onClick={() => setDismissed(true)}>
          このまま続ける
        </Button>
      </form>

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
