import { AddCategoryForm } from "@/components/add-category-form";
import { getCategoryList } from "@/server/queries/categories";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await getCategoryList();

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-4 pb-16">
      <AddCategoryForm />

      <ul className="space-y-2">
        {categories.map((category) => (
          <li
            key={category.id}
            className="bg-card flex items-center gap-4 rounded-3xl px-5 py-4 shadow-sm ring-1 ring-black/5 dark:ring-white/5"
          >
            <span
              aria-hidden
              className="size-5 shrink-0 rounded-full"
              style={{ backgroundColor: category.color }}
            />
            <span className="min-w-0 flex-1 truncate text-base font-bold">{category.name}</span>
            <span className="text-muted-foreground shrink-0 text-sm tabular-nums">
              {category.taskCount === 0 ? "未使用" : `${category.taskCount}件のタスク`}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
