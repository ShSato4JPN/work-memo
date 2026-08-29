"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTaskAndStart, startTimer } from "@/server/actions/timer";

export function StartPanel({
  activeTasks,
  categories,
}: {
  activeTasks: { id: number; title: string; categoryName: string }[];
  categories: { id: number; name: string; color: string }[];
}) {
  const [keyword, setKeyword] = useState("");

  const matched = activeTasks.filter((task) => task.title.includes(keyword));

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <Label htmlFor="task-keyword">タスクを選ぶ</Label>
        <Input
          id="task-keyword"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="タスク名で絞り込む"
        />
      </div>

      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {matched.map((task) => (
          <li key={task.id}>
            <form action={startTimer.bind(null, task.id)}>
              <Button type="submit" variant="ghost" className="w-full justify-start">
                <span className="truncate">{task.title}</span>
                <span className="text-muted-foreground ml-auto text-xs">{task.categoryName}</span>
              </Button>
            </form>
          </li>
        ))}
      </ul>

      <form
        action={async (formData: FormData) => {
          const estimate = formData.get("estimateMin");
          await createTaskAndStart({
            title: String(formData.get("title") ?? ""),
            categoryId: Number(formData.get("categoryId")),
            estimateMin: estimate ? Number(estimate) : null,
          });
          setKeyword("");
        }}
        className="space-y-2 border-t pt-4"
      >
        <Label htmlFor="new-title">新しいタスクを作って開始</Label>
        <Input id="new-title" name="title" placeholder="タスク名" required />
        <div className="flex gap-2">
          <select
            name="categoryId"
            aria-label="カテゴリ"
            className="border-input h-9 flex-1 rounded-md border px-3 text-sm"
            required
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <Input
            name="estimateMin"
            type="number"
            min={1}
            placeholder="見積もり(分)"
            className="w-36"
          />
        </div>
        <Button type="submit" className="w-full">
          作成して Start
        </Button>
      </form>
    </div>
  );
}
