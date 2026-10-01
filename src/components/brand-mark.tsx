import { cn } from "@/lib/utils";
import { MARK_AFRICA, MARK_ARC, MARK_VIEWBOX } from "@/lib/brand-paths";

/**
 * The Lantana Vision mark: Africa crossed by a gold bridge arc. The silhouette
 * takes the current text colour, so it is charcoal on light and ivory on dark.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox={MARK_VIEWBOX} aria-hidden className={cn("size-7 text-foreground", className)}>
      <path d={MARK_AFRICA} fill="currentColor" fillRule="evenodd" />
      <path d={MARK_ARC} fill="var(--brand-gold)" fillRule="evenodd" />
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
