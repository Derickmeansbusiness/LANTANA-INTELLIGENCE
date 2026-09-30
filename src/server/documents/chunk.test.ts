import { describe, expect, it } from "vitest";
import { chunkText } from "./chunk";

describe("chunkText", () => {
  it("returns nothing for blank text", () => {
    expect(chunkText("  \n\n ")).toEqual([]);
  });
  it("keeps short documents as one chunk", () => {
    expect(chunkText("Clause 1. Confidentiality.\n\nClause 2. Term.")).toHaveLength(1);
  });
  it("splits long text into bounded, overlapping chunks", () => {
    const para = (n: number) => `Clause ${n}. ` + "The parties agree not to circumvent each other. ".repeat(8);
    const text = Array.from({ length: 30 }, (_, i) => para(i + 1)).join("\n\n");
    const chunks = chunkText(text, 1200, 200);
    expect(chunks.length).toBeGreaterThan(5);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(1200);
    expect(chunks.join(" ")).toContain("Clause 30.");
  });
  it("hard-splits a single enormous sentence", () => {
    const chunks = chunkText("x".repeat(5000), 1000, 100);
    expect(chunks.every((c) => c.length <= 1000)).toBe(true);
    expect(chunks.length).toBeGreaterThanOrEqual(5);
  });
});
