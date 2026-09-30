import { describe, expect, it } from "vitest";
import { formatCompact, formatMoney, minorUnit, toMajor, toMinor } from "./money";

describe("money", () => {
  it("respects each currency's ISO exponent", () => {
    expect(minorUnit("AED")).toBe(2);
    expect(minorUnit("XAF")).toBe(0);
    expect(toMajor(4_200_000_000, "XAF")).toBe(4_200_000_000);
    expect(toMajor(1_850_000_000, "USD")).toBe(18_500_000);
    expect(toMinor(56.93, "AED")).toBe(5693);
    expect(toMinor(1500, "XAF")).toBe(1500);
  });

  it("throws on unknown currencies instead of guessing", () => {
    expect(() => minorUnit("XYZ")).toThrow(/Unknown currency/);
  });

  it("formats full and compact amounts", () => {
    expect(formatMoney(18_500_000, "USD")).toBe("USD 18,500,000.00");
    expect(formatMoney(4_200_000_000, "XAF")).toBe("XAF 4,200,000,000");
    expect(formatCompact(73_302_531, "USD")).toBe("$73.3M");
    expect(formatCompact(56_925, "AED")).toBe("AED 56.9K");
    expect(formatCompact(150_000_000, "USD")).toBe("$150M");
    expect(formatCompact(-3_100, "AED")).toBe("−AED 3.1K");
    expect(formatCompact(null, "USD")).toBe("—");
  });
});
