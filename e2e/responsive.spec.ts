import { test, expect } from "@playwright/test";
import { GUEST, SHOTS, authFile, noHorizontalScroll, setTheme } from "./helpers";

test.use({ storageState: authFile("principal") });

test("Command Center at 375px, both themes, no horizontal scroll", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Morning briefing")).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/command-center-mobile-dark.png`, fullPage: true });
  await setTheme(page, "light");
  expect(await noHorizontalScroll(page)).toBe(true);
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${SHOTS}/command-center-mobile-light.png`, fullPage: true });
  await setTheme(page, "dark");
});

test("mobile navigation drawer opens and closes on navigation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("dialog").getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await noHorizontalScroll(page)).toBe(true);
});

test("every page fits 375px", async ({ page }) => {
  for (const path of [
    "/settings",
    "/contracts",
    "/finance",
    "/finance/ledger",
    "/people",
    "/compliance",
    "/deals",
    "/deals?view=table",
    "/deals?view=forecast",
    "/deals/d0000000-0000-4000-8000-000000000005",
    "/deals/ledger",
    "/partners",
    "/partners?tab=contacts",
    "/partners/a0000000-0000-4000-8000-000000000002",
    "/tasks",
    "/tasks?view=list",
    "/tasks?view=board",
    "/tasks?view=calendar",
    "/tasks?view=timeline",
    "/tasks?view=projects",
    "/tasks/projects/b1000000-0000-4000-8000-000000000001",
    "/documents",
    "/documents/f0000000-0000-4000-8000-000000000001",
    "/documents/templates",
    "/documents/templates/mandate",
    "/contracts/e0000000-0000-4000-8000-000000000002",
    "/s/unavailable?r=expired",
    "/agent",
  ]) {
    await page.goto(path);
    expect(await noHorizontalScroll(page), path).toBe(true);
  }
});

test("phase 2 pages at 375px in both themes", async ({ page }) => {
  for (const [path, name] of [
    ["/deals", "deals-board"],
    ["/deals/d0000000-0000-4000-8000-000000000005", "deal-page"],
    ["/partners/a0000000-0000-4000-8000-000000000002", "partner-page"],
    ["/tasks", "tasks-my-day"],
  ] as const) {
    await page.goto(path);
    await page.screenshot({ path: `${SHOTS}/mobile-${name}-dark.png`, fullPage: true });
  }
  await setTheme(page, "light");
  await page.goto("/deals/d0000000-0000-4000-8000-000000000005");
  expect(await noHorizontalScroll(page)).toBe(true);
  await page.screenshot({ path: `${SHOTS}/mobile-deal-page-light.png`, fullPage: true });
  await setTheme(page, "dark");
});

test("phase 3 pages at 375px in both themes", async ({ page }) => {
  const pages = [
    ["/documents", "documents"],
    ["/documents/f0000000-0000-4000-8000-000000000001", "document-page"],
    ["/documents/templates/ncnda", "template-form"],
    ["/contracts", "contracts"],
    ["/contracts/e0000000-0000-4000-8000-000000000002", "contract-page"],
  ] as const;
  await page.goto("/documents");
  for (const theme of ["dark", "light"] as const) {
    await setTheme(page, theme);
    for (const [path, name] of pages) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      expect(await noHorizontalScroll(page), `${path} ${theme}`).toBe(true);
      await page.screenshot({ path: `${SHOTS}/mobile-${name}-${theme}.png`, fullPage: true });
    }
  }
  await setTheme(page, "dark");
});

test("phase 5 pages at 375px in both themes", async ({ page }) => {
  const pages = [
    ["/finance", "finance"],
    ["/finance/ledger", "finance-ledger"],
    ["/finance/invoices", "finance-invoices"],
    ["/finance/bills", "finance-bills"],
    ["/finance/budgets", "finance-budgets"],
    ["/finance/fx", "finance-fx"],
    ["/people", "people"],
    ["/people/c5000000-0000-4000-8000-000000000004", "people-employee"],
    ["/people/leave", "people-leave"],
    ["/people/payroll", "people-payroll"],
    ["/compliance", "compliance"],
    ["/compliance/records", "compliance-records"],
    ["/compliance/governance", "compliance-governance"],
  ] as const;
  await page.goto("/finance");
  for (const theme of ["dark", "light"] as const) {
    await setTheme(page, theme);
    for (const [path, name] of pages) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      expect(await noHorizontalScroll(page), `${path} ${theme}`).toBe(true);
      await page.screenshot({ path: `${SHOTS}/mobile-${name}-${theme}.png`, fullPage: true });
    }
  }
  await setTheme(page, "dark");
});

test("Ask Lantana at 375px in both themes", async ({ page }) => {
  await page.goto("/agent");
  for (const theme of ["dark", "light"] as const) {
    await setTheme(page, theme);
    await page.getByLabel("Message Ask Lantana").fill("Find Morogoro");
    await page.getByLabel("Message Ask Lantana").press("Enter");
    await expect(page.getByRole("link", { name: "Morogoro agro-processing hub" }).first()).toBeVisible();
    expect(await noHorizontalScroll(page), `/agent ${theme}`).toBe(true);
    await page.screenshot({ path: `${SHOTS}/mobile-agent-${theme}.png`, fullPage: true });
  }
  await page.goto("/");
  await page.getByRole("button", { name: "Ask Lantana (Ctrl+J)" }).click();
  const panel = page.getByRole("dialog", { name: "Ask Lantana" });
  await panel.getByLabel("Message Ask Lantana").fill("Remind me to call PJM about the fee");
  await panel.getByLabel("Message Ask Lantana").press("Enter");
  await expect(panel.getByTestId("proposal-card")).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  await page.screenshot({ path: `${SHOTS}/mobile-agent-panel-light.png` });
  await setTheme(page, "dark");
});

test("login page fits 375px", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 375, height: 812 } });
  const page = await ctx.newPage();
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  expect(await noHorizontalScroll(page)).toBe(true);
  await page.screenshot({ path: `${SHOTS}/login-mobile.png` });
  await ctx.close();
});

test("phase 6 pages at 375px in both themes", async ({ page }) => {
  const pages = [
    ["/reports", "reports"],
    ["/reports/view?pack=monthly_board", "report-board"],
    ["/data-rooms", "data-rooms"],
    ["/data-rooms/c6000000-0000-4000-8000-000000000001", "data-room"],
  ] as const;
  await page.goto("/reports");
  for (const theme of ["dark", "light"] as const) {
    await setTheme(page, theme);
    for (const [path, name] of pages) {
      await page.goto(path);
      await expect(page.locator("h1").first()).toBeVisible();
      expect(await noHorizontalScroll(page), `${path} ${theme}`).toBe(true);
      await page.screenshot({ path: `${SHOTS}/mobile-${name}-${theme}.png`, fullPage: true });
    }
  }
  await setTheme(page, "dark");
});

test.describe("guest portal at 375px", () => {
  test.use({ storageState: GUEST.auth });
  test("portal pages fit in both themes", async ({ page }) => {
    await page.goto("/portal");
    for (const theme of ["dark", "light"] as const) {
      await setTheme(page, theme);
      for (const [path, name] of [
        ["/portal", "portal"],
        ["/portal/c6000000-0000-4000-8000-000000000001", "portal-room"],
      ] as const) {
        await page.goto(path);
        await expect(page.locator("h1").first()).toBeVisible();
        expect(await noHorizontalScroll(page), `${path} ${theme}`).toBe(true);
        await page.screenshot({ path: `${SHOTS}/mobile-${name}-${theme}.png`, fullPage: true });
      }
    }
  });
});
