import { mkdirSync, writeFileSync } from "node:fs";
import { test, expect } from "@playwright/test";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { extractText, getDocumentProxy } from "unpdf";
import { authFile } from "./helpers";

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
