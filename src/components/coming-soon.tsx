import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

/** Empty state for modules scheduled in later phases. Says what's coming and where to go meanwhile. */
export function ComingSoon({
  title,
  description,
  phase,
  icon: Icon,
  bullets,
  meanwhile,
}: {
  title: string;
  description: string;
  phase: number;
  icon: LucideIcon;
  bullets: string[];
  meanwhile?: { label: string; href: string };
}) {
  return (
    <>
      <PageHeader title={title} description={description} />
      <div className="rounded-lg border border-dashed p-6 sm:p-10">
        <div className="mx-auto max-w-lg text-center">
          <div className="mx-auto flex size-11 items-center justify-center rounded-full border bg-surface">
            <Icon className="size-5 text-gold" />
          </div>
          <h2 className="mt-4 font-display text-xl">Arrives in Phase {phase}</h2>
          <ul className="mt-4 space-y-1.5 text-left text-sm text-muted-foreground">
            {bullets.map((b) => (
              <li key={b} className="flex gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-gold-soft" />
                {b}
              </li>
            ))}
          </ul>
          {meanwhile && (
            <Button asChild variant="outline" className="mt-6">
              <Link href={meanwhile.href}>{meanwhile.label}</Link>
            </Button>
          )}
        </div>
      </div>
    </>
  );
}
