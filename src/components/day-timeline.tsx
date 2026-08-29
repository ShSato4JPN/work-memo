import { format } from "date-fns";
import { layoutDay, type TimelineInput } from "@/lib/timeline";

/** 1分あたりの高さ(px)。1時間 = 56px */
const PX_PER_MINUTE = 56 / 60;

type Props = {
  entries: TimelineInput[];
  day: Date;
  now: Date;
};

/**
 * 1日を縦の時間軸で見る。並行して計測した作業は横に並ぶ。
 *
 * 表示する範囲は「記録のある時間帯だけ」に絞る。24時間すべてを出すと
 * 空白ばかりで、実際に何をしていたかが読み取りにくくなるため。
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
  // 前後1時間の余白を付けて、時間帯の境目が分かるようにする
  const fromHour = Math.max(0, Math.floor(firstMinute / 60) - 1);
  const toHour = Math.min(24, Math.ceil(lastMinute / 60) + 1);
  const hours = Array.from({ length: toHour - fromHour }, (_, index) => fromHour + index);

  const offsetMinutes = fromHour * 60;
  const height = (toHour - fromHour) * 60 * PX_PER_MINUTE;
  const nowMinute = (now.getTime() - new Date(day).setHours(0, 0, 0, 0)) / 60000;
  const showNowLine = nowMinute >= offsetMinutes && nowMinute <= toHour * 60;

  return (
    <div className="flex gap-3">
      {/* 時刻の目盛り */}
      <div className="relative shrink-0" style={{ height, width: 44 }} aria-hidden>
        {hours.map((hour) => (
          <span
            key={hour}
            className="text-muted-foreground absolute right-0 -translate-y-1/2 text-xs tabular-nums"
            style={{ top: (hour * 60 - offsetMinutes) * PX_PER_MINUTE }}
          >
            {String(hour).padStart(2, "0")}:00
          </span>
        ))}
      </div>

      <div className="relative flex-1" style={{ height }}>
        {/* 1時間ごとの罫線 */}
        {hours.map((hour) => (
          <span
            key={hour}
            aria-hidden
            className="border-border absolute inset-x-0 border-t"
            style={{ top: (hour * 60 - offsetMinutes) * PX_PER_MINUTE }}
          />
        ))}

        {showNowLine && (
          <span
            aria-hidden
            className="bg-live absolute inset-x-0 z-10 h-px"
            style={{ top: (nowMinute - offsetMinutes) * PX_PER_MINUTE }}
          >
            <span className="bg-live absolute -top-1 -left-1 size-2 rounded-full" />
          </span>
        )}

        <ul>
          {blocks.map((block) => {
            const top = (block.startMinute - offsetMinutes) * PX_PER_MINUTE;
            const blockHeight = (block.endMinute - block.startMinute) * PX_PER_MINUTE;
            const widthPercent = 100 / block.columnCount;
            const minutes = Math.round(block.endMinute - block.startMinute);
            const compact = blockHeight < 34;

            return (
              <li
                key={block.id}
                className="absolute overflow-hidden rounded-lg px-2 py-1 text-white"
                style={{
                  top,
                  height: Math.max(blockHeight, 16),
                  left: `calc(${block.column * widthPercent}% + 2px)`,
                  width: `calc(${widthPercent}% - 4px)`,
                  backgroundColor: block.categoryColor,
                  // 計測中は縁を光らせて、まだ伸びていることを示す
                  boxShadow: block.running ? "0 0 0 2px var(--live)" : undefined,
                }}
                title={`${block.title} ${format(
                  new Date(new Date(day).setHours(0, block.startMinute, 0, 0)),
                  "HH:mm",
                )}〜 ${minutes}分`}
              >
                <span
                  className={`block truncate font-bold ${compact ? "text-[11px]" : "text-xs"}`}
                  style={{ textShadow: "0 1px 2px rgb(0 0 0 / 0.35)" }}
                >
                  {block.continuesFromPreviousDay && "↑ "}
                  {block.title}
                  {block.continuesToNextDay && " ↓"}
                </span>
                {!compact && (
                  <span
                    className="block truncate text-[11px] opacity-90"
                    style={{ textShadow: "0 1px 2px rgb(0 0 0 / 0.35)" }}
                  >
                    {block.running ? "計測中" : `${minutes}分`}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
