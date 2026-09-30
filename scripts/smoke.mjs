// Dev smoke test: sign in as a test account, open pages, report status, h1 and browser errors.
// Usage: node scripts/smoke.mjs <email> /path1 /path2 …   (SHOT=dir to save screenshots)
import { chromium } from "@playwright/test";
const [,, email = "maimouna@lantana.test", ...paths] = process.argv;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => m.type() === "error" && errors.push("console: " + m.text().slice(0, 300)));
for (let i = 0; i < 40; i++) { try { const r = await fetch("http://localhost:3000/login"); if (r.ok) break; } catch {} await new Promise(r => setTimeout(r, 1500)); }
await page.goto("http://localhost:3000/login");
await page.getByLabel("Work email").fill(email);
await page.getByLabel("Password").fill("lantana-dev-2026");
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForURL("http://localhost:3000/", { timeout: 60000 });
for (const p of paths) {
  const res = await page.goto("http://localhost:3000" + p, { timeout: 90000 });
  await page.waitForTimeout(1200);
  const h1 = await page.locator("h1").first().textContent().catch(() => "?");
  const bodyErr = await page.locator("text=/Application error|Unhandled Runtime Error|Error:/").count();
  console.log(res.status(), p, "|", h1, bodyErr ? "| ERROR TEXT ON PAGE" : "");
  if (process.env.SHOT) await page.screenshot({ path: `${process.env.SHOT}/${p.replace(/[^a-z0-9]/gi, "_")}.png`, fullPage: true });
}
console.log(errors.length ? errors.join("\n") : "no browser errors");
await browser.close();
