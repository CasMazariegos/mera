/** Renders a docs/press-src/*.html page to public/press/<name>.jpg (for the DEV post). */
import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";

const [name, width = "1600", height = "900"] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: Number(height) }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(resolve(`docs/press-src/${name}.html`)).href, { waitUntil: "load" });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: `public/press/${name}.jpg`, type: "jpeg", quality: 90 });
await browser.close();
