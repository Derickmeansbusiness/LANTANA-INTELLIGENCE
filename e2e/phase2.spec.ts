import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";
import { SHOTS, authFile, setTheme } from "./helpers";

// These tests write data. Names carry a run id so re-runs don't collide.
const run = process.env.E2E_RUN!;
const MOROGORO = "/deals/d0000000-0000-4000-8000-000000000003";
const GLOBAL_SPHERE = "/partners/a0000000-0000-4000-8000-000000000003";

async function selectOption(page: Page, label: string | RegExp, option: string) {
  await page.getByLabel(label).selectOption({ label: option });
}

test.describe("principal · deals", () => {
  test.use({ storageState: authFile("principal") });

  test("create a deal, move it with a note, see it in the history", async ({ page }) => {
    await page.goto("/deals");
    await page.getByRole("button", { name: "New deal" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Deal name").fill(`Kenya dairy cold chain ${run}`);
    await selectOption(page, "Sector", "Agriculture");
    await selectOption(page, "Country", "Kenya");
    await dialog.getByLabel("Ticket size").fill("12,500,000");
    await dialog.getByRole("button", { name: "Create deal" }).click();
    await expect(page.getByRole("heading", { level: 1, name: `Kenya dairy cold chain ${run}` })).toBeVisible();
    await expect(page.getByText("USD 12,500,000.00")).toBeVisible();

    await page.getByRole("button", { name: "Move stage" }).click();
    await page.getByRole("menuitem", { name: "Qualified" }).click();
    await page.getByLabel("Note", { exact: true }).fill("Sponsor shared audited accounts");
    await page.getByRole("button", { name: "Move deal" }).click();
    await expect(page.getByText("Moved to Qualified").first()).toBeVisible();
    await expect(page.getByText("Sponsor shared audited accounts")).toBeVisible();
  });

  test("closing a deal requires a reason", async ({ page }) => {
    await page.goto("/deals?view=table");
    await page.getByPlaceholder("Search deals…").fill(`Kenya dairy cold chain ${run}`);
    await page.getByRole("link", { name: `Kenya dairy cold chain ${run}` }).click();
    await page.getByRole("button", { name: "Move stage" }).click();
    await page.getByRole("menuitem", { name: "Closed-lost" }).click();
    await expect(page.getByRole("button", { name: "Move deal" })).toBeDisabled();
    await page.getByLabel("Reason (required)").fill("Sponsor went with a local bank");
    await page.getByRole("button", { name: "Move deal" }).click();
    await expect(page.getByText("Closed-lost").first()).toBeVisible();
  });

  test("board: move a card with the keyboard-friendly menu", async ({ page }) => {
    await page.goto("/deals");
    await page.getByRole("button", { name: "Move Lagos private school campus expansion" }).click();
    await page.getByRole("menuitem", { name: "Qualified" }).click();
    await expect(page.getByText(/Lagos private school campus expansion → Qualified/)).toBeVisible();
    await expect(page.getByRole("region", { name: /^Qualified, \d+ deals/ })).toContainText("Lagos private school");
  });

  test("table: facet filter, saved view, CSV export", async ({ page }) => {
    await page.goto("/deals?view=table");
    await page.getByLabel("Filter by Countries").selectOption({ label: "Tanzania" });
    await expect(page.getByText(/^3 of \d+ rows$/)).toBeVisible();
    await page.getByRole("button", { name: "Saved views" }).click();
    await page.getByRole("menuitem", { name: "Save current view…" }).click();
    await page.getByLabel("View name").fill(`Tanzania ${run}`);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(`Saved view “Tanzania ${run}”`)).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: "Saved views" }).click();
    await page.getByRole("menuitem", { name: new RegExp(`Tanzania ${run}`) }).click();
    await expect(page.getByText(/^3 of \d+ rows$/)).toBeVisible();

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export CSV" }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^lantana-deals-\d{4}-\d{2}-\d{2}\.csv$/);
    const csv = readFileSync((await file.path())!, "utf8");
    expect(csv).toContain("Dodoma solar mini-grid portfolio");
    expect(csv).not.toContain("Mauritania");
  });

  test("forecast renders with a table fallback", async ({ page }) => {
    await page.goto("/deals?view=forecast");
    await expect(page.getByRole("img", { name: "Weighted pipeline by expected close month" })).toBeVisible();
    await page.getByText("Show as a table").click();
    await expect(page.getByRole("columnheader", { name: "Unweighted" })).toBeVisible();
  });

  test("deal page: matcher, link party, add team member, add note", async ({ page }) => {
    await page.goto("/deals/d0000000-0000-4000-8000-000000000005");
    await expect(page.getByText("Who do we know for this?")).toBeVisible();
    await expect(page.getByText("On the deal")).toBeVisible();
    await page.getByLabel("New note").fill(`IC date moved to next month ${run}`);
    await page.getByRole("button", { name: "Add note" }).click();
    await expect(page.getByText(`IC date moved to next month ${run}`)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/deal-page-dark.png`, fullPage: true });
    await setTheme(page, "light");
    await page.screenshot({ path: `${SHOTS}/deal-page-light.png`, fullPage: true });
    await setTheme(page, "dark");
  });
});

test.describe("principal · ledger", () => {
  test.use({ storageState: authFile("principal") });

  test("log an introduction; chain stays verified; export PDF", async ({ page }) => {
    await page.goto("/deals/ledger");
    await expect(page.getByText(/Chain verified/)).toBeVisible();
    await page.getByRole("button", { name: "Log introduction" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Party A").selectOption({ label: "Global Sphere" });
    await dialog.getByLabel("Party B").selectOption({ label: "Faminas Investment Group" });
    await dialog.getByLabel("What was introduced, and how").fill(`Intro call between Global Sphere and Faminas on trade finance ${run}`);
    await dialog.getByRole("button", { name: "Record permanently" }).click();
    await expect(page.getByText(/Logged as entry #\d+/)).toBeVisible();
    await expect(page.getByText(`Intro call between Global Sphere and Faminas on trade finance ${run}`)).toBeVisible();
    await expect(page.getByText(/Chain verified/)).toBeVisible();

    const res = await page.request.get("/deals/ledger/export");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");
    expect((await res.body()).subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("introductions can be corrected but never edited", async ({ page }) => {
    await page.goto("/deals/ledger");
    await page.getByRole("button", { name: "Correct" }).first().click();
    await expect(page.getByRole("dialog").getByText(/^Correct entry #\d+/)).toBeVisible();
    await expect(page.getByRole("dialog").getByText(/can.t be edited or deleted/)).toBeVisible();
  });
});

test.describe("principal · partners", () => {
  test.use({ storageState: authFile("principal") });

  test("add an organization, a contact and an interaction", async ({ page }) => {
    await page.goto("/partners");
    await page.getByRole("button", { name: "New organization" }).click();
    const d = page.getByRole("dialog");
    await d.getByLabel("Name").fill(`Kilimanjaro Growth Fund ${run}`);
    await d.getByLabel("Type").selectOption({ label: "Investor" });
    await d.getByLabel("Agriculture").check();
    await d.getByLabel("Africa").check();
    await d.getByLabel("Ticket from").fill("2,000,000");
    await d.getByLabel("Ticket to").fill("15,000,000");
    await d.getByRole("button", { name: "Add organization" }).click();
    await expect(page.getByRole("heading", { level: 1, name: `Kilimanjaro Growth Fund ${run}` })).toBeVisible();

    await page.getByRole("button", { name: "Add contact" }).click();
    await page.getByRole("dialog").getByLabel("Full name").fill("Amina Mushi");
    await page.getByRole("dialog").getByLabel("Email").fill("amina@example.com");
    await page.getByRole("dialog").getByRole("button", { name: "Add contact" }).click();
    await expect(page.getByText("amina@example.com")).toBeVisible();

    await page.getByRole("button", { name: "Log interaction" }).click();
    await page.getByRole("dialog").getByLabel("What happened").fill("Intro call. Interested in agri processing in East Africa.");
    await page.getByRole("dialog").getByRole("button", { name: "Log it" }).click();
    await expect(page.getByText("Intro call. Interested in agri processing in East Africa.")).toBeVisible();
    await expect(page.locator("dt", { hasText: "Last contact" }).locator("..")).not.toContainText("Never");
  });

  test("new investor appears in the matcher for a fitting deal", async ({ page }) => {
    await page.goto(MOROGORO);
    await expect(page.getByRole("link", { name: new RegExp(`Kilimanjaro Growth Fund ${run}`) })).toBeVisible();
  });
});

test.describe("principal · tasks", () => {
  test.use({ storageState: authFile("principal") });

  test("recurring task: checklist, comment, complete → next occurrence", async ({ page }) => {
    const title = `Reconcile petty cash ${run}`;
    await page.goto("/tasks?view=list");
    await page.getByRole("button", { name: "New task" }).click();
    const d = page.getByRole("dialog");
    await d.getByLabel("Title").fill(title);
    await d.getByLabel("Due").fill("2026-10-15");
    await d.getByLabel("Repeats").selectOption({ label: "Every month" });
    await d.getByRole("button", { name: "Create task" }).click();
    await expect(page.getByRole("link", { name: title })).toHaveCount(1);

    await page.getByRole("link", { name: title }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel("Add an item").fill("Match receipts");
    await sheet.getByLabel("Add an item").press("Enter");
    await expect(sheet.getByText("Match receipts")).toBeVisible();
    await sheet.getByLabel("Comment").fill("Receipts are in the blue folder.");
    await sheet.getByRole("button", { name: "Comment", exact: true }).click();
    await expect(sheet.getByText("Receipts are in the blue folder.")).toBeVisible();
    await sheet.getByLabel("Status").selectOption({ label: "Done" });
    await expect(page.getByText("Status updated")).toBeVisible();
    await page.keyboard.press("Escape");

    await page.goto("/tasks?view=list");
    await page.getByPlaceholder("Search tasks…").fill(title);
    await expect(page.getByText(/^2 of \d+ rows$/)).toBeVisible();
    await expect(page.getByText("15 Nov 2026")).toBeVisible();
  });

  test("a task can't be completed while it waits on an open task", async ({ page }) => {
    const a = `Draft board resolution ${run}`;
    const b = `Sign board resolution ${run}`;
    for (const t of [a, b]) {
      await page.goto("/tasks?view=list");
      await page.getByRole("button", { name: "New task" }).click();
      await page.getByRole("dialog").getByLabel("Title").fill(t);
      await page.getByRole("dialog").getByRole("button", { name: "Create task" }).click();
      await expect(page.getByRole("link", { name: t })).toBeVisible();
    }
    await page.getByRole("link", { name: b }).click();
    const sheet = page.getByRole("dialog");
    await sheet.getByLabel("Add a task this one waits on").selectOption({ label: a });
    await expect(sheet.getByText(`Waits on ${a}`)).toBeVisible();
    await sheet.getByLabel("Status").selectOption({ label: "Done" });
    await expect(page.getByText(new RegExp(`Still blocked by: ${a}`))).toBeVisible();
  });

  test("every task view renders", async ({ page }) => {
    for (const v of ["my-day", "list", "board", "calendar", "timeline", "projects"]) {
      await page.goto(`/tasks?view=${v}`);
      await expect(page.getByRole("tab", { selected: true })).toBeVisible();
    }
    await page.goto("/tasks/projects/b1000000-0000-4000-8000-000000000001");
    // Visible copy only: while a streamed Suspense segment is being swapped in, React briefly keeps it in a hidden buffer too.
    await expect(page.getByText("Supply contract signed").filter({ visible: true })).toBeVisible();
  });
});

test.describe("staff · phase 2 permissions", () => {
  test.use({ storageState: authFile("staff") });

  test("sees only their deal, can move it, can't create or archive", async ({ page }) => {
    await page.goto("/deals?view=table");
    await expect(page.getByText(/^1 of 1 row$/)).toBeVisible();
    await expect(page.getByRole("button", { name: "New deal" })).toHaveCount(0);
    await page.goto(MOROGORO);
    await expect(page.getByRole("button", { name: "Archive" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Move stage" })).toBeEnabled();
  });

  test("can't open organizations outside their deals", async ({ page }) => {
    await page.goto(GLOBAL_SPHERE);
    await expect(page.getByRole("heading", { name: "Not found" })).toBeVisible();
    await expect(page.getByText("Global Sphere")).toHaveCount(0);
  });

  test("ledger: own deal only, no verification, no logging", async ({ page }) => {
    await page.goto("/deals/ledger");
    await expect(page.getByText("Chain verification is available to managers and principals.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Log introduction" })).toHaveCount(0);
    await expect(page.getByText(/^1 of 1 row$/)).toBeVisible();
  });
});
