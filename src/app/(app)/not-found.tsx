import Link from "next/link";
import { SearchXIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Shown for records that don't exist AND for records RLS hides from you.
 * Deliberately doesn't say which, so it can't be used to probe for data.
 */
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center">
      <div className="flex size-11 items-center justify-center rounded-full border bg-surface">
        <SearchXIcon className="size-5 text-muted-foreground" />
      </div>
      <h1 className="mt-4 font-display text-2xl">Not found</h1>
      <p className="mt-2 text-sm text-muted-foreground">This record doesn&apos;t exist, was archived, or isn&apos;t shared with you.</p>
      <Button asChild variant="outline" className="mt-6">
        <Link href="/">Back to the Command Center</Link>
      </Button>
    </div>
  );
}
