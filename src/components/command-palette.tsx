"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TimerBarTask } from "@/server/queries/timer-bar";
import { createTaskAndStart, startTimer } from "@/server/actions/timer";

type Props = {
  onClose: () => void;
  tasks: TimerBarTask[];
  categories: { id: number; name: string; color: string }[];
  runningTaskId: number | null;
};

/**
 * 作業を始めるための唯一の入口。
 * 打つ → 絞り込まれる → Enter で開始、が最短経路。一致するタスクが無ければ
 * 先頭が「新規作成して開始」になるので、既存/新規で入口を分けない。
 */
export function CommandPalette({ onClose, tasks, categories, runningTaskId }: Props) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const [categoryId, setCategoryId] = useState(String(categories[0]?.id ?? ""));
  const [estimate, setEstimate] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const trimmed = query.trim();
  const matched = useMemo(
    () => (trimmed === "" ? tasks : tasks.filter((task) => task.title.includes(trimmed))),
    [tasks, trimmed],
  );
  const exactExists = tasks.some((task) => task.title === trimmed);
  const canCreate = trimmed !== "" && !exactExists;
  const rowCount = matched.length + (canCreate ? 1 : 0);
  const createIndex = canCreate ? matched.length : -1;
  const onCreateRow = cursor === createIndex;

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  async function startExisting(taskId: number) {
    setPending(true);
    setError(null);
    try {
      await startTimer(taskId);
      onClose();
    } catch {
      setError("開始できませんでした。もう一度お試しください。");
    } finally {
      setPending(false);
    }
  }

  async function createAndStart() {
    setPending(true);
    setError(null);
    try {
      const result = await createTaskAndStart({
        title: trimmed,
        categoryId: Number(categoryId),
        estimateMin: estimate === "" ? null : Number(estimate),
      });
      // 重複タイトルなどはサーバが理由を返すので、そのまま見せる
      if (!result.ok) {
        setError(result.message);
        return;
      }
      onClose();
    } catch {
      setError("作成できませんでした。もう一度お試しください。");
    } finally {
      setPending(false);
    }
  }

  function submit() {
    if (pending || rowCount === 0) return;

    if (onCreateRow) {
      void createAndStart();
      return;
    }

    const task = matched[cursor];
    if (task) void startExisting(task.id);
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => (rowCount === 0 ? 0 : (c + 1) % rowCount));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => (rowCount === 0 ? 0 : (c - 1 + rowCount) % rowCount));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 px-4 pt-[12vh] backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="作業を開始"
        className="bg-popover ring-rule-strong/60 w-full max-w-xl overflow-hidden rounded-sm shadow-2xl ring-1"
        onKeyDown={handleKeyDown}
      >
        <div className="border-border flex items-center gap-3 border-b px-4">
          <span className="text-muted-foreground font-mono text-[11px] tracking-[0.2em] uppercase">
            start
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCursor(0);
            }}
            placeholder="タスク名を入力"
            aria-label="タスク名を入力して絞り込む、または新規作成する"
            className="placeholder:text-muted-foreground/70 h-14 flex-1 bg-transparent text-[15px] outline-none"
          />
          <kbd className="border-border text-muted-foreground rounded-xs border px-1.5 py-0.5 font-mono text-[10px]">
            esc
          </kbd>
        </div>

        <ul ref={listRef} className="max-h-[46vh] overflow-y-auto py-1" role="listbox">
          {matched.map((task, index) => {
            const active = index === cursor;
            return (
              <li key={task.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  data-active={active}
                  disabled={pending}
                  onMouseMove={() => setCursor(index)}
                  onClick={submit}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                    active ? "bg-accent" : ""
                  }`}
                >
                  <span
                    aria-hidden
                    className="h-5 w-[3px] shrink-0 rounded-full"
                    style={{ backgroundColor: task.categoryColor }}
                  />
                  <span className="min-w-0 flex-1 truncate text-[14px]">{task.title}</span>
                  {task.id === runningTaskId && (
                    <span className="text-live font-mono text-[10px] tracking-widest uppercase">
                      計測中
                    </span>
                  )}
                  <span className="text-muted-foreground shrink-0 font-mono text-[11px]">
                    {task.estimateMin === null ? "—" : `${task.estimateMin}分`}
                  </span>
                  <span className="text-muted-foreground shrink-0 text-[11px]">
                    {task.categoryName}
                  </span>
                </button>
              </li>
            );
          })}

          {canCreate && (
            <li>
              <button
                type="button"
                role="option"
                aria-selected={onCreateRow}
                data-active={onCreateRow}
                disabled={pending}
                onMouseMove={() => setCursor(createIndex)}
                onClick={submit}
                className={`flex w-full items-center gap-3 px-4 py-2.5 text-left ${
                  onCreateRow ? "bg-accent" : ""
                }`}
              >
                <span className="text-primary shrink-0 font-mono text-[11px] tracking-widest uppercase">
                  new
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px]">
                  「{trimmed}」を作成して開始
                </span>
              </button>
            </li>
          )}

          {rowCount === 0 && (
            <li className="text-muted-foreground px-4 py-6 text-center text-[13px]">
              タスク名を入力すると、ここから新規作成できます。
            </li>
          )}
        </ul>

        {onCreateRow && (
          <div className="border-border bg-card flex items-center gap-2 border-t px-4 py-3">
            <label className="text-muted-foreground text-[11px]" htmlFor="palette-category">
              カテゴリ
            </label>
            <select
              id="palette-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="border-border bg-background h-8 rounded-xs border px-2 text-[13px]"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <label className="text-muted-foreground ml-2 text-[11px]" htmlFor="palette-estimate">
              見積もり
            </label>
            <input
              id="palette-estimate"
              type="number"
              min={1}
              value={estimate}
              onChange={(event) => setEstimate(event.target.value)}
              placeholder="任意"
              className="border-border bg-background h-8 w-24 rounded-xs border px-2 font-mono text-[13px]"
            />
            <span className="text-muted-foreground text-[11px]">分</span>
          </div>
        )}

        <div className="border-border text-muted-foreground flex items-center justify-between border-t px-4 py-2 font-mono text-[10px]">
          <span>↑↓ 選択 · Enter 開始</span>
          {error ? <span className="text-live">{error}</span> : <span>{rowCount} 件</span>}
        </div>
      </div>
    </div>
  );
}
