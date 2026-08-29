"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { stopTimer } from "@/server/actions/timer";

const WARN_THRESHOLD_MIN = 120;

function formatElapsed(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function RunningTimer({
  title,
  categoryName,
  categoryColor,
  startedAt,
}: {
  title: string;
  categoryName: string;
  categoryColor: string;
  startedAt: Date;
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(() =>
    Math.floor((Date.now() - startedAt.getTime()) / 1000),
  );

  useEffect(() => {
    const timerId = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startedAt.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(timerId);
  }, [startedAt]);

  const label = formatElapsed(elapsedSeconds);

  useEffect(() => {
    document.title = `${label} ${title}`;
    return () => {
      document.title = "作業時間トラッカー";
    };
  }, [label, title]);

  const isTooLong = elapsedSeconds > WARN_THRESHOLD_MIN * 60;

  return (
    <div className="flex items-center gap-4 rounded-lg border p-4">
      <span
        className="size-3 shrink-0 rounded-full"
        style={{ backgroundColor: categoryColor }}
        aria-hidden
      />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{title}</p>
        <p className="text-muted-foreground text-sm">{categoryName}</p>
      </div>
      <p className="font-mono text-3xl tabular-nums">{label}</p>
      {isTooLong && (
        <p className="text-destructive text-sm">
          {WARN_THRESHOLD_MIN / 60}時間を超えています。Stop 忘れではありませんか？
        </p>
      )}
      <form action={stopTimer}>
        <Button type="submit" variant="secondary">
          Stop
        </Button>
      </form>
    </div>
  );
}
