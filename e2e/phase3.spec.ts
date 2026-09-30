import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { extractText, getDocumentProxy } from "unpdf";
import { SHOTS, authFile } from "./helpers";

// Phase 3: documents vault, share links, contracts. Writes data; names carry the run id.
const run = process.env.E2E_RUN!;
const MARKER = `zanzibar${run}`;
const FIXTURE = `test-results/fixtures/cooperation-${run}.pdf`;

test.beforeAll(async () => {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([595, 842]);
  const lines = [
    "Cooperation Agreement (e2e fixture)",
    "Clause 9. Survival.",
    "The non-circumvention obligations survive for twenty-four months after termination.",
    `Reference ${MARKER}. Governing law: the laws of the Emirate of Ras Al Khaimah.`,
  ];
  lines.forEach((l, i) => page.drawText(l, { x: 50, y: 780 - i * 22, size: 12, font }));
  mkdirSync("test-results/fixtures", { recursive: true });
  writeFileSync(FIXTURE, await pdf.save());
});

test.describe.serial("manager · documents vault", () => {
  test.use({ storageState: authFile("manager") });
  let docUrl = "";
  let shareUrl = "";

  test("upload a PDF, get it indexed, search inside it", async ({ page }) => {
    await page.goto("/documents");
    await expect(page.getByRole("heading", { level: 1, name: "Documents" })).toBeVisible();
    await page.getByRole("button", { name: "Upload" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByTestId("upload-input").setInputFiles(FIXTURE);
    await dialog.getByLabel("Title").fill(`Cooperation agreement ${run}`);
    await dialog.getByLabel("Folder").selectOption({ label: "Agreements" });
    await dialog.getByLabel("Tags").fill("E2E, Tanzania");
    await dialog.getByRole("button", { name: "Upload", exact: true }).click();

    await expect(page.getByRole("heading", { level: 1, name: `Cooperation agreement ${run}` })).toBeVisible({ timeout: 30_000 });
    docUrl = page.url();
    await expect(page.getByText("Searchable")).toBeVisible({ timeout: 45_000 });
    await expect(page.locator("iframe[title^='Preview of']")).toBeVisible();

    await page.goto("/documents");
    await page.getByLabel("Search inside documents").fill(MARKER);
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByRole("link", { name: `Cooperation agreement ${run}` }).first()).toBeVisible();
    await expect(page.locator("mark", { hasText: MARKER })).toBeVisible();
  });

  test("share link opens anonymously, is logged, and stops when revoked", async ({ page, browser }) => {
    await page.goto(docUrl);
    await page.getByRole("button", { name: "Create share link" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Recipient").fill("Faminas legal team");
    await dialog.getByLabel("View limit").fill("3");
    await dialog.getByRole("button", { name: "Create link" }).click();
    shareUrl = await dialog.getByLabel("Share link").inputValue();
    expect(shareUrl).toMatch(/\/s\/[\w-]{40,}$/);
    await dialog.getByRole("button", { name: "Done" }).click();

    const anon = await browser.newContext();
    const res = await anon.request.get(shareUrl);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("application/pdf");
    expect(res.headers()["cache-control"]).toContain("no-store");
    const body = await res.body();
    expect(body.subarray(0, 5).toString()).toBe("%PDF-");
    const { text } = await extractText(await getDocumentProxy(new Uint8Array(body)), { mergePages: true });
    expect(text).toContain("Shared with Faminas legal team");
    expect(text).toContain("twenty-four months");

    await page.reload();
    await expect(page.getByText(/1\s+of 3\s+views/)).toBeVisible();
    await page.getByRole("button", { name: "Revoke" }).click();
    await expect(page.getByText("Revoked", { exact: true })).toBeVisible();

    const gone = await anon.newPage();
    await gone.goto(shareUrl);
    await expect(gone.getByText("This link was withdrawn by the sender.")).toBeVisible();
    await anon.close();
  });

  test("a bad token shows the unavailable page", async ({ browser }) => {
    const anon = await browser.newContext();
    const p = await anon.newPage();
    await p.goto("/s/not-a-real-token-but-long-enough-to-check");
    await expect(p.getByRole("heading", { name: "Document unavailable" })).toBeVisible();
    await anon.close();
  });
});

test.describe("staff · documents vault", () => {
  test.use({ storageState: authFile("staff") });

  test("sees documents linked to their deal, not other confidential ones", async ({ page }) => {
    await page.goto("/documents");
    await expect(page.getByRole("link", { name: "NCNDA — PJM Advisory" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Faminas Investment Group/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "New folder" })).toHaveCount(0);
  });

  test("a hidden document shows not-found", async ({ page }) => {
    await page.goto("/documents/f0000000-0000-4000-8000-000000000002");
    await expect(page.getByText(/not found|doesn.t exist/i).first()).toBeVisible();
  });
});

test.describe.serial("principal · templates", () => {
  test.use({ storageState: authFile("principal") });

  test("NCNDA as PDF from the directory, saved as a draft and indexed", async ({ page }) => {
    await page.goto("/documents/templates");
    await expect(page.getByText("Available once payroll is live (Phase 5)", { exact: false })).toBeVisible();
    await page.getByRole("link", { name: "Use the NCNDA template" }).click();
    await page.getByLabel("Fill from the directory").selectOption({ label: "PJM Advisory" });
    await expect(page.getByLabel("Counterparty (legal name)")).toHaveValue("PJM Advisory");
    await page.getByLabel("Counterparty (legal name)").fill(`PJM Advisory ${run}`);
    await page.getByLabel("Incorporated in (optional)").fill("Tanzania");
    await page.getByRole("button", { name: "Generate and save" }).click();
    await expect(page.getByRole("heading", { level: 1, name: `NCNDA — PJM Advisory ${run}` })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Draft", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Searchable")).toBeVisible({ timeout: 45_000 });
    await expect(page.getByRole("link", { name: "PJM Advisory", exact: true })).toBeVisible();
  });

  test("Mandate as Word, required fields enforced", async ({ page }) => {
    await page.goto("/documents/templates/mandate");
    await page.getByRole("button", { name: "Generate and save" }).click();
    await expect(page.getByText("Required").first()).toBeVisible();
    await page.getByLabel("Client (legal name)").fill(`Faminas Investment Group ${run}`);
    await page.getByLabel("Mandate", { exact: true }).fill("identify and introduce GCC investors for the Morogoro fertilizer blending plant");
    await page.getByLabel("Word (DOCX)").check();
    await page.getByRole("button", { name: "Generate and save" }).click();
    await expect(page.getByRole("heading", { level: 1, name: `Mandate & Non-Circumvention Agreement — Faminas Investment Group ${run}` })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/\.docx/).first()).toBeVisible();
    await expect(page.getByText("Searchable")).toBeVisible({ timeout: 45_000 });
  });

  test("invoice prints from a recorded invoice", async ({ page }) => {
    await page.goto("/documents/templates/invoice");
    const select = page.getByLabel("Invoice", { exact: true });
    const first = await select.locator("option").nth(1).textContent();
    await select.selectOption({ index: 1 });
    await page.getByRole("button", { name: "Generate and save" }).click();
    await expect(page.getByRole("heading", { level: 1, name: new RegExp(`^Invoice ${first!.split(" · ")[0]}`) })).toBeVisible({ timeout: 30_000 });
  });
});

test.describe("staff · templates", () => {
  test.use({ storageState: authFile("staff") });
  test("manager-only templates are locked", async ({ page }) => {
    await page.goto("/documents/templates");
    await expect(page.getByRole("link", { name: "Use the Invoice template" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Use the Board Resolution template" })).toHaveCount(0);
    await page.goto("/documents/templates/invoice");
    await expect(page.getByText("Only a manager or principal can use this template.")).toBeVisible();
  });
});

test.describe.serial("manager · contracts register", () => {
  test.use({ storageState: authFile("manager") });
  let url = "";

  test("register lists the demo contracts and flags the abolished forum", async ({ page }) => {
    await page.goto("/contracts");
    await expect(page.getByRole("heading", { level: 1, name: "Contracts" })).toBeVisible();
    await expect(page.getByRole("link", { name: "NCNDA — PJM Advisory" })).toBeVisible();
    await page.getByRole("link", { name: "Mandate & Non-Circumvention — Faminas Investment Group" }).click();
    await expect(page.getByText("Forum names DIFC-LCIA, abolished in 2021")).toBeVisible();
    await expect(page.getByText("Last day to give 30-day notice")).toBeVisible();
    await expect(page.getByRole("button", { name: "AI clause review" })).toBeDisabled();
  });

  test("create a contract, add an obligation that becomes a task, add a survival clause", async ({ page }) => {
    await page.goto("/contracts");
    await page.getByRole("button", { name: "New contract" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Title").fill(`Engagement — Ministry of Agriculture ${run}`);
    await dialog.getByLabel("Type").selectOption({ label: "Engagement" });
    await dialog.getByLabel("Status").selectOption({ label: "Active" });
    await dialog.getByLabel("Effective date").fill("2026-07-01");
    await dialog.getByLabel("Term (months)").fill("6");
    await expect(dialog.getByLabel("End of current term")).toHaveValue("2027-01-01");
    await dialog.getByLabel("Renewal").selectOption({ label: "Renews automatically" });
    await dialog.getByRole("button", { name: "Add contract" }).click();
    await expect(dialog.getByText("Auto-renewing contracts need a notice period")).toBeVisible();
    await dialog.getByLabel("Notice period (days)").fill("60");
    await dialog.getByRole("button", { name: "Add contract" }).click();
    await expect(page.getByRole("heading", { level: 1, name: `Engagement — Ministry of Agriculture ${run}` })).toBeVisible();
    url = page.url();
    await expect(page.getByText("Last day to give 60-day notice")).toBeVisible();
    await expect(page.getByText("No signed copy in the vault")).toBeVisible();

    await page.getByRole("button", { name: "Add obligation" }).click();
    await page.getByLabel("Obligation", { exact: true }).fill(`Deliver the fertilizer supply study ${run}`);
    await page.getByLabel("Due date").fill("2026-11-15");
    await page.getByRole("button", { name: "Add obligation" }).click();
    await expect(page.getByText("Obligation added and a task created for it")).toBeVisible();
    await expect(page.getByRole("link", { name: "Task", exact: true })).toBeVisible();

    await page.getByLabel("Surviving clause").fill("Confidentiality");
    await page.getByLabel("Months").fill("12");
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText(/lapses 1 Jan 2028/)).toBeVisible();

    await page.goto("/tasks?view=list");
    await expect(page.getByText(`Obligation: Deliver the fertilizer supply study ${run}`).first()).toBeVisible();
  });

  test("closing an obligation closes its task", async ({ page }) => {
    await page.goto(url);
    await page.getByRole("button", { name: `Mark done: Deliver the fertilizer supply study ${run}` }).click();
    await expect(page.getByText("Done", { exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Task", exact: true }).click();
    await expect(page.getByRole("dialog").getByLabel("Status")).toHaveValue("done");
  });

  test("run expiry alerts from settings", async ({ page }) => {
    await page.goto("/settings");
    await page.getByRole("button", { name: "Run expiry alerts now" }).click();
    await expect(page.getByText(/alerts? sent|Nothing new is due/)).toBeVisible();
  });
});

test.describe("staff · contracts register", () => {
  test.use({ storageState: authFile("staff") });
  test("is not reachable", async ({ page }) => {
    await page.goto("/contracts");
    await expect(page.getByText(/not found|doesn.t exist/i).first()).toBeVisible();
    await page.goto("/contracts/e0000000-0000-4000-8000-000000000001");
    await expect(page.getByText(/not found|doesn.t exist/i).first()).toBeVisible();
  });
});

test.describe("principal · phase 3 pages at desktop in both themes", () => {
  test.use({ storageState: authFile("principal") });
  test("documents, templates and contracts render in light and dark", async ({ page }) => {
    for (const theme of ["light", "dark"] as const) {
      await page.goto("/");
      await page.evaluate((t) => localStorage.setItem("theme", t), theme);
      for (const [path, name] of [
        ["/documents", "documents"],
        ["/documents/templates", "templates"],
        ["/contracts", "contracts"],
        ["/contracts/e0000000-0000-4000-8000-000000000002", "contract-page"],
      ] as const) {
        await page.goto(path);
        await expect(page.locator("h1").first()).toBeVisible();
        await page.screenshot({ path: `${SHOTS}/desktop-${name}-${theme}.png`, fullPage: true });
      }
    }
  });
});
