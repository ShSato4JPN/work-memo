"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartTooltip } from "@/components/chart-tooltip";
import type { DailyTotal } from "@/lib/aggregate";

export function DailyStackChart({
  daily,
  categories,
}: {
  daily: DailyTotal[];
  categories: { id: number; name: string; color: string }[];
}) {
  const data = daily.map((day) => {
    const row: Record<string, string | number> = { date: day.date.slice(5) };
    for (const category of categories) {
      const found = day.byCategory.find((item) => item.categoryId === category.id);
      row[String(category.id)] = Math.round(found?.minutes ?? 0);
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} unit="分" />
        <Tooltip
          content={<ChartTooltip labelPrefix="" />}
          cursor={{ fill: "var(--accent)", radius: 8 }}
        />
        <Legend />
        {categories.map((category) => (
          <Bar
            key={category.id}
            dataKey={String(category.id)}
            name={category.name}
            stackId="a"
            fill={category.color}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
