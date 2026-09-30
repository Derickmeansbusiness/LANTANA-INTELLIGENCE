// Dev helper: sign in as a test account and GET a URL, saving the body to a file.
// Usage: node scripts/fetch-as.mjs <email> <path> <outfile>
import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const [, , email, path, out] = process.argv;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" });
const ctx = await browser.newContext();
const page = await ctx.newPage();
await page.goto("http://localhost:3000/login");
await page.getByLabel("Work email").fill(email);
await page.getByLabel("Password").fill("lantana-dev-2026");
await page.getByRole("button", { name: "Sign in", exact: true }).click();
await page.waitForURL("http://localhost:3000/", { timeout: 60000 });
const res = await ctx.request.get("http://localhost:3000" + path, { timeout: 120000 });
console.log(res.status(), res.headers()["content-type"], res.headers()["content-disposition"] ?? "");
writeFileSync(out, await res.body());
await browser.close();
