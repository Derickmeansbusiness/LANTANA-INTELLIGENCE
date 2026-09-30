import { describe, expect, it } from "vitest";
import { greeting, resolveRange, todayDubai, weekDays } from "./dates";

describe("dates (Asia/Dubai)", () => {
  it("rolls over to the next day at 20:00 UTC", () => {
    expect(todayDubai(new Date("2026-09-29T19:59:00Z"))).toBe("2026-09-29");
    expect(todayDubai(new Date("2026-09-29T20:00:00Z"))).toBe("2026-09-30");
  });

  it("greets by Dubai local time", () => {
    expect(greeting(new Date("2026-09-29T03:30:00Z"))).toBe("Good morning"); // 07:30 Dubai
    expect(greeting(new Date("2026-09-29T10:00:00Z"))).toBe("Good afternoon");
    expect(greeting(new Date("2026-09-29T15:00:00Z"))).toBe("Good evening");
  });

  it("builds Monday-start weeks", () => {
    expect(weekDays("2026-09-30")).toEqual([
      "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04",
    ]);
  });

  it("resolves ranges and rejects bad input", () => {
    expect(resolveRange({}, "2026-09-30")).toEqual({ from: "2026-07-02", to: "2026-09-30", key: "90d" });
    expect(resolveRange({ range: "ytd" }, "2026-09-30")).toEqual({ from: "2026-01-01", to: "2026-09-30", key: "ytd" });
    expect(resolveRange({ from: "2026-01-01", to: "2026-02-01" }, "2026-09-30").key).toBe("custom");
    expect(resolveRange({ from: "2026-03-01", to: "2026-02-01" }, "2026-09-30").key).toBe("90d");
    expect(resolveRange({ from: "'; drop", to: "x" }, "2026-09-30").key).toBe("90d");
  });
});
