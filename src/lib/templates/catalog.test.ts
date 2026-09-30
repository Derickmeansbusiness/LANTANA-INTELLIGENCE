import { describe, expect, it } from "vitest";
import { TEMPLATES, checkValues, templateById } from "./catalog";
import type { BuildContext } from "./types";

const ctx: BuildContext = {
  company: { legal_name: "Lantana Vision FZ-LLC", licence_no: "FDCW2089", licensing_authority: "RAKEZ", address_lines: ["Ras Al Khaimah"], website: null },
  today: "2026-09-30",
  signatory: { name: "Maimouna Baba Danpullo", title: "Managing Director" },
  invoice: { invoice_no: "INV-1", kind: "success_fee", issue_date: "2026-09-01", due_date: "2026-09-30", currency: "USD", total: "USD 1.00", status: "sent", bill_to: "X", bill_to_country: null, deal: "Morogoro" },
};

const sample = (id: string) =>
  Object.fromEntries(templateById(id)!.fields.map((f) => [f.name, f.default?.replace("{today}", "2026-09-30").replace(/\{signatory\.\w+\}/, "Maimouna") || (f.type === "number" ? "5" : f.type === "date" ? "2026-09-30" : "Sample text")]));

describe("template catalog", () => {
  it("has the eight documents the brief lists", () => {
    expect(TEMPLATES.map((t) => t.id)).toEqual(["ncnda", "mandate", "salary_certificate", "loi", "engagement_letter", "invoice", "board_resolution", "proposal"]);
  });

  it("keeps the salary certificate locked until payroll exists", () => {
    expect(templateById("salary_certificate")!.unavailable).toMatch(/payroll/i);
  });

  it.each(TEMPLATES.filter((t) => !t.unavailable).map((t) => t.id))("%s builds with a title, blocks and no empty text", (id) => {
    const t = templateById(id)!;
    const { values, errors } = checkValues(t, sample(id));
    expect(errors).toEqual({});
    const out = t.build(values, ctx);
    expect(out.title.length).toBeGreaterThan(3);
    expect(out.blocks.length).toBeGreaterThan(2);
    const text = JSON.stringify(out.blocks);
    expect(text).not.toMatch(/undefined|null|DIFC-LCIA|lorem/i);
  });

  it("defaults disputes to DIAC, not the abolished DIFC-LCIA centre", () => {
    const out = templateById("mandate")!.build(checkValues(templateById("mandate")!, sample("mandate")).values, ctx);
    expect(JSON.stringify(out.blocks)).toContain("Dubai International Arbitration Centre");
  });

  it("rejects missing required fields and bad dates", () => {
    const { errors } = checkValues(templateById("ncnda")!, { date: "30/09/2026" });
    expect(errors.cp_name).toBe("Required");
    expect(errors.date).toBe("Use a valid date");
  });
});
