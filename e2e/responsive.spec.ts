import { test, expect } from "@playwright/test";
import { SHOTS, authFile, noHorizontalScroll, setTheme } from "./helpers";

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
  for (const path of ["/settings", "/deals", "/contracts", "/finance"]) {
    await page.goto(path);
    expect(await noHorizontalScroll(page), path).toBe(true);
  }
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
