#!/usr/bin/env node
import { chromium } from "playwright";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const execFileAsync = promisify(execFile);
const ROOT = path.resolve(path.dirname(__filename), "..");
const LOCAL_DIR = path.join(ROOT, ".local");
const PROFILE_DIR = path.join(LOCAL_DIR, "crm-browser-profile");
const STORAGE_STATE = path.join(LOCAL_DIR, "crm-storage-state.json");
const CRM_URL = "https://kkhc-admin.likeduoduiyi.cn/#/order";
const CHECK_URL = "https://kapi.likeduoduiyi.cn/kk/cms/per/emp";

function parseArgs(argv) {
  const args = {
    timeoutMs: 10 * 60 * 1000,
    autoKeychain: false,
    headless: false,
    service: "crm-dashboard",
    account: "zhangliang0102",
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--timeout-ms") args.timeoutMs = Number(argv[++index] || args.timeoutMs);
    else if (arg.startsWith("--timeout-ms=")) args.timeoutMs = Number(arg.slice("--timeout-ms=".length));
    else if (arg === "--auto-keychain") args.autoKeychain = true;
    else if (arg === "--headless") args.headless = true;
    else if (arg === "--service") args.service = argv[++index] || args.service;
    else if (arg.startsWith("--service=")) args.service = arg.slice("--service=".length);
    else if (arg === "--account") args.account = argv[++index] || args.account;
    else if (arg.startsWith("--account=")) args.account = arg.slice("--account=".length);
  }
  return args;
}

async function readKeychainPassword(args) {
  const { stdout } = await execFileAsync(
    "security",
    ["find-generic-password", "-s", args.service, "-a", args.account, "-w"],
    { timeout: 15000, maxBuffer: 1024 * 1024 },
  );
  const password = stdout.trim();
  if (!password) {
    throw new Error(`钥匙串里没有找到 ${args.service} / ${args.account} 的密码`);
  }
  return password;
}

async function checkLoggedIn(page) {
  const adminInfo = await page.evaluate(() => {
    try {
      return JSON.parse(localStorage.getItem("admin_info") || "{}");
    } catch {
      return {};
    }
  });
  if (!adminInfo.token) return { ok: false, status: "", message: "等待 CRM 写入登录 token" };
  const response = await fetch(CHECK_URL, {
    headers: {
      accept: "application/json, text/plain, */*",
      referer: "https://kkhc-admin.likeduoduiyi.cn/",
      token: adminInfo.token,
    },
  });
  const payload = await response.json().catch(() => ({}));
  return {
    ok: payload?.status !== 2000 && !String(payload?.message || "").includes("重新登录"),
    status: payload?.status,
    message: payload?.message || "",
  };
}

async function firstVisible(page, selectors) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    try {
      if (await locator.isVisible({ timeout: 1500 })) return locator;
    } catch {
      // Try the next selector.
    }
  }
  return null;
}

async function clickLogin(page) {
  const candidates = [
    page.getByRole("button", { name: /登\s*录|登录/ }).first(),
    page.locator("button[type='submit']").first(),
    page.locator(".login button, .login-form button, form button").first(),
    page.locator("button").filter({ hasText: /登\s*录|登录/ }).first(),
  ];
  for (const locator of candidates) {
    try {
      if (await locator.isVisible({ timeout: 1500 })) {
        await locator.click();
        return true;
      }
    } catch {
      // Try the next button shape.
    }
  }
  return false;
}

async function autoLoginFromKeychain(page, args) {
  const password = await readKeychainPassword(args);
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  await page.waitForSelector("input", { timeout: 15000 }).catch(() => {});
  const usernameInput = await firstVisible(page, [
    "input[placeholder*='账号']",
    "input[placeholder*='用户名']",
    "input[placeholder*='手机']",
    "input[name*='user' i]",
    "input[name*='account' i]",
    "input[type='text']",
    "input:not([type='password'])",
  ]);
  const passwordInput = await firstVisible(page, [
    "input[placeholder*='密码']",
    "input[name*='pass' i]",
    "input[type='password']",
  ]);
  if (!usernameInput || !passwordInput) {
    throw new Error("未找到 CRM 登录输入框，可能页面结构或登录地址发生变化");
  }
  await usernameInput.fill(args.account);
  await passwordInput.fill(password);
  if (!(await clickLogin(page))) {
    throw new Error("未找到 CRM 登录按钮，可能页面结构发生变化");
  }
}

async function main() {
  const args = parseArgs(process.argv);
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: args.headless,
    viewport: { width: 1440, height: 980 },
    executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  });
  try {
    const page = context.pages()[0] || await context.newPage();
    await page.goto(CRM_URL, { waitUntil: "domcontentloaded", timeout: 60000 });
    let last = null;
    try {
      last = await checkLoggedIn(page);
      if (last.ok) {
        await context.storageState({ path: STORAGE_STATE });
        console.log(JSON.stringify({ ok: true, message: "CRM 登录态仍有效", storageState: STORAGE_STATE }, null, 2));
        return;
      }
    } catch {
      // Continue to refresh the login state.
    }
    if (args.autoKeychain) {
      console.log(`CRM 登录态失效，正在使用钥匙串 ${args.service} / ${args.account} 刷新登录。`);
      await autoLoginFromKeychain(page, args);
    } else {
      console.log("CRM 登录窗口已打开。请在浏览器里完成登录，我会自动检测登录状态。");
    }
    const deadline = Date.now() + args.timeoutMs;
    while (Date.now() < deadline) {
      await page.waitForTimeout(3000);
      try {
        last = await checkLoggedIn(page);
        if (last.ok) {
          await context.storageState({ path: STORAGE_STATE });
          console.log(JSON.stringify({ ok: true, message: "CRM 登录态已刷新", storageState: STORAGE_STATE }, null, 2));
          return;
        }
        console.log(`等待登录中：${last.message || last.status || "未登录"}`);
      } catch (error) {
        console.log(`等待登录中：${error.message || error}`);
      }
    }
    throw new Error(`CRM 登录态刷新超时。最后状态：${JSON.stringify(last)}`);
  } finally {
    await context.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
