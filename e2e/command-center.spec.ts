import { test, expect } from "@playwright/test";
import { SHOTS, authFile, setTheme } from "./helpers";

test.describe("principal", () => {
  test.use({ storageState: authFile("principal") });

  test("Command Center shows real data in both themes", async ({ page }) => {
    await page.goto("/");
    const kpis = page.getByRole("region", { name: "Key figures" });
    await expect(kpis.getByText("Active pipeline")).toBeVisible();
    await expect(kpis.getByText("Cash on hand")).toBeVisible();
    await expect(kpis.getByText("Principals only")).toHaveCount(0);
    await expect(page.getByText("Morning briefing")).toBeVisible();
    await expect(page.getByText("Counterparty signing authority not confirmed").first()).toBeVisible();
    await expect(page.getByText("Last day to give notice").first()).toBeVisible();
    await expect(page.getByRole("img", { name: /Map of Africa/ })).toBeVisible();
    await expect(page.getByText("Pipeline by stage")).toBeVisible();
    await expect(page.getByText("This week")).toBeVisible();
    await page.waitForTimeout(900); // let count-ups settle for the screenshot
    await page.screenshot({ path: `${SHOTS}/command-center-desktop-dark.png`, fullPage: true });
    await setTheme(page, "light");
    await expect(page.locator("html")).toHaveClass(/light/);
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${SHOTS}/command-center-desktop-light.png`, fullPage: true });
    await setTheme(page, "dark");
  });

  test("attention item opens the record sheet", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /NCNDA — PJM Advisory/ }).first().click();
    const sheet = page.getByRole("dialog");
    await expect(sheet.getByText("Laws of Tanzania")).toBeVisible();
    await expect(sheet.getByText("Non-circumvention and confidentiality · 24 months after termination")).toBeVisible();
    await expect(page).toHaveURL(/record=contract:/);
    await page.keyboard.press("Escape");
    await expect(page).not.toHaveURL(/record=/);
  });

  test("Ctrl+K searches records and opens one", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder(/Search deals/).fill("morogoro");
    // The best match is highlighted once results arrive, so Enter opens it.
    await expect(page.getByRole("option", { name: /^Morogoro agro-processing hub/ })).toHaveAttribute("aria-selected", "true");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("dialog").getByText("Due diligence").first()).toBeVisible();
    await expect(page.getByRole("dialog").getByText("PJM Advisory").first()).toBeVisible();
  });

  test("Ctrl+K navigates to modules", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder(/Search deals/).fill("contracts");
    await page.getByRole("option", { name: "Contracts", exact: true }).click();
    await expect(page).toHaveURL(/\/contracts$/);
    await expect(page.getByRole("heading", { name: "Arrives in Phase 3" }).filter({ visible: true })).toBeVisible();
  });

  test("date range changes the KPI period", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Date range/ }).click();
    await page.getByRole("button", { name: "Last 12 months" }).click();
    await expect(page).toHaveURL(/range=365d/);
  });

  test("settings shows audit log and demo data", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByText("Audit log")).toBeVisible();
    await expect(page.getByRole("button", { name: "Wipe demo data" })).toBeEnabled();
    await expect(page.getByRole("cell", { name: "Maimouna Baba Danpullo" }).first()).toBeVisible();
  });

  test("every module page renders", async ({ page }) => {
    for (const path of ["/documents", "/contracts", "/people", "/finance", "/compliance", "/reports", "/agent"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: /Arrives in Phase \d/ }).filter({ visible: true })).toBeVisible();
    }
  });
});

test.describe("manager", () => {
  test.use({ storageState: authFile("manager") });

  test("sees burn but not cash, no audit log", async ({ page }) => {
    await page.goto("/");
    const kpis = page.getByRole("region", { name: "Key figures" });
    await expect(kpis.getByText("Principals only")).toBeVisible();
    await expect(kpis.getByText("Management only")).toHaveCount(0);
    await page.goto("/settings");
    await expect(page.getByText("Audit log")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Wipe demo data" })).toBeDisabled();
  });
});

test.describe("staff", () => {
  test.use({ storageState: authFile("staff") });

  test("sees only their deal and nothing sensitive", async ({ page }) => {
    await page.goto("/");
    const kpis = page.getByRole("region", { name: "Key figures" });
    await expect(kpis.getByText("Principals only")).toBeVisible();
    await expect(kpis.getByText("Management only")).toBeVisible();
    await expect(page.getByText("Counterparty signing authority not confirmed")).toHaveCount(0);
    await expect(page.getByText("Invoice INV-DEMO-002")).toHaveCount(0);
    const nav = page.getByRole("navigation", { name: "Modules" });
    await expect(nav.getByRole("link", { name: "Finance" })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Contracts" })).toHaveCount(0);
    await expect(page.getByText("Morogoro").first()).toBeVisible();
    await expect(page.getByText("Mauritania fertilizer supply")).toHaveCount(0);
    await page.screenshot({ path: `${SHOTS}/command-center-staff.png`, fullPage: true });
  });

  test("direct URL to a management module is refused", async ({ page }) => {
    await page.goto("/finance");
    await expect(page.getByText("Your role doesn't have access to this module")).toBeVisible();
  });

  test("record sheet refuses a contract the staff user can't see", async ({ page }) => {
    await page.goto("/?record=contract:e0000000-0000-4000-8000-000000000001");
    await expect(page.getByRole("dialog").getByText("Not available")).toBeVisible();
  });

  test("search doesn't leak hidden records", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Control+k");
    const input = page.getByPlaceholder(/Search deals/);
    await input.fill("morogoro");
    await expect(page.getByRole("option", { name: /^Morogoro agro-processing hub/ })).toBeVisible();
    await input.fill("mauritania");
    await expect(page.getByRole("option", { name: /^Morogoro/ })).toHaveCount(0);
    await expect(page.getByRole("option", { name: /Ask: .mauritania/ })).toBeVisible();
    await expect(page.getByRole("option", { name: /Mauritania fertilizer/ })).toHaveCount(0);
    await expect(page.getByRole("option", { name: /Ministry of Agriculture/ })).toHaveCount(0);
  });
});
