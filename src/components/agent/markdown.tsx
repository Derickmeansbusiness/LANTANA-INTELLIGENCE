"use client";

import Link from "next/link";
import { Fragment } from "react";

/**
 * A deliberately small Markdown renderer for agent replies: paragraphs,
 * headings, bullet and numbered lists, simple tables, **bold**, *italic*,
 * `code` and links. No raw HTML is ever rendered. Links only work when they
 * point inside the app (the agent is told to link records by their href);
 * anything else shows as plain text.
 */
export function Markdown({ text }: { text: string }) {
  const blocks = text.replace(/\r/g, "").split(/\n{2,}/);
  return (
    <div className="space-y-2.5 text-sm leading-relaxed">
      {blocks.map((b, i) => (
        <Block key={i} text={b} />
      ))}
    </div>
  );
}

function Block({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim() !== "");
  if (!lines.length) return null;
  const h = lines[0].match(/^(#{1,4})\s+(.*)$/);
  if (h && lines.length === 1) return <p className="font-medium">{inline(h[2])}</p>;

  if (lines.every((l) => /^\s*[-*•]\s+/.test(l))) {
    return (
      <ul className="list-disc space-y-1 pl-5">
        {lines.map((l, i) => (
          <li key={i}>{inline(l.replace(/^\s*[-*•]\s+/, ""))}</li>
        ))}
      </ul>
    );
  }
  if (lines.every((l) => /^\s*\d+[.)]\s+/.test(l))) {
    return (
      <ol className="list-decimal space-y-1 pl-5">
        {lines.map((l, i) => (
          <li key={i}>{inline(l.replace(/^\s*\d+[.)]\s+/, ""))}</li>
        ))}
      </ol>
    );
  }
  if (lines.length >= 2 && lines.every((l) => l.trim().startsWith("|")) && /^\s*\|?\s*:?-{2,}/.test(lines[1])) {
    const cells = (l: string) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
    const head = cells(lines[0]);
    const rows = lines.slice(2).map(cells);
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              {head.map((c, i) => (
                <th key={i} className="px-2 py-1 text-left font-medium text-muted-foreground">
                  {inline(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b last:border-0">
                {r.map((c, j) => (
                  <td key={j} className="px-2 py-1 align-top">
                    {inline(c)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return (
    <p>
      {lines.map((l, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {inline(l.replace(/^#{1,4}\s+/, ""))}
        </Fragment>
      ))}
    </p>
  );
}

const TOKEN = /(\[[^\]]+\]\([^)\s]+\)|\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;

function inline(s: string) {
  return s.split(TOKEN).map((part, i) => {
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      const href = link[2];
      const internal = href.startsWith("/") && !href.startsWith("//") ? href : href.startsWith("?") ? href : null;
      return internal ? (
        <Link key={i} href={internal} scroll={false} className="font-medium text-gold-ink underline decoration-gold/40 underline-offset-2 hover:decoration-gold">
          {link[1]}
        </Link>
      ) : (
        <span key={i}>{link[1]}</span>
      );
    }
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2)
      return (
        <code key={i} className="rounded bg-surface-2 px-1 py-0.5 text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    if (part.startsWith("*") && part.endsWith("*") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}
