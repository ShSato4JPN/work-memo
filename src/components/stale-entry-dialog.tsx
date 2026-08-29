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
}: {
  entryId: number;
  title: string;
  startedAt: Date;
}) {
  const [dismissed, setDismissed] = useState(false);
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
          await updateEntryTimes({ entryId, startedAt, endedAt: new Date(value) });
          setDismissed(true);
        }}
        className="flex items-end gap-2"
      >
        <Input
          type="datetime-local"
          name="endedAt"
          defaultValue={format(startedAt, "yyyy-MM-dd'T'HH:mm")}
          required
        />
        <Button type="submit">この時刻で終了にする</Button>
        <Button type="button" variant="ghost" onClick={() => setDismissed(true)}>
          このまま続ける
        </Button>
      </form>
    </div>
  );
}
