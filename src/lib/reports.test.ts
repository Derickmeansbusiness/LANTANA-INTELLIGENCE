import { describe, expect, it } from "vitest";
import { PACKS, PACK_KEYS, SECTIONS, periodRange, vaultSafeSections } from "./reports";

describe("report catalog", () => {
  it("has the five built-in packs, each built from known sections", () => {
    expect(PACK_KEYS).toEqual(["weekly_management", "monthly_board", "pipeline", "finance", "people_compliance"]);
    for (const k of PACK_KEYS) for (const s of PACKS[k].sections) expect(SECTIONS).toHaveProperty(s);
  });
  it("never writes cash into a vault copy", () => {
    expect(vaultSafeSections(PACKS.monthly_board.sections)).not.toContain("cash");
    expect(vaultSafeSections(PACKS.monthly_board.sections)).toContain("pnl");
  });
});

describe("periodRange", () => {
  it("counts the last 7 and 30 days inclusively", () => {
    expect(periodRange("last_7", "2026-10-01")).toMatchObject({ from: "2026-09-25", to: "2026-10-01" });
    expect(periodRange("last_30", "2026-10-01")).toMatchObject({ from: "2026-09-02", to: "2026-10-01" });
  });
  it("finds last month across a year end", () => {
    expect(periodRange("last_month", "2026-01-15")).toMatchObject({ from: "2025-12-01", to: "2025-12-31" });
    expect(periodRange("last_month", "2026-03-01")).toMatchObject({ from: "2026-02-01", to: "2026-02-28" });
  });
  it("starts quarters and years on the first day", () => {
    expect(periodRange("quarter_to_date", "2026-11-20")).toMatchObject({ from: "2026-10-01", to: "2026-11-20" });
    expect(periodRange("year_to_date", "2026-11-20")).toMatchObject({ from: "2026-01-01" });
  });
});
