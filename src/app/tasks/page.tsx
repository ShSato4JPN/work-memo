import Link from "next/link";
import { TaskRow } from "@/components/task-row";
import { getTaskList } from "@/server/queries/tasks";
import type { TaskStatus } from "@/server/actions/task";

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
  const tasks = await getTaskList(filter);

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">タスク</h1>

      <nav className="flex gap-2 text-sm">
        {FILTERS.map((item) => (
          <Link
            key={item.label}
            href={item.value ? `/tasks?status=${item.value}` : "/tasks"}
            className={`rounded-md border px-3 py-1 ${filter === item.value ? "bg-accent" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <table className="w-full">
        <thead>
          <tr className="text-muted-foreground border-b text-left text-sm">
            <th className="py-2">タスク</th>
            <th className="py-2">カテゴリ</th>
            <th className="py-2 text-right">見積もり</th>
            <th className="py-2 text-right">実績</th>
            <th className="py-2 text-right">差分</th>
            <th className="py-2 text-right">最終作業</th>
            <th className="py-2" />
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} />
          ))}
        </tbody>
      </table>

      {tasks.length === 0 && (
        <p className="text-muted-foreground text-sm">該当するタスクがありません。</p>
      )}
    </main>
  );
}
