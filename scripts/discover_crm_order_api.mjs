#!/usr/bin/env node
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const PROFILE_DIR = path.join(ROOT, ".local", "crm-browser-profile");
const OUTPUT_DIR = path.join(ROOT, "data", "integration-checks", "reports");

function parseArgs(argv) {
  const args = {
    url: "https://kkhc-admin.likeduoduiyi.cn/#/order",
    waitMs: 12000,
    clickTexts: [],
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--url") args.url = argv[++index];
    else if (arg.startsWith("--url=")) args.url = arg.slice("--url=".length);
    else if (arg === "--wait-ms") args.waitMs = Number(argv[++index] || args.waitMs);
    else if (arg.startsWith("--wait-ms=")) args.waitMs = Number(arg.slice("--wait-ms=".length));
    else if (arg === "--click-text") args.clickTexts.push(argv[++index]);
    else if (arg.startsWith("--click-text=")) args.clickTexts.push(arg.slice("--click-text=".length));
  }
  return args;
}

function stamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

function safeJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function redactHeaders(headers) {
  const copy = { ...headers };
  for (const key of Object.keys(copy)) {
    if (/authorization|token|cookie|secret/i.test(key)) copy[key] = "[hidden]";
  }
  return copy;
}

function interesting(url) {
  return /order|crm|cms|pay|price|total|list|kk/i.test(url) && !/\.(js|css|png|jpg|jpeg|svg|woff|ico)(\?|$)/i.test(url);
}

async function main() {
  const args = parseArgs(process.argv);
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  const records = [];
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: true,
    viewport: { width: 1440, height: 980 },
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  const page = context.pages()[0] || await context.newPage();

  page.on("request", (request) => {
    const url = request.url();
    if (!interesting(url)) return;
    records.push({
      type: "request",
      method: request.method(),
      url,
      headers: redactHeaders(request.headers()),
      postData: safeJson(request.postData() || ""),
    });
  });

  page.on("response", async (response) => {
    const url = response.url();
    if (!interesting(url)) return;
    const item = {
      type: "response",
      status: response.status(),
      url,
      headers: redactHeaders(response.headers()),
    };
    const contentType = response.headers()["content-type"] || "";
    if (/json|text/i.test(contentType)) {
      try {
        const text = await response.text();
        item.body = safeJson(text.slice(0, 20000));
      } catch (error) {
        item.bodyError = error.message;
      }
    }
    records.push(item);
  });

  await page.goto(args.url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(args.waitMs);
  for (const text of args.clickTexts) {
    records.push({ type: "action", action: "clickText", text });
    await page.locator(`text=${text}`).first().click({ timeout: 10000 });
    await page.waitForTimeout(args.waitMs);
  }
  const visibleText = await page.evaluate(() => document.body?.innerText?.slice(0, 12000) || "");
  const outputPath = path.join(OUTPUT_DIR, `crm-api-discovery-${stamp()}.json`);
  await fs.writeFile(outputPath, JSON.stringify({
    capturedAt: new Date().toISOString(),
    url: args.url,
    title: await page.title(),
    location: page.url(),
    visibleText,
    records,
  }, null, 2), "utf8");
  await context.close();
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
