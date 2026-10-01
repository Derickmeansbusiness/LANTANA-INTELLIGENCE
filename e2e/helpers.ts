import type { Page } from "@playwright/test";

export const ROLES = ["principal", "manager", "staff"] as const;
export type TestRole = (typeof ROLES)[number];
export const EMAIL: Record<TestRole, string> = {
  principal: "maimouna@lantana.test",
  manager: "manager@lantana.test",
  staff: "staff@lantana.test",
};
export const authFile = (role: TestRole) => `e2e/.auth/${role}.json`;
export const SHOTS = process.env.SCREENSHOT_DIR ?? "test-results/screens";

export async function setTheme(page: Page, theme: "dark" | "light") {
  await page.evaluate((t) => localStorage.setItem("theme", t), theme);
  await page.reload();
}

/**
 * Compares the document width with the CONFIGURED viewport. Under mobile
 * emulation window.innerWidth grows to fit overflowing content, so it can't
 * be used as the yardstick.
 */
export async function noHorizontalScroll(page: Page) {
  const width = page.viewportSize()?.width ?? 375;
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  return scrollWidth <= width + 1;
}

/** The seeded data-room guest (role external). Kept out of ROLES: guests only ever see the portal. */
export const GUEST = { email: "guest@lantana.test", auth: "e2e/.auth/guest.json" };
