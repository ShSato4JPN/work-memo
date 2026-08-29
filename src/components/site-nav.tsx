"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "今日" },
  { href: "/tasks", label: "タスク" },
  { href: "/analytics", label: "分析" },
] as const;

export function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="px-4 pt-2 pb-1" aria-label="画面">
      <ul className="mx-auto flex max-w-4xl gap-2">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`block rounded-full px-5 py-2.5 text-base transition ${
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
  );
}
