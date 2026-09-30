import { test as setup, expect } from "@playwright/test";
import { EMAIL, ROLES, authFile } from "./helpers";

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
