"use client";

import { useDayTimeline } from "@/hooks/use-day-timeline";
import { formatClockLabel, formatDuration } from "@/lib/format";
import type { TimelineInput } from "@/lib/timeline";

type Props = {
  entries: TimelineInput[];
  day: Date;
  now: Date;
};

const MINUTES_PER_DAY = 24 * 60;
/** 1分あたりの幅(px)。10分の目盛りが 10px になるので、目で刻みを追える */
const PX_PER_MINUTE = 1;
const TRACK_WIDTH = MINUTES_PER_DAY * PX_PER_MINUTE;
const TICK_MINUTES = 10;
const LABEL_COLUMN_WIDTH = 128;

const TICKS = Array.from(
  { length: MINUTES_PER_DAY / TICK_MINUTES + 1 },
  (_, index) => index * TICK_MINUTES,
);

/**
 * 1日を横の時間軸で見る。0時から24時までを常に表示し、10分刻みの目盛りを引く。
 *
 * タスクごとに1行なので、並行して計測した作業も重ならずに読める。
 * 位置・長さ・行分けの計算は useDayTimeline に任せ、ここでは描画だけを行う。
 */
export function DayTimeline({ entries, day, now }: Props) {
  const { rows, nowMinute, scrollRef } = useDayTimeline(
    entries,
    day,
    now,
    PX_PER_MINUTE,
    MINUTES_PER_DAY,
  );

  if (rows.length === 0) {
    return (
      <p className="text-muted-foreground rounded-2xl border border-dashed px-6 py-10 text-center text-base">
        この日の記録はまだありません。
      </p>
    );
  }

  return (
    // グラフの下端と水平スクロールバーが近すぎるので、下に余白を取る
    <div ref={scrollRef} className="overflow-x-auto pb-4">
      <div className="flex" style={{ width: LABEL_COLUMN_WIDTH + TRACK_WIDTH }}>
        {/* タスク名の列。横スクロールしても見えるように固定する */}
        <div className="bg-card sticky left-0 z-20 w-32 shrink-0 pr-3">
          <div className="h-6" />
          <ul className="space-y-1">
            {rows.map((row) => (
              <li key={row.taskId} className="flex h-10 flex-col justify-center">
                <p className="truncate text-sm font-bold" title={row.title}>
                  {row.title}
                </p>
                <p className="text-muted-foreground text-xs tabular-nums">
                  {formatDuration(row.totalMinutes)}
                </p>
              </li>
            ))}
          </ul>
        </div>

        <div className="shrink-0" style={{ width: TRACK_WIDTH }}>
          {/* 時刻の目盛り。1時間ごとにだけ数字を出す */}
          <div className="relative h-6">
            {TICKS.map((minute) =>
              minute % 60 === 0 && minute < MINUTES_PER_DAY ? (
                <span
                  key={minute}
                  className={`text-muted-foreground absolute text-[11px] whitespace-nowrap tabular-nums ${
                    minute === 0 ? "" : "-translate-x-1/2"
                  }`}
                  style={{ left: minute * PX_PER_MINUTE }}
                >
                  {minute / 60}
                </span>
              ) : null,
            )}
          </div>

          <ul className="space-y-1">
            {rows.map((row) => (
              <li key={row.taskId} className="bg-background relative h-10 overflow-hidden">
                {/* 10分ごとの目盛り。1時間の区切りだけ濃くする */}
                {TICKS.map((minute) => (
                  <span
                    key={minute}
                    aria-hidden
                    className={`absolute inset-y-0 border-l ${
                      minute % 60 === 0 ? "border-rule-strong" : "border-border/60"
                    }`}
                    style={{ left: minute * PX_PER_MINUTE }}
                  />
                ))}

                {nowMinute !== null && (
                  <span
                    aria-hidden
                    className="bg-live absolute inset-y-0 z-10 w-px"
                    style={{ left: nowMinute * PX_PER_MINUTE }}
                  />
                )}

                {row.blocks.map((block) => {
                  const width = (block.endMinute - block.startMinute) * PX_PER_MINUTE;
                  const minutes = Math.round(block.endMinute - block.startMinute);

                  return (
                    <span
                      key={block.id}
                      // パディングを持たせると box-sizing: border-box で幅が押し広げられ、
                      // 3分の記録が8分ぶんの長さで描かれて目盛りとずれる。
                      // 余白はラベル側に持たせ、バーの幅は実時間だけで決める。
                      className="absolute inset-y-1 flex items-center overflow-hidden"
                      style={{
                        left: block.startMinute * PX_PER_MINUTE,
                        // 短い記録でも目盛りと比べられるだけの幅を残す
                        width: Math.max(width, 3),
                        backgroundColor: block.categoryColor,
                        boxShadow: block.running ? "0 0 0 2px var(--live)" : undefined,
                      }}
                      title={`${row.title}　${formatClockLabel(block.startMinute)}〜${
                        block.running ? "計測中" : formatClockLabel(block.endMinute)
                      }（${minutes}分）`}
                    >
                      {width > 44 && (
                        <span
                          className="truncate px-1 text-[11px] font-bold text-white"
                          style={{ textShadow: "0 1px 2px rgb(0 0 0 / 0.35)" }}
                        >
                          {block.continuesFromPreviousDay && "← "}
                          {formatClockLabel(block.startMinute)}
                          {block.continuesToNextDay && " →"}
                        </span>
                      )}
                    </span>
                  );
                })}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
