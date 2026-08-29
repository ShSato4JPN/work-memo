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
    <nav className="border-border border-b" aria-label="画面">
      <ul className="mx-auto flex max-w-5xl gap-1 px-5">
        {ITEMS.map((item) => {
          const active = pathname === item.href;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`-mb-px block border-b-2 px-3 py-2.5 text-[13px] transition-colors ${
                  active
                    ? "border-foreground text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground border-transparent"
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
