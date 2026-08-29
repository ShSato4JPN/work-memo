"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/submit-button";
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
  const [createError, setCreateError] = useState<string | null>(null);
  // React は action 完了後に非制御の入力をリセットするため、
  // 失敗しても入力を失わないよう新規作成フォームの入力は制御コンポーネントにする
  const [newTitle, setNewTitle] = useState("");
  const [newCategoryId, setNewCategoryId] = useState(String(categories[0]?.id ?? ""));
  const [newEstimate, setNewEstimate] = useState("");

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
        action={async () => {
          try {
            const result = await createTaskAndStart({
              title: newTitle,
              categoryId: Number(newCategoryId),
              estimateMin: newEstimate === "" ? null : Number(newEstimate),
            });
            if (!result.ok) {
              // 入力内容は残したままメッセージだけ出す
              setCreateError(result.message);
              return;
            }
          } catch {
            setCreateError("タスクを作成できませんでした。もう一度お試しください。");
            return;
          }
          setCreateError(null);
          setKeyword("");
          setNewTitle("");
          setNewEstimate("");
        }}
        className="space-y-2 border-t pt-4"
      >
        <Label htmlFor="new-title">新しいタスクを作って開始</Label>
        <Input
          id="new-title"
          name="title"
          placeholder="タスク名"
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          required
        />
        <div className="flex gap-2">
          <select
            name="categoryId"
            aria-label="カテゴリ"
            className="border-input h-9 flex-1 rounded-md border px-3 text-sm"
            value={newCategoryId}
            onChange={(event) => setNewCategoryId(event.target.value)}
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
            aria-label="見積もり(分)"
            className="w-36"
            value={newEstimate}
            onChange={(event) => setNewEstimate(event.target.value)}
          />
        </div>
        <SubmitButton className="w-full">作成して Start</SubmitButton>
        {createError && <p className="text-destructive text-sm">{createError}</p>}
      </form>
    </div>
  );
}
