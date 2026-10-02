import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { SHOTS, authFile } from "./helpers";

// Phase 5: finance, people & payroll, compliance. Writes data; names carry the run id.
const run = process.env.E2E_RUN!;
const STATEMENT = `test-results/fixtures/statement-${run}.csv`;
const STAFF = "/people/c5000000-0000-4000-8000-000000000004";
const MANAGER_EMP = "/people/c5000000-0000-4000-8000-000000000003";

test.beforeAll(() => {
  mkdirSync("test-results/fixtures", { recursive: true });
  // Day-first dates and debit/credit columns, the way UAE banks export them.
  writeFileSync(
    STATEMENT,
    [
      "Value Date,Narrative,Debit,Credit,Reference",
      `03/09/2026,EMIRATES EK725 DXB-DAR ${run},"1,200.00",,R-${run}-1`,
      `04/09/2026,Unknown vendor ${run},99.00,,R-${run}-2`,
      `05/09/2026,Advisory fee received ${run},,"3,672.50",R-${run}-3`,
    ].join("\r\n"),
  );
});

test.describe.serial("principal · finance", () => {
  test.use({ storageState: authFile("principal") });

  test("overview shows P&L, cash and aging", async ({ page }) => {
    await page.goto("/finance");
    await expect(page.getByRole("heading", { level: 1, name: "Finance" })).toBeVisible();
    await expect(page.getByText("Cash on hand")).toBeVisible();
    await expect(page.getByRole("img", { name: /Money in and money out/ })).toBeVisible();
    await expect(page.getByRole("table", { name: "Profit and loss by month" })).toBeVisible();
    await expect(page.getByText("Owed to Lantana")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/finance-overview.png`, fullPage: true });
  });

  test("invoice: draft, lines with VAT, issue, record payment", async ({ page }) => {
    await page.goto("/finance/invoices");
    await page.getByRole("button", { name: "New invoice" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Bill to").selectOption({ label: "Global Sphere" });
    await dialog.getByLabel("VAT %").fill("5");
    await dialog.getByLabel("Client reference (PO)").fill(`PO-${run}`);
    await dialog.getByRole("button", { name: "Create draft" }).click();
    await expect(page).toHaveURL(/\/finance\/invoices\/[0-9a-f-]{36}$/);
    await page.getByLabel("Line").fill(`Advisory retainer ${run}`);
    await page.getByLabel("Unit price (USD)").fill("1,000");
    await page.getByRole("button", { name: "Add line" }).click();
    await expect(page.getByText("USD 1,050.00").first()).toBeVisible();
    await page.getByRole("button", { name: "Issue" }).click();
    await expect(page.getByText("Sent", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Record payment" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Record payment" }).click();
    await expect(page.getByText("Paid", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Receipts in the ledger")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/finance-invoice.png`, fullPage: true });
  });

  test("statement import suggests categories and skips lines already imported", async ({ page }) => {
    await page.goto("/finance/ledger");
    for (const pass of [1, 2]) {
      await page.getByRole("button", { name: "Import statement" }).click();
      const dialog = page.getByRole("dialog");
      await dialog.locator("#imp-file").setInputFiles(STATEMENT);
      if (pass === 1) {
        await expect(dialog.getByText("3 to import")).toBeVisible({ timeout: 15_000 });
        await expect(dialog.getByLabel("Category for row 2")).toHaveValue(/.+/);
        await expect(dialog.getByText(/Suggested: Matches rule "emirates"/)).toBeVisible();
        await expect(dialog.getByLabel("Category for row 3")).toHaveValue("");
        await dialog.getByRole("button", { name: /^Import 3 lines/ }).click();
        await expect(page.getByText("Imported 3 lines")).toBeVisible();
      } else {
        await expect(dialog.getByText("3 already imported (skipped)")).toBeVisible({ timeout: 15_000 });
        await expect(dialog.getByRole("button", { name: /^Import/ })).toBeDisabled();
        await dialog.getByRole("button", { name: "Cancel" }).click();
      }
    }
    await page.getByPlaceholder(/Search descriptions/).fill(run);
    await expect(page.getByText(`EMIRATES EK725 DXB-DAR ${run}`)).toBeVisible();
    await expect(page.getByText("From a rule").first()).toBeVisible();
  });

  test("budget vs actual takes a new budget", async ({ page }) => {
    await page.goto("/finance/budgets");
    // Visible copy only (see phase2 spec: React's hidden streaming buffer can hold a second copy for a moment).
    const travel = page.getByLabel("Budget for Travel").filter({ visible: true });
    await travel.fill("12000");
    await travel.press("Enter");
    await page.reload();
    await expect(page.getByLabel("Budget for Travel").filter({ visible: true })).toHaveValue("12000");
  });
});

test.describe.serial("principal · people and payroll", () => {
  test.use({ storageState: authFile("principal") });

  test("pay and ID numbers stay hidden until asked for", async ({ page }) => {
    await page.goto(STAFF);
    await expect(page.getByRole("heading", { name: "Test Staff" })).toBeVisible();
    await expect(page.getByText("•••• 0002").first()).toBeVisible();
    await expect(page.getByText("AE070330000000000000002")).toHaveCount(0);
    await page.getByRole("button", { name: "Reveal numbers" }).click();
    await expect(page.getByText("AE070330000000000000002")).toBeVisible();
    await page.getByRole("button", { name: "Show pay" }).click();
    await expect(page.getByText("AED 5,000.00").first()).toBeVisible();
    await expect(page.getByText("End-of-service gratuity to date")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/people-employee-principal.png`, fullPage: true });
  });

  test("WPS file lists what's missing, then builds once the employer numbers exist", async ({ page }) => {
    await page.goto("/people/payroll");
    await page.getByRole("link").filter({ hasText: "Paid" }).first().click();
    await expect(page.getByRole("heading", { name: /^Payroll · / })).toBeVisible();
    const sif = page.url() + "/sif";
    const before = await page.request.get(sif);
    expect(before.status()).toBe(422);
    expect(await before.text()).toContain("MOHRE establishment ID");

    await page.goto("/people/payroll");
    await page.getByLabel("MOHRE establishment ID").fill("1234567890123");
    await page.getByLabel("Employer bank routing code").fill("803320101");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("WPS details saved")).toBeVisible();
    const after = await page.request.get(sif);
    expect(after.status()).toBe(200);
    const body = await after.text();
    expect(body).toMatch(/^EDR,10000000000001,803320101,AE070330000000000000001,/);
    expect(body).toMatch(/\r\nSCR,1234567890123,803320101,\d{4}-\d{2}-\d{2},\d{4},\d{6},2,18500\.00,AED,/);
  });

  test("salary certificate comes from the paid payroll run", async ({ page }) => {
    await page.goto("/documents/templates/salary_certificate");
    await page.getByLabel("Employee", { exact: true }).selectOption({ label: "Test Staff" });
    await page.getByLabel("Purpose").fill(`opening a bank account (${run})`);
    await page.getByRole("button", { name: "Generate and save" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Salary certificate — Test Staff" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Restricted").first()).toBeVisible();
  });
});

test.describe.serial("principal · compliance", () => {
  test.use({ storageState: authFile("principal") });

  test("the RAKEZ licences are on record and the renewal is a confirmed deadline", async ({ page }) => {
    await page.goto("/compliance/records");
    for (const no of ["7015890", "45033268", "47027560"]) await expect(page.getByText(no, { exact: true })).toBeVisible();
    await page.goto("/compliance");
    // Listed once in the calendar and, within 90 days of the due date, again under "due soon".
    await expect(page.getByText("RAKEZ licence renewal (7015890, 45033268, 47027560)").filter({ visible: true }).first()).toBeVisible();
  });

  test("a principal confirms an obligation, which then joins the calendar", async ({ page }) => {
    await page.goto("/compliance");
    const item = page.getByRole("listitem").filter({ hasText: "UBO register kept with RAKEZ" });
    await item.getByRole("button", { name: "Confirm" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Due date").fill("2027-03-31");
    await dialog.getByLabel("Repeats").selectOption("yearly");
    await dialog.getByRole("button", { name: "Confirm" }).click();
    await expect(page.getByRole("region", { name: "March 2027" }).getByText("UBO register kept with RAKEZ")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/compliance.png`, fullPage: true });
  });
});

test.describe.serial("manager · people, finance, compliance", () => {
  test.use({ storageState: authFile("manager") });

  test("sees the team and visa dates but no pay, ID numbers or payroll", async ({ page }) => {
    await page.goto(STAFF);
    await expect(page.getByText("Pay is visible to principals only.")).toBeVisible();
    await expect(page.getByText("Identity and bank")).toHaveCount(0);
    await expect(page.getByText("Residence visa")).toBeVisible();
    await page.goto("/people/payroll");
    await expect(page.getByText("Payroll is visible to principals only.")).toBeVisible();
    await page.goto("/finance");
    await expect(page.getByText("Principals only", { exact: true })).toBeVisible();
    await expect(page.getByText("Bank balances and cash flow are visible to principals only.")).toBeVisible();
    await page.goto("/finance/ledger");
    await expect(page.getByText("Payroll", { exact: true })).toHaveCount(0);
  });

  test("approves a staff member's leave but not their own", async ({ page }) => {
    await page.goto("/people/leave");
    await page.getByRole("button", { name: "Approve Test Staff" }).click();
    await expect(page.getByText("Approved", { exact: true }).first()).toBeVisible();
    await page.goto(MANAGER_EMP);
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
  });

  test("can't confirm compliance obligations", async ({ page }) => {
    await page.goto("/compliance");
    await expect(page.getByText("Waiting for a principal").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Confirm" })).toHaveCount(0);
  });
});

test.describe.serial("staff · people", () => {
  test.use({ storageState: authFile("staff") });

  test("sees the directory and only their own record", async ({ page }) => {
    await page.goto("/people");
    await expect(page.getByText("Test Manager", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "New employee" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Payroll" })).toHaveCount(0);
    await page.goto(MANAGER_EMP);
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
  });

  test("requests leave and cancels it", async ({ page }) => {
    await page.goto("/people");
    await page.getByRole("link", { name: /Your record and leave/ }).click();
    await expect(page.getByText("Pay is visible")).toHaveCount(0);
    await expect(page.getByText("Show pay")).toHaveCount(0);
    await page.getByRole("button", { name: "Request leave" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Type").selectOption("compassionate");
    await dialog.getByLabel("From", { exact: true }).fill("2027-02-01");
    await dialog.getByLabel("To", { exact: true }).fill("2027-02-02");
    await expect(dialog.getByLabel("Working days")).toHaveValue("2");
    await dialog.getByRole("button", { name: "Request" }).click();
    await expect(page.getByText("Leave requested")).toBeVisible();
    const item = page.getByRole("listitem").filter({ hasText: "Compassionate" });
    await expect(item.getByText("Pending")).toBeVisible();
    await expect(item.getByRole("button", { name: "Approve" })).toHaveCount(0);
    await item.getByRole("button", { name: "Cancel" }).click();
    await expect(item.getByText("Cancelled")).toBeVisible();
  });
});
