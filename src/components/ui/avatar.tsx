import { cn } from "@/lib/utils";

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-full border bg-surface-2 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      {initials(name) || "?"}
    </span>
  );
}

export { Avatar };
