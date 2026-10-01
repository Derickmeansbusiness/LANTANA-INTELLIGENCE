import AxeBuilder from "@axe-core/playwright";
import { test, expect, type Page } from "@playwright/test";
import { GUEST, authFile, setTheme } from "./helpers";

// WCAG 2.1 AA, automated part: axe on every main screen, dark and light.
// (Automated checks find roughly a third of issues; keyboard and screen-reader
// passes are still manual.)
const PAGES = [
  "/",
  "/deals",
  "/deals?view=table",
  "/deals/d0000000-0000-4000-8000-000000000005",
  "/deals/ledger",
  "/partners",
  "/partners/a0000000-0000-4000-8000-000000000002",
  "/tasks",
  "/tasks?view=board",
  "/documents",
  "/documents/f0000000-0000-4000-8000-000000000001",
  "/documents/templates/mandate",
  "/contracts",
  "/contracts/e0000000-0000-4000-8000-000000000002",
  "/people",
  "/people/c5000000-0000-4000-8000-000000000004",
  "/finance",
  "/finance/ledger",
  "/finance/invoices",
  "/compliance",
  "/data-rooms",
  "/data-rooms/c6000000-0000-4000-8000-000000000001",
  "/reports",
  "/reports/view?pack=monthly_board",
  "/agent",
  "/settings",
];

async function audit(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return violations.map((v) => `${path} · ${v.id} (${v.impact}): ${v.help}\n    ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join("\n    ")}`);
}

for (const theme of ["dark", "light"] as const) {
  test.describe(`axe · ${theme}`, () => {
    test.use({ storageState: authFile("principal") });
    test(`internal app has no WCAG A/AA violations (${theme})`, async ({ page }) => {
      test.setTimeout(600_000);
      await page.goto("/login");
      await page.goto("/");
      await setTheme(page, theme);
      const found: string[] = [];
      for (const p of PAGES) found.push(...(await audit(page, p)));
      expect(found, found.join("\n")).toEqual([]);
    });
  });

  test.describe(`axe · portal · ${theme}`, () => {
    test.use({ storageState: GUEST.auth });
    test(`guest portal and login have no WCAG A/AA violations (${theme})`, async ({ page }) => {
      await page.goto("/portal");
      await setTheme(page, theme);
      const found = [...(await audit(page, "/portal")), ...(await audit(page, "/portal/c6000000-0000-4000-8000-000000000001"))];
      expect(found, found.join("\n")).toEqual([]);
    });
  });
}

test.describe("axe · login", () => {
  test.use({ storageState: { cookies: [], origins: [] } });
  test("sign-in page has no WCAG A/AA violations", async ({ page }) => {
    const found = [...(await audit(page, "/login")), ...(await audit(page, "/s/unavailable?r=expired"))];
    expect(found, found.join("\n")).toEqual([]);
  });
});
