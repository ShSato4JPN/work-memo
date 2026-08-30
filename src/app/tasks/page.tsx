import Link from "next/link";

import { AddTaskForm } from "@/components/add-task-form";
import { TaskRow } from "@/components/task-row";
import type { TaskStatus } from "@/server/actions/task";
import { getCategories } from "@/server/queries/categories";
import { getTaskList } from "@/server/queries/tasks";

export const dynamic = "force-dynamic";

const FILTERS: { label: string; value: TaskStatus | undefined }[] = [
  { label: "すべて", value: undefined },
  { label: "未着手", value: "todo" },
  { label: "進行中", value: "doing" },
  { label: "完了", value: "done" },
];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = FILTERS.find((item) => item.value === status)?.value;
  const [tasks, categories] = await Promise.all([getTaskList(filter), getCategories()]);

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-4 pb-16">
      <nav aria-label="絞り込み">
        <ul className="flex flex-wrap gap-2">
          {FILTERS.map((item) => {
            const active = filter === item.value;
            return (
              <li key={item.label}>
                <Link
                  href={item.value ? `/tasks?status=${item.value}` : "/tasks"}
                  aria-current={active ? "page" : undefined}
                  className={`block rounded-full px-4 py-2 text-sm transition ${
                    active
                      ? "bg-card font-bold shadow-sm ring-1 ring-black/5 dark:ring-white/5"
                      : "text-muted-foreground hover:bg-card/60 font-medium"
                  }`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <AddTaskForm categories={categories} />

      {tasks.length === 0 ? (
        <p className="bg-card text-muted-foreground rounded-3xl px-6 py-10 text-center text-base shadow-sm ring-1 ring-black/5 dark:ring-white/5">
          該当するタスクがありません。
        </p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} categories={categories} />
          ))}
        </ul>
      )}
    </main>
  );
}
