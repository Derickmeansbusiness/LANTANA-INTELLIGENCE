import { test as setup, expect } from "@playwright/test";
import { EMAIL, GUEST, ROLES, authFile } from "./helpers";

for (const role of ROLES) {
  setup(`sign in as ${role}`, async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Work email").fill(EMAIL[role]);
    await page.getByLabel("Password").fill("lantana-dev-2026");
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good (morning|afternoon|evening)/, { timeout: 30_000 });
    await page.context().storageState({ path: authFile(role) });
  });
}

setup("sign in as the data-room guest", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(GUEST.email);
  await page.getByLabel("Password").fill("lantana-dev-2026");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  // Guests land in the portal, never the internal app.
  await expect(page).toHaveURL(/\/portal$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Welcome, Test Guest");
  await page.context().storageState({ path: GUEST.auth });
});
