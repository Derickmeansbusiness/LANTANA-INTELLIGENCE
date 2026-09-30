import type { Metadata } from "next";
import { BrandMark, Wordmark } from "@/components/brand-mark";

export const metadata: Metadata = { title: "Link unavailable" };

const MESSAGES: Record<string, string> = {
  expired: "This link has expired.",
  revoked: "This link was withdrawn by the sender.",
  limit: "This link has been opened the maximum number of times.",
  error: "We couldn't prepare this document. Try again in a minute.",
  unknown: "This link isn't valid. Check you copied all of it.",
};

export default async function ShareUnavailable({ searchParams }: PageProps<"/s/unavailable">) {
  const sp = await searchParams;
  const reason = typeof sp.r === "string" && sp.r in MESSAGES ? sp.r : "unknown";
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-3">
          <BrandMark className="size-9" />
          <Wordmark />
        </div>
        <div className="rounded-lg border bg-surface p-6">
          <h1 className="font-display text-2xl">Document unavailable</h1>
          <p className="mt-2 text-sm text-muted-foreground" data-reason={reason}>
            {MESSAGES[reason]}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">If you still need it, ask your contact at Lantana Vision to send a new link.</p>
        </div>
      </div>
    </main>
  );
}
