import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogOutIcon } from "lucide-react";
import { getSession } from "@/server/session";
import { signOut } from "@/app/login/actions";
import { BrandMark, Wordmark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = { title: { default: "Data rooms", template: "%s · Lantana Vision" } };

/**
 * The guest portal: a separate shell with no navigation into the internal
 * app. Colleagues are sent back to the app (they run rooms from /data-rooms).
 */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (s.role !== "external") redirect(s.isManagerPlus ? "/data-rooms" : "/");
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b bg-surface">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <Link href="/portal" className="flex items-center gap-3" aria-label="Lantana Vision data rooms">
            <BrandMark className="size-8" />
            <Wordmark />
          </Link>
          <div className="flex min-w-0 items-center gap-2">
            <span className="hidden truncate text-sm text-muted-foreground sm:block">{s.email}</span>
            <form action={signOut}>
              <Button type="submit" variant="ghost" size="sm">
                <LogOutIcon /> Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        {children}
      </main>
      <footer className="mx-auto w-full max-w-4xl px-4 py-6 text-xs text-muted-foreground">
        Lantana Vision FZ-LLC · RAKEZ, United Arab Emirates. Files here are confidential, watermarked with your email, and every view is recorded.
      </footer>
    </div>
  );
}
