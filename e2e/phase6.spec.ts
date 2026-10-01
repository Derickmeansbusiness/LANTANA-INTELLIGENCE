import { test, expect } from "@playwright/test";
import { GUEST, SHOTS, authFile } from "./helpers";

// Phase 6: reports, data rooms and the guest portal, invitations. Writes data; names carry the run id.
const run = process.env.E2E_RUN!;
const ROOM = "/data-rooms/c6000000-0000-4000-8000-000000000001";
const PORTAL_ROOM = "/portal/c6000000-0000-4000-8000-000000000001";

test.describe.serial("principal · reports", () => {
  test.use({ storageState: authFile("principal") });

  test("monthly board pack: every section, cash included, PDF, vault copy, chart exports", async ({ page }) => {
    await page.goto("/reports");
    await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/reports.png`, fullPage: true });
    await page.getByRole("link", { name: "Open" }).nth(1).click();
    await expect(page.getByRole("heading", { level: 1, name: "Monthly board pack" })).toBeVisible();
    for (const h of ["Headline figures", "Pipeline by stage", "Profit and loss", "Cash and runway", "Budget vs actual", "Compliance", "People"])
      await expect(page.getByRole("heading", { name: h, exact: true })).toBeVisible();
    await expect(page.getByRole("img", { name: /Pipeline value by stage/ })).toBeVisible();

    const png = page.waitForEvent("download");
    await page.locator("#pipeline").getByRole("button", { name: "PNG" }).click();
    expect((await png).suggestedFilename()).toMatch(/pipeline-chart\.png$/);
    const csv = page.waitForEvent("download");
    await page.locator("#pnl").getByRole("button", { name: "CSV" }).first().click();
    expect((await csv).suggestedFilename()).toMatch(/\.csv$/);

    const pdf = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download PDF" }).click();
    expect((await pdf).suggestedFilename()).toMatch(/^Monthly_board_pack.*\.pdf$/);

    await expect(page).toHaveURL(/\/reports\/view\?pack=monthly_board/);
    await page.getByRole("button", { name: "Save to vault" }).click();
    await expect(page.getByText("Saved to the vault", { exact: true })).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/report-board.png`, fullPage: true });
  });

  test("build, save and schedule a report", async ({ page }) => {
    await page.goto("/reports");
    await page.getByRole("button", { name: "Build a report" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Name").fill(`Investor update ${run}`);
    await dialog.getByLabel("Period").selectOption("quarter_to_date");
    await dialog.getByRole("checkbox", { name: "Introductions" }).click();
    await dialog.getByRole("button", { name: "Save report" }).click();
    await expect(page.getByRole("link", { name: `Investor update ${run}` })).toBeVisible();

    await page.getByRole("button", { name: "Schedule", exact: true }).click();
    const sched = page.getByRole("dialog");
    await sched.getByLabel("Report").selectOption({ label: `Investor update ${run}` });
    await sched.getByLabel("How often").selectOption("monthly");
    await sched.getByRole("button", { name: "Save schedule" }).click();
    await expect(page.getByText(`Investor update ${run}`).nth(1)).toBeVisible();

    await page.getByRole("link", { name: `Investor update ${run}` }).click();
    await expect(page.getByRole("heading", { name: "Introductions", exact: true })).toBeVisible();
    await expect(page.getByText(/Quarter to date/).first()).toBeVisible();
    await expect(page.getByText("Recent reports")).toHaveCount(0);
  });
});

test.describe("manager · reports without cash", () => {
  test.use({ storageState: authFile("manager") });

  test("cash is left out and said so", async ({ page }) => {
    await page.goto("/reports/view?pack=weekly_management");
    await expect(page.getByRole("heading", { level: 1, name: "Weekly management pack" })).toBeVisible();
    await expect(page.getByText(/Cash and runway: Principals only/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cash and runway", exact: true })).toHaveCount(0);
    await expect(page.getByText("Cash on hand")).toHaveCount(0);
  });
});

test.describe("staff · no reports or rooms", () => {
  test.use({ storageState: authFile("staff") });

  test("reports and data rooms are not found", async ({ page }) => {
    for (const path of ["/reports", "/reports/view?pack=finance", "/data-rooms", ROOM]) {
      await page.goto(path);
      await expect(page.getByText("Not found", { exact: false }).first()).toBeVisible();
    }
    expect((await page.request.get("/reports/pdf?pack=finance")).status()).toBe(404);
  });
});

test.describe.serial("data room · manager sets up, guest views, manager sees the log", () => {
  test("manager adds the board pack and a new guest", async ({ browser }) => {
    const page = await (await browser.newContext({ storageState: authFile("manager") })).newPage();
    await page.goto(ROOM);
    await expect(page.getByRole("heading", { level: 1, name: /Morogoro agro-processing/ })).toBeVisible();
    const select = page.getByLabel("Document to add");
    const value = await select.locator("option", { hasText: "Monthly board pack" }).first().getAttribute("value");
    expect(value).toBeTruthy();
    await select.selectOption(value!);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Added to the room")).toBeVisible();
    await expect(page.getByRole("link", { name: /Monthly board pack/ })).toBeVisible();

    await page.getByLabel("Email").fill(`e2e-${run}@example.com`);
    await page.getByLabel("Name", { exact: true }).fill(`Guest ${run}`);
    await page.getByRole("button", { name: "Add guest" }).click();
    await expect(page.getByText(`Guest ${run}`)).toBeVisible();
    await expect(page.getByText(/hasn’t signed in yet/).first()).toBeVisible();

    // A colleague can't be added as a guest.
    await page.getByLabel("Email").fill("staff@lantana.test");
    await page.getByRole("button", { name: "Add guest" }).click();
    await expect(page.getByText(/belongs to a colleague/).first()).toBeVisible();
  });

  test("guest sees only the portal and gets a watermarked PDF", async ({ browser }) => {
    const page = await (await browser.newContext({ storageState: GUEST.auth })).newPage();
    await page.goto("/deals");
    await expect(page).toHaveURL(/\/portal$/);
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await page.getByRole("link", { name: /Morogoro agro-processing/ }).click();
    await expect(page).toHaveURL(new RegExp(`${PORTAL_ROOM}$`));
    await expect(page.getByText("View only.")).toBeVisible();
    await expect(page.getByRole("link", { name: /^Download/ })).toHaveCount(0);
    const href = await page.getByRole("link", { name: /^View Monthly board pack/ }).first().getAttribute("href");
    await page.screenshot({ path: `${SHOTS}/portal-room.png`, fullPage: true });

    const res = await page.request.get(href!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");
    expect(res.headers()["content-disposition"]).toMatch(/^inline/);
    expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
    // View-only room: no download, and nothing outside the room.
    expect((await page.request.get(`${href}?download=1`)).status()).toBe(404);
    expect((await page.request.get(`${PORTAL_ROOM}/file/c0ffee00-0000-4000-8000-000000000000`)).status()).toBe(404);
    expect((await page.request.post("/api/agent", { data: { message: "hello" } })).status()).toBe(404);
    expect((await page.request.get("/deals/ledger/export")).status()).toBe(404);
  });

  test("manager sees the guest's views in the activity log", async ({ browser }) => {
    const page = await (await browser.newContext({ storageState: authFile("manager") })).newPage();
    await page.goto(ROOM);
    await expect(page.getByText(/Test Guest\s+viewed\s+Monthly board pack/).first()).toBeVisible();
    await expect(page.getByText(/Test Guest\s+opened the room/).first()).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/data-room.png`, fullPage: true });
  });
});

test.describe.serial("principal · invitations", () => {
  test.use({ storageState: authFile("principal") });

  test("invite a colleague, then revoke", async ({ page }) => {
    await page.goto("/settings");
    await page.getByLabel("Email").fill(`hire-${run}@example.com`);
    await page.getByLabel("Role", { exact: true }).selectOption("staff");
    await page.getByLabel("Full name").fill(`New Hire ${run}`);
    await page.getByRole("button", { name: "Invite", exact: true }).click();
    await expect(page.getByText(`New Hire ${run}`)).toBeVisible();
    // The data-room guest added by the manager shows up as an open invite too.
    await expect(page.getByText(`e2e-${run}@example.com`).first()).toBeVisible();
    await page.getByRole("listitem").filter({ hasText: `New Hire ${run}` }).getByRole("button", { name: "Revoke" }).click();
    await expect(page.getByText("Invite revoked")).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: `New Hire ${run}` })).toHaveCount(0);
  });
});
