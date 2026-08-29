"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
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
        <Pie data={data} dataKey="value" nameKey="name" outerRadius={100} label>
          {data.map((item) => (
            <Cell key={item.name} fill={item.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => `${value}分`} />
      </PieChart>
    </ResponsiveContainer>
  );
}
