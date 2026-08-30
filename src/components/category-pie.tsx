"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { ChartTooltip } from "@/components/chart-tooltip";
import type { CategoryTotal } from "@/lib/aggregate";

export function CategoryPie({ totals }: { totals: CategoryTotal[] }) {
  if (totals.length === 0) {
    return <p className="text-muted-foreground text-sm">この期間の記録はありません。</p>;
  }

  const data = totals.map((total) => ({
    name: total.name,
    value: Math.round(total.minutes),
    color: total.color,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        {/* 単位のない数字だけだと何分なのか読めないので、名前と分数をラベルにする */}
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          outerRadius={90}
          labelLine={false}
          label={({ name, value }) => `${name} ${value}分`}
        >
          {data.map((item) => (
            <Cell key={item.name} fill={item.color} />
          ))}
        </Pie>
        <Tooltip content={<ChartTooltip />} cursor={false} />
      </PieChart>
    </ResponsiveContainer>
  );
}
