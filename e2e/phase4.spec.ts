import { test, expect, type Page } from "@playwright/test";
import { SHOTS, authFile } from "./helpers";

// Phase 4: Ask Lantana, against the scripted mock API (scripts/mock-anthropic.mjs).
const MOCK = "http://127.0.0.1:4010/__requests";
const run = process.env.E2E_RUN!;

async function openPanel(page: Page) {
  await page.getByRole("button", { name: "Ask Lantana (Ctrl+J)" }).click();
  return page.getByRole("dialog", { name: "Ask Lantana" });
}

test.describe.serial("principal · Ask Lantana", () => {
  test.use({ storageState: authFile("principal") });

  test("answers from the user's own data, with links to the records", async ({ page }) => {
    await page.goto("/");
    const panel = await openPanel(page);
    await panel.getByLabel("Message Ask Lantana").fill("Find Morogoro");
    await panel.getByLabel("Message Ask Lantana").press("Enter");
    await expect(panel.getByText("Searching records")).toBeVisible();
    const link = panel.getByRole("link", { name: "Morogoro agro-processing hub" }).first();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute("href", /\/deals\/d0000000-0000-4000-8000-000000000003$/);
  });

  test("every request opts into server-side fallback and prompt caching", async ({ request }) => {
    const sent = (await (await request.get(MOCK)).json()) as { beta: string; fallbacks: string; system_cached: boolean; cache_control: unknown }[];
    expect(sent.length).toBeGreaterThan(0);
    for (const r of sent.filter((x) => !("structured" in x) || !x["structured" as never])) {
      expect(r.beta).toContain("server-side-fallback-2026-07-01");
      expect(r.fallbacks).toBe("default");
      expect(r.system_cached).toBe(true);
      expect(r.cache_control).toEqual({ type: "ephemeral" });
    }
  });

  test("a write becomes a proposal, and only Confirm creates the task", async ({ page, context }) => {
    const TITLE = `Call PJM Advisory about the fee agreement (${run})`;
    await page.goto("/");
    const panel = await openPanel(page);
    await panel.getByLabel("Message Ask Lantana").fill(`Remind me to call PJM about the fee, ref ${run}`);
    await panel.getByLabel("Message Ask Lantana").press("Enter");
    const card = panel.getByTestId("proposal-card");
    await expect(card).toContainText(`Create task: ${TITLE}`);
    await expect(card).toContainText("High");

    // Proposed, not created: a second tab doesn't see it.
    const other = await context.newPage();
    await other.goto("/tasks?view=list");
    await expect(other.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(other.getByText(TITLE)).toHaveCount(0);

    await card.getByRole("button", { name: "Confirm" }).click();
    await expect(card).toContainText("Done");
    await expect(card.getByRole("button", { name: "Confirm" })).toHaveCount(0);
    await expect(card.getByRole("link", { name: /Task created/ })).toBeVisible();

    await other.reload();
    await expect(other.getByText(TITLE).first()).toBeVisible();
    await other.close();
  });

  test("drafts an email without sending it", async ({ page }) => {
    await page.goto("/agent");
    await page.getByLabel("Message Ask Lantana").fill("Draft an email to Patrick about the fee");
    await page.getByLabel("Message Ask Lantana").press("Enter");
    const draft = page.getByTestId("draft-card");
    await expect(draft).toContainText("not sent");
    await expect(draft).toContainText("Fee agreement for Morogoro");
  });

  test("conversations are kept and can be reopened", async ({ page }) => {
    await page.goto("/agent");
    const list = page.getByRole("complementary", { name: "Conversations" });
    await expect(list.getByText("Find Morogoro").first()).toBeVisible();
    await list.getByText("Find Morogoro").first().click();
    await expect(page).toHaveURL(/\/agent\?thread=/);
    await expect(page.getByRole("link", { name: "Morogoro agro-processing hub" }).first()).toBeVisible();
  });

  test("Ctrl+K free text goes to the agent", async ({ page }) => {
    await page.goto("/deals");
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder(/Search deals/).fill("How is the pipeline looking?");
    await page.getByRole("option", { name: /Ask: “How is the pipeline looking\?”/ }).click();
    const panel = page.getByRole("dialog", { name: "Ask Lantana" });
    await expect(panel.getByText("Summarising the pipeline")).toBeVisible();
    await expect(panel.getByText("Here's what I found")).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/agent-panel-desktop-dark.png` });
  });
});

test.describe("staff · Ask Lantana", () => {
  test.use({ storageState: authFile("staff") });

  test("works under staff permissions and can't see other people's conversations", async ({ page }) => {
    await page.goto("/agent");
    await expect(page.getByRole("complementary", { name: "Conversations" }).getByText("Find Morogoro")).toHaveCount(0);
    await page.getByLabel("Message Ask Lantana").fill("Find Faminas");
    await page.getByLabel("Message Ask Lantana").press("Enter");
    await expect(page.getByText("Searching records")).toBeVisible();
    // Staff can see the organization but not the confidential mandate behind it.
    await expect(page.getByRole("link", { name: /Mandate & Non-Circumvention/ })).toHaveCount(0);
  });
});
