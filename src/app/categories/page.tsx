import { AddCategoryForm } from "@/components/add-category-form";
import { CategoryRow } from "@/components/category-row";
import { getCategoryList } from "@/server/queries/categories";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await getCategoryList();

  return (
    <main className="mx-auto max-w-4xl space-y-5 px-4 py-4 pb-16">
      <AddCategoryForm />

      <ul className="space-y-2">
        {categories.map((category) => (
          <CategoryRow key={category.id} category={category} />
        ))}
      </ul>
    </main>
  );
}
