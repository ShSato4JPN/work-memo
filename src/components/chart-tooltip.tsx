"use client";

/**
 * Recharts が content に渡してくる値のうち、実際に使うものだけを宣言する。
 * ライブラリの型をそのまま受けると必須プロパティが多く、JSX で渡せないため。
 */
type TooltipRow = {
  name?: string;
  dataKey?: string | number;
  value?: number | string | (number | string)[];
  color?: string;
};

type Props = {
  active?: boolean;
  label?: string | number;
  payload?: TooltipRow[];
  labelPrefix?: string;
};

function toMinutes(value: TooltipRow["value"]): number {
  return typeof value === "number" ? value : 0;
}

function formatDuration(minutes: number): string {
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded}分`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${hours}時間` : `${hours}時間${rest}分`;
}

/**
 * グラフ共通のツールチップ。
 * Recharts の既定の見た目（角ばった白い箱）はアプリの丸い配色から浮くので、
 * カードと同じ角丸・影・色トークンで描き直している。
 */
export function ChartTooltip({ active, payload, label, labelPrefix }: Props) {
  if (!active || !payload || payload.length === 0) return null;

  // 値が 0 の系列は並べても読み取りの助けにならないので落とす
  const rows = payload.filter((item) => toMinutes(item.value) > 0);
  if (rows.length === 0) return null;

  const total = rows.reduce((sum, item) => sum + toMinutes(item.value), 0);

  return (
    <div className="bg-popover min-w-40 rounded-2xl px-4 py-3 shadow-lg ring-1 ring-black/10 dark:ring-white/10">
      {label !== undefined && (
        <p className="mb-2 text-sm font-bold">
          {labelPrefix}
          {String(label)}
        </p>
      )}
      <ul className="space-y-1.5">
        {rows.map((item) => (
          <li key={String(item.name ?? item.dataKey)} className="flex items-center gap-2.5 text-sm">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-muted-foreground flex-1">{item.name}</span>
            <span className="font-bold tabular-nums">{formatDuration(toMinutes(item.value))}</span>
          </li>
        ))}
      </ul>
      {rows.length > 1 && (
        <p className="border-border mt-2 flex items-center justify-between border-t pt-2 text-sm">
          <span className="text-muted-foreground">合計</span>
          <span className="font-bold tabular-nums">{formatDuration(total)}</span>
        </p>
      )}
    </div>
  );
}
