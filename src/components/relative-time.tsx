import { relativeTime } from "@/lib/dates";

/**
 * "3 min ago" rendered on the server and again on hydration can differ when a
 * minute ticks over in between; React would then rebuild the whole tree. The
 * text is allowed to differ here, and only here.
 */
export function RelativeTime({ ts }: { ts: string }) {
  return (
    <time dateTime={ts} suppressHydrationWarning>
      {relativeTime(ts)}
    </time>
  );
}
