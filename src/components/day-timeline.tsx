import { layoutDay, type TimelineInput } from "@/lib/timeline";

type Props = {
  entries: TimelineInput[];
  day: Date;
  now: Date;
};

function formatHourLabel(hour: number): string {
  return `${hour}時`;
}

function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded}分`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${hours}時間` : `${hours}時間${rest}分`;
}

function clockLabel(minuteOfDay: number): string {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = Math.floor(minuteOfDay % 60);
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * 1日を横の時間軸で見る。タスクごとに1行なので、並行して計測した作業も
 * 重ならずに読める（ガントチャートと同じ並べ方）。
 *
 * 位置と長さの計算は layoutDay（テスト済みの純粋関数）に任せ、
 * ここでは行への振り分けと描画だけを行う。
 */
export function DayTimeline({ entries, day, now }: Props) {
  const blocks = layoutDay(entries, day, now);

  if (blocks.length === 0) {
    return (
      <p className="text-muted-foreground rounded-2xl border border-dashed px-6 py-10 text-center text-base">
        この日の記録はまだありません。
      </p>
    );
  }

  const firstMinute = Math.min(...blocks.map((block) => block.startMinute));
  const lastMinute = Math.max(...blocks.map((block) => block.endMinute));
  // 記録のある時間帯だけを、前後1時間の余白付きで描く
  const fromHour = Math.max(0, Math.floor(firstMinute / 60) - 1);
  const toHour = Math.min(24, Math.ceil(lastMinute / 60) + 1);
  const spanMinutes = (toHour - fromHour) * 60;
  const offsetMinutes = fromHour * 60;
  const hours = Array.from({ length: toHour - fromHour + 1 }, (_, index) => fromHour + index);

  const percentOf = (minute: number) => ((minute - offsetMinutes) / spanMinutes) * 100;

  // タスクごとに1行。行の順番は、その日に最初に触った順
  const rows = new Map<number, { title: string; color: string; blocks: typeof blocks }>();
  for (const block of blocks) {
    const row = rows.get(block.taskId);
    if (row) {
      row.blocks.push(block);
    } else {
      rows.set(block.taskId, {
        title: block.title,
        color: block.categoryColor,
        blocks: [block],
      });
    }
  }

  const nowMinute = (now.getTime() - new Date(day).setHours(0, 0, 0, 0)) / 60000;
  const showNowLine = nowMinute >= offsetMinutes && nowMinute <= toHour * 60;

  const lastIndex = hours.length - 1;

  return (
    <div>
      <div>
        {/* 時刻の目盛り。両端はコンテナからはみ出さないよう寄せる */}
        <div className="flex">
          <div className="w-32 shrink-0 sm:w-40" />
          <div className="relative h-6 min-w-0 flex-1">
            {hours.map((hour, index) => (
              <span
                key={hour}
                className={`text-muted-foreground absolute text-xs whitespace-nowrap tabular-nums ${
                  index === 0 ? "" : index === lastIndex ? "-translate-x-full" : "-translate-x-1/2"
                }`}
                style={{ left: `${percentOf(hour * 60)}%` }}
              >
                {formatHourLabel(hour)}
              </span>
            ))}
          </div>
        </div>

        <ul className="space-y-1.5">
          {[...rows.entries()].map(([taskId, row]) => {
            const totalMinutes = row.blocks.reduce(
              (sum, block) => sum + (block.endMinute - block.startMinute),
              0,
            );

            return (
              <li key={taskId} className="flex items-center">
                <div className="w-32 shrink-0 pr-3 sm:w-40">
                  <p className="truncate text-sm font-bold" title={row.title}>
                    {row.title}
                  </p>
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {formatMinutes(totalMinutes)}
                  </p>
                </div>

                <div className="bg-background relative h-11 min-w-0 flex-1 overflow-hidden rounded-xl">
                  {/* 1時間ごとの区切り */}
                  {hours.map((hour) => (
                    <span
                      key={hour}
                      aria-hidden
                      className="border-border absolute inset-y-0 border-l"
                      style={{ left: `${percentOf(hour * 60)}%` }}
                    />
                  ))}

                  {showNowLine && (
                    <span
                      aria-hidden
                      className="bg-live absolute inset-y-0 z-10 w-px"
                      style={{ left: `${percentOf(nowMinute)}%` }}
                    />
                  )}

                  {row.blocks.map((block) => {
                    const left = percentOf(block.startMinute);
                    const width = ((block.endMinute - block.startMinute) / spanMinutes) * 100;
                    const minutes = Math.round(block.endMinute - block.startMinute);

                    return (
                      <span
                        key={block.id}
                        className="absolute inset-y-1.5 flex items-center overflow-hidden rounded-md px-1.5"
                        style={{
                          left: `${left}%`,
                          // 短い記録でも見えるだけの幅を残す
                          width: `max(${width}%, 8px)`,
                          backgroundColor: block.categoryColor,
                          boxShadow: block.running ? "0 0 0 2px var(--live)" : undefined,
                        }}
                        title={`${row.title}　${clockLabel(block.startMinute)}〜${
                          block.running ? "計測中" : clockLabel(block.endMinute)
                        }（${minutes}分）`}
                      >
                        {width > 12 && (
                          <span
                            className="truncate text-[11px] font-bold text-white"
                            style={{ textShadow: "0 1px 2px rgb(0 0 0 / 0.35)" }}
                          >
                            {block.continuesFromPreviousDay && "← "}
                            {clockLabel(block.startMinute)}
                            {block.continuesToNextDay && " →"}
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
