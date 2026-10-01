"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Route-based tabs for a module's sub-pages. Scrolls sideways on narrow screens. */
export function SectionTabs({ items, label }: { items: { href: string; label: string; exact?: boolean }[]; label: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label={label} className="-mx-4 mb-6 overflow-x-auto border-b px-4 sm:mx-0 sm:px-0">
      <ul className="flex min-w-max gap-1">
        {items.map((it) => {
          const active = it.exact ? pathname === it.href : pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-10 items-center border-b-2 px-3 text-sm transition-colors",
                  active ? "border-gold font-medium text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
