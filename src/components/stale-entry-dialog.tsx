"use client";

import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStaleEntryDialog } from "@/hooks/use-stale-entry-dialog";

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
  const dialog = useStaleEntryDialog({ entryId, startedAt, now });
  if (dialog.dismissed) return null;

  return (
    <div className="border-destructive space-y-3 rounded-lg border p-4">
      <div>
        <p className="font-medium">停止し忘れかもしれません</p>
        <p className="text-muted-foreground text-sm">
          「{title}」が {format(startedAt, "M/d HH:mm")} から計測中のままです。
          実際の終了時刻を入れて直せます。
        </p>
      </div>

      <form action={dialog.save} className="flex items-end gap-2">
        <Input
          type="datetime-local"
          name="endedAt"
          aria-label="実際の終了時刻"
          value={dialog.endValue}
          onChange={(event) => dialog.setEndValue(event.target.value)}
          required
        />
        <Button type="submit">この時刻で終了にする</Button>
        <Button type="button" variant="ghost" onClick={dialog.dismiss}>
          このまま続ける
        </Button>
      </form>

      {dialog.error && <p className="text-destructive text-sm">{dialog.error}</p>}
    </div>
  );
}
