import { cn } from "@/lib/utils";

/**
 * Placeholder mark until the real logo SVG is supplied: a gold ring crossed
 * by a bridge arc, echoing the Lantana Vision logo.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("size-7", className)}>
      <circle cx="16" cy="16" r="14" fill="none" stroke="var(--brand-gold)" strokeWidth="1.75" />
      <path d="M6 20 Q16 6 26 20" fill="none" stroke="var(--brand-gold)" strokeWidth="1.75" strokeLinecap="round" />
      <path d="M11 20 v-3.2 M16 20 v-6 M21 20 v-3.2" stroke="var(--brand-gold-soft)" strokeWidth="1.25" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("flex flex-col leading-none", className)}>
      <span className="font-display text-[15px] tracking-[0.08em]">LANTANA VISION</span>
      <span className="mt-1 text-[10px] tracking-[0.2em] text-muted-foreground uppercase">Command</span>
    </span>
  );
}
