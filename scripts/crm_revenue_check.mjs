#!/usr/bin/env node
import { chromium } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const LOCAL_DIR = path.join(ROOT, ".local");
const PROFILE_DIR = path.join(LOCAL_DIR, "crm-browser-profile");
const CHECK_DIR = path.join(ROOT, "data", "integration-checks");
const RAW_DIR = path.join(CHECK_DIR, "raw");
const NORMALIZED_DIR = path.join(CHECK_DIR, "normalized");
const REPORT_DIR = path.join(CHECK_DIR, "reports");

const FIELD_ALIASES = {
  date: ["支付时间", "付款时间", "收款时间", "成交时间", "日期", "时间", "下单时间", "创建时间", "date", "time"],
  campaign: ["营期", "项目", "课程", "商品", "产品", "订单名称", "班级", "活动", "campaign", "project", "product"],
  orderId: ["订单号", "订单id", "订单ID", "编号", "流水号", "交易号", "id", "order"],
  customerOrOrderId: ["客户", "客户姓名", "学员", "用户", "手机号", "订单号", "订单ID", "交易号"],
  amount: ["实付金额", "支付金额", "收款金额", "成交金额", "实付", "金额", "订单金额", "营收", "GMV", "收入", "amount", "revenue"],
  revenueStatus: ["状态", "订单状态", "支付状态", "收款状态", "成交状态", "status"],
};

function parseArgs(argv) {
  const args = { sampleSize: 10, month: new Date().toISOString().slice(0, 7) };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--url") args.url = argv[++index];
    else if (arg.startsWith("--url=")) args.url = arg.slice("--url=".length);
    else if (arg === "--month") args.month = argv[++index];
    else if (arg.startsWith("--month=")) args.month = arg.slice("--month=".length);
    else if (arg === "--sample-size") args.sampleSize = Number(argv[++index] || 10);
    else if (arg.startsWith("--sample-size=")) args.sampleSize = Number(arg.slice("--sample-size=".length));
    else if (arg === "--capture-now") args.captureNow = true;
    else if (arg === "--wait-ms") args.waitMs = Number(argv[++index] || 5000);
    else if (arg.startsWith("--wait-ms=")) args.waitMs = Number(arg.slice("--wait-ms=".length));
    else if (arg === "--order-kind") args.orderKind = argv[++index];
    else if (arg.startsWith("--order-kind=")) args.orderKind = arg.slice("--order-kind=".length);
    else if (arg === "--business") args.business = argv[++index];
    else if (arg.startsWith("--business=")) args.business = arg.slice("--business=".length);
  }
  return args;
}

function printHelp() {
  console.log(`
CRM revenue capture checker

Usage:
  node scripts/crm_revenue_check.mjs --url CRM_LOGIN_URL --month 2026-06
  node scripts/crm_revenue_check.mjs --url CRM_ORDER_URL --month 2026-06 --capture-now
  node scripts/crm_revenue_check.mjs --url CRM_ORDER_URL --month 2026-06 --capture-now --order-kind 销转订单 --business 书法

What happens:
  1. Opens a visible browser.
  2. You log in manually. Do not type your password in this chat.
  3. Navigate to the CRM revenue/order/payment page.
  4. Press Enter in this terminal.
  5. The script saves samples and a manual check report under data/integration-checks/.

Use --capture-now after login if the browser profile already has a valid CRM session.
`);
}

async function ensureDirs() {
  await fs.mkdir(LOCAL_DIR, { recursive: true });
  await fs.mkdir(PROFILE_DIR, { recursive: true });
  await fs.mkdir(RAW_DIR, { recursive: true });
  await fs.mkdir(NORMALIZED_DIR, { recursive: true });
  await fs.mkdir(REPORT_DIR, { recursive: true });
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

function redact(text) {
  return String(text ?? "")
    .replace(/1[3-9]\d{9}/g, "[手机号]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[邮箱]")
    .replace(/(token|password|secret|session|cookie|authorization)\s*[:=]\s*['"]?[^'",\s]+/gi, "$1=[已隐藏]");
}

function normalizeHeader(value) {
  return String(value ?? "").replace(/\s+/g, "").trim();
}

function matchField(header, field) {
  const normalized = normalizeHeader(header).toLowerCase();
  return FIELD_ALIASES[field].some((alias) => normalized.includes(normalizeHeader(alias).toLowerCase()));
}

function firstMatchingValue(row, field) {
  for (const alias of FIELD_ALIASES[field]) {
    const normalizedAlias = normalizeHeader(alias).toLowerCase();
    for (const [header, value] of Object.entries(row)) {
      const normalizedHeader = normalizeHeader(header).toLowerCase();
      if (normalizedHeader.includes(normalizedAlias) && String(value ?? "").trim() !== "") return value;
    }
  }
  return "";
}

function parseAmount(value) {
  const text = String(value ?? "").replace(/,/g, "").replace(/¥|￥|元|\s/g, "");
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function parseDate(value) {
  const text = String(value ?? "").trim();
  let match = text.match(/(20\d{2})[-/.年](\d{1,2})[-/.月](\d{1,2})/);
  if (match) return `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}`;
  match = text.match(/(\d{1,2})[-/.月](\d{1,2})(?:日)?/);
  if (match) {
    const year = new Date().getFullYear();
    return `${year}-${match[1].padStart(2, "0")}-${match[2].padStart(2, "0")}`;
  }
  return "";
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function toCsv(rows) {
  const headers = ["source", "date", "campaign", "customerOrOrderId", "orderId", "amount", "revenueStatus", "rawRef"];
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
}

function hasRevenueHeaders(headers) {
  const text = headers.map(normalizeHeader).join("|");
  return /(订单号|付款单号)/.test(text) && /支付时间/.test(text) && /实付金额/.test(text);
}

function looksLikeDataValues(values) {
  const text = values.join("|");
  return /k20\d{6,}|kc20\d{6,}|20\d{2}-\d{2}-\d{2}/.test(text);
}

function rowFromValues(headers, values) {
  return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
}

function valueList(row, headers) {
  return headers.map((header) => row[header] ?? "");
}

function preparedTables(tables) {
  const result = [];
  let carryHeaders = null;
  for (const table of tables) {
    if (hasRevenueHeaders(table.headers) && table.rowCount === 0) {
      carryHeaders = table.headers;
      result.push(table);
      continue;
    }
    if (carryHeaders && table.headers.length === carryHeaders.length && !hasRevenueHeaders(table.headers) && looksLikeDataValues(table.headers)) {
      const rows = [
        rowFromValues(carryHeaders, table.headers),
        ...table.rows.map((row) => rowFromValues(carryHeaders, valueList(row, table.headers))),
      ];
      result.push({
        ...table,
        headers: carryHeaders,
        rows,
        rowCount: rows.length,
        pairedHeaderTable: true,
      });
      carryHeaders = null;
      continue;
    }
    result.push(table);
  }
  return result;
}

function normalizeRows(tables, sampleSize) {
  const normalized = [];
  const issues = [];
  for (const table of preparedTables(tables)) {
    for (let index = 0; index < table.rows.length; index += 1) {
      const row = table.rows[index];
      if (Object.values(row).some((value) => String(value || "").includes("暂无数据"))) continue;
      const date = parseDate(firstMatchingValue(row, "date"));
      const amount = parseAmount(firstMatchingValue(row, "amount"));
      const candidate = {
        source: "crm",
        date,
        campaign: String(firstMatchingValue(row, "campaign") || "").trim(),
        customerOrOrderId: String(firstMatchingValue(row, "customerOrOrderId") || "").trim(),
        orderId: String(firstMatchingValue(row, "orderId") || "").trim(),
        amount,
        revenueStatus: String(firstMatchingValue(row, "revenueStatus") || "").trim(),
        rawRef: `table_${table.index}_row_${index + 1}`,
      };
      if (!date || amount === null) {
        issues.push({
          rawRef: candidate.rawRef,
          reason: [!date ? "未识别日期" : "", amount === null ? "未识别金额" : ""].filter(Boolean).join("、"),
          headers: Object.keys(row),
        });
        continue;
      }
      normalized.push(candidate);
      if (normalized.length >= sampleSize) return { normalized, issues };
    }
  }
  return { normalized, issues };
}

async function clickText(page, text, selector = "*") {
  const locator = page.locator(selector).filter({ hasText: text }).first();
  await locator.waitFor({ state: "visible", timeout: 10000 });
  await locator.click();
}

async function chooseBusiness(page, business) {
  await page.evaluate(() => {
    const norm = (value) => String(value || "").replace(/\s+/g, " ").trim();
    const items = [...document.querySelectorAll(".el-form-item")];
    const businessItem = items.find((item) => norm(item.innerText).startsWith("业务:"));
    const select = businessItem?.querySelector(".el-select, .el-select__tags, .el-input, input");
    if (!select) throw new Error("没有找到业务筛选下拉框。");
    select.click();
  });
  await page.waitForTimeout(500);
  const option = page.locator(".el-select-dropdown__item").filter({ hasText: business }).last();
  await option.waitFor({ state: "visible", timeout: 10000 });
  await option.click();
}

async function applyCrmFilters(page, args) {
  const applied = {};
  if (args.orderKind) {
    await clickText(page, args.orderKind, '[role="tab"], .el-tabs__item');
    applied.orderKind = args.orderKind;
    await page.waitForTimeout(1200);
  }
  if (args.business) {
    await chooseBusiness(page, args.business);
    applied.business = args.business;
    await page.waitForTimeout(500);
  }
  if (args.orderKind || args.business) {
    await clickText(page, "查询", "button");
    await page.waitForTimeout(Number.isFinite(args.waitMs) ? args.waitMs : 5000);
  }
  return applied;
}

async function extractPageData(page) {
  return page.evaluate(() => {
    const visibleText = document.body?.innerText || "";
    const isVisible = (element) => {
      let current = element;
      while (current && current !== document.body) {
        const style = window.getComputedStyle(current);
        if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0) return false;
        if (current.getAttribute("aria-hidden") === "true") return false;
        current = current.parentElement;
      }
      return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
    };
    const tables = [...document.querySelectorAll("table")].filter(isVisible).map((table, tableIndex) => {
      const rows = [...table.querySelectorAll("tr")].map((tr) => [...tr.querySelectorAll("th,td")].map((cell) => cell.innerText.trim()));
      const headerRow = rows.find((row) => row.length && row.some(Boolean)) || [];
      const dataRows = rows.slice(rows.indexOf(headerRow) + 1).filter((row) => row.some(Boolean));
      const headers = headerRow.map((header, index) => header || `列${index + 1}`);
      return {
        index: tableIndex + 1,
        headers,
        rows: dataRows.slice(0, 50).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] || ""]))),
        rowCount: Math.max(0, dataRows.length),
      };
    });
    return {
      title: document.title,
      url: location.href,
      visibleText: visibleText.slice(0, 12000),
      tables,
    };
  });
}

async function writeOutputs(args, pageData) {
  const slug = [args.month, args.orderKind, args.business].filter(Boolean).join("-").replace(/[^\p{L}\p{N}-]+/gu, "");
  const runId = `${slug || args.month}-${stamp()}`;
  const rawPage = {
    capturedAt: new Date().toISOString(),
    month: args.month,
    orderKind: args.orderKind || "",
    business: args.business || "",
    title: pageData.title,
    url: pageData.url,
    tableCount: pageData.tables.length,
    tables: pageData.tables.map((table) => ({
      ...table,
      rows: table.rows.slice(0, args.sampleSize),
    })),
  };
  const { normalized, issues } = normalizeRows(pageData.tables, args.sampleSize);
  const rawBase = path.join(RAW_DIR, `crm-${runId}`);
  const normalizedJsonPath = path.join(NORMALIZED_DIR, `crm-${runId}.json`);
  const normalizedCsvPath = path.join(NORMALIZED_DIR, `crm-${runId}.csv`);
  const reportPath = path.join(REPORT_DIR, `crm-${runId}.md`);

  await fs.writeFile(`${rawBase}-page.json`, JSON.stringify(rawPage, null, 2), "utf8");
  await fs.writeFile(`${rawBase}-visible-text.txt`, redact(pageData.visibleText), "utf8");
  await fs.writeFile(normalizedJsonPath, JSON.stringify(normalized, null, 2), "utf8");
  await fs.writeFile(normalizedCsvPath, toCsv(normalized), "utf8");

  const report = [
    `# CRM营收抓取人工抽样报告`,
    ``,
    `- 抓取时间：${new Date().toLocaleString("zh-CN", { hour12: false })}`,
    `- 校验月份：${args.month}`,
    `- 订单类型：${args.orderKind || "当前页面默认"}`,
    `- 业务筛选：${args.business || "当前页面默认"}`,
    `- 页面标题：${pageData.title || "未识别"}`,
    `- 页面地址：${pageData.url}`,
    `- 识别表格数：${pageData.tables.length}`,
    `- 标准化样例数：${normalized.length}`,
    `- 需人工处理问题数：${issues.length}`,
    ``,
    `## 你需要核对的样例`,
    ``,
    normalized.length
      ? normalized.map((row, index) => `${index + 1}. ${row.date} | ${row.campaign || "-"} | ${row.customerOrOrderId || row.orderId || "-"} | ${row.amount} | ${row.revenueStatus || "-"}`).join("\n")
      : `没有从页面表格中识别出同时包含日期和金额的营收行。请确认你已经进入 CRM 的营收/订单/回款明细页。`,
    ``,
    `## 自动识别到的表格`,
    ``,
    pageData.tables.length
      ? pageData.tables.map((table) => `- 表格 ${table.index}：${table.rowCount} 行；表头：${table.headers.join("、") || "未识别"}`).join("\n")
      : `- 未识别到 HTML 表格。页面可能使用虚拟列表或画布渲染，需要下一步改用网络接口抓取。`,
    ``,
    `## 需要人工注意的问题`,
    ``,
    issues.length
      ? issues.slice(0, 20).map((issue) => `- ${issue.rawRef}：${issue.reason}；表头：${issue.headers.join("、")}`).join("\n")
      : `- 暂无。`,
    ``,
    `## 产物路径`,
    ``,
    `- 原始页面样例：${rawBase}-page.json`,
    `- 页面可见文本样例：${rawBase}-visible-text.txt`,
    `- 标准化 JSON：${normalizedJsonPath}`,
    `- 标准化 CSV：${normalizedCsvPath}`,
  ].join("\n");
  await fs.writeFile(reportPath, report, "utf8");
  return { reportPath, normalizedJsonPath, normalizedCsvPath, rawPagePath: `${rawBase}-page.json`, count: normalized.length, issues: issues.length };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }
  if (!args.url) {
    console.error("请提供 CRM 登录网址：node scripts/crm_revenue_check.mjs --url CRM登录网址");
    process.exitCode = 1;
    return;
  }
  await ensureDirs();
  const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const launchOptions = {
    headless: false,
    viewport: { width: 1440, height: 980 },
    acceptDownloads: true,
  };
  try {
    await fs.access(chromePath);
    launchOptions.executablePath = chromePath;
  } catch {
    // Fall back to the Playwright-managed browser when system Chrome is not available.
  }
  const context = await chromium.launchPersistentContext(PROFILE_DIR, launchOptions);
  const page = context.pages()[0] || await context.newPage();
  console.log("\n我会打开 CRM。请在浏览器里手动登录，不要把密码发到聊天里。");
  await page.goto(args.url, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.waitForTimeout(3000);
  await applyCrmFilters(page, args);

  let rl = null;
  if (args.captureNow) {
    const waitMs = Number.isFinite(args.waitMs) ? args.waitMs : 5000;
    console.log(`\n检测到 --capture-now，将等待 ${waitMs}ms 后直接抓取当前页面样例。`);
    await page.waitForTimeout(waitMs);
  } else {
    rl = readline.createInterface({ input, output });
    await rl.question("\n登录成功后，请进入 CRM 的营收/订单/回款明细页，然后回到这里按 Enter 继续抓取样例...");
  }
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  const pageData = await extractPageData(page);
  const result = await writeOutputs(args, pageData);
  await context.storageState({ path: path.join(LOCAL_DIR, "crm-storage-state.json") });
  await context.close();
  if (rl) rl.close();

  console.log("\n抓取校验样例已生成：");
  console.log(`- 报告：${result.reportPath}`);
  console.log(`- 标准化 JSON：${result.normalizedJsonPath}`);
  console.log(`- 标准化 CSV：${result.normalizedCsvPath}`);
  console.log(`- 样例记录数：${result.count}`);
  console.log(`- 问题记录数：${result.issues}`);
}

main().catch((error) => {
  console.error(`CRM抓取校验失败：${error.stack || error.message}`);
  process.exitCode = 1;
});
