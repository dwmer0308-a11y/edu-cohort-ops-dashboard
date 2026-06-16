#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const DEFAULT_CONFIG = path.join(ROOT, ".local", "feishu-notify.json");
const DEFAULT_BASE_URL = "http://127.0.0.1:8765";
const DEFAULT_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

function parseArgs(argv) {
  const args = {
    month: new Date().toISOString().slice(0, 7),
    baseUrl: DEFAULT_BASE_URL,
    config: DEFAULT_CONFIG,
    chrome: DEFAULT_CHROME,
    screenshotDir: "/private/tmp",
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--month") args.month = argv[++index];
    else if (arg.startsWith("--month=")) args.month = arg.slice("--month=".length);
    else if (arg === "--base-url") args.baseUrl = argv[++index];
    else if (arg.startsWith("--base-url=")) args.baseUrl = arg.slice("--base-url=".length);
    else if (arg === "--config") args.config = argv[++index];
    else if (arg.startsWith("--config=")) args.config = arg.slice("--config=".length);
    else if (arg === "--chrome") args.chrome = argv[++index];
    else if (arg.startsWith("--chrome=")) args.chrome = arg.slice("--chrome=".length);
    else if (arg === "--screenshot-dir") args.screenshotDir = argv[++index];
    else if (arg.startsWith("--screenshot-dir=")) args.screenshotDir = arg.slice("--screenshot-dir=".length);
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--skip-screenshot") args.skipScreenshot = true;
  }
  return args;
}

function printHelp() {
  console.log(`
Send CRM revenue achievement summary to Feishu

Usage:
  node scripts/send_revenue_summary_feishu.mjs --month 2026-06
  node scripts/send_revenue_summary_feishu.mjs --month 2026-06 --dry-run

Requires:
  1. Local dashboard service is running at http://127.0.0.1:8765.
  2. .local/feishu-notify.json is configured.
`);
}

async function readJson(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return JSON.parse(text);
}

async function writeJson(filePath, payload) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

async function postJson(url, body, headers = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}: ${text}`);
  return payload;
}

async function tenantAccessToken(config) {
  const payload = await postJson("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    app_id: config.app_id,
    app_secret: config.app_secret,
  });
  if (payload.code !== 0) {
    throw new Error(`获取 tenant_access_token 失败：${payload.code} ${payload.msg || ""}`.trim());
  }
  return payload.tenant_access_token;
}

async function sendAppMessage(config, token, msgType, content) {
  const receiveIdType = config.receive_id_type || "email";
  if (!config.receive_id) throw new Error("缺少 receive_id。");
  const payload = await postJson(
    `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${encodeURIComponent(receiveIdType)}`,
    {
      receive_id: config.receive_id,
      msg_type: msgType,
      content: JSON.stringify(content),
    },
    { Authorization: `Bearer ${token}` },
  );
  if (payload.code !== 0) {
    throw new Error(`发送飞书应用消息失败：${payload.code} ${payload.msg || ""}`.trim());
  }
  return payload;
}

async function sendWebhookText(config, text) {
  if (!config.webhook_url) throw new Error("缺少 webhook_url。");
  const payload = await postJson(config.webhook_url, {
    msg_type: "text",
    content: { text },
  });
  if (payload.code && payload.code !== 0) {
    throw new Error(`发送飞书群机器人消息失败：${payload.code} ${payload.msg || ""}`.trim());
  }
  return payload;
}

async function uploadFeishuImage(token, imagePath) {
  const image = await fs.readFile(imagePath);
  const form = new FormData();
  form.append("image_type", "message");
  form.append("image", new Blob([image], { type: "image/png" }), path.basename(imagePath));
  const response = await fetch("https://open.feishu.cn/open-apis/im/v1/images", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }
  if (!response.ok || payload.code !== 0) {
    throw new Error(`上传飞书截图失败：${payload.code ?? response.status} ${payload.msg || text}`.trim());
  }
  return payload.data.image_key;
}

async function fetchOverview(baseUrl, month) {
  const url = new URL("/api/revenue-overview", baseUrl);
  url.searchParams.set("month", month);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`看板接口请求失败：HTTP ${response.status} ${await response.text()}`);
  }
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error);
  return payload;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function stamp() {
  const now = new Date();
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

function fmtNumber(value, digits = 0) {
  const number = Number(value || 0);
  return number.toLocaleString("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function fmtMoney(value) {
  const number = Number(value || 0);
  const digits = Number.isInteger(number) ? 0 : 1;
  return fmtNumber(number, digits);
}

function fmtPct(rate) {
  if (rate === null || rate === undefined || Number.isNaN(Number(rate))) return "暂无目标";
  return `${Math.round(Number(rate) * 100)}%`;
}

function pctPoints(rate) {
  if (rate === null || rate === undefined || Number.isNaN(Number(rate))) return "暂无";
  return `${Math.round(Number(rate) * 100)}pp`;
}

function toDate(date) {
  return new Date(`${date}T00:00:00+08:00`);
}

function dateLabel(date) {
  return date ? date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1年$2月$3日") : "暂无";
}

function latestActualDate(records) {
  return records
    .filter((item) => Number(item.amount || 0) !== 0 || Number(item.rowCount || 0) > 0)
    .map((item) => item.date)
    .sort()
    .at(-1) || "";
}

function sum(records, picker) {
  return records.reduce((total, item) => total + Number(picker(item) || 0), 0);
}

function targetToDate(records, endDate, matcher = () => true) {
  if (!endDate) return 0;
  return sum(records.filter((item) => item.date <= endDate && matcher(item)), (item) => item.targetAmount);
}

function actualToDate(records, endDate, matcher = () => true) {
  if (!endDate) return 0;
  return sum(records.filter((item) => item.date <= endDate && matcher(item)), (item) => item.amount);
}

function statusSentence(rate) {
  if (rate === null || rate === undefined || Number.isNaN(Number(rate))) return "暂无目标口径，建议先确认目标。";
  if (rate >= 1.05) return "当前快于应达节奏。";
  if (rate >= 0.95) return "当前基本贴近应达节奏。";
  if (rate >= 0.8) return "当前略低于应达节奏，需要关注。";
  return "当前明显低于应达节奏，建议负责人优先跟进。";
}

function buildBusinessRows(overview, latestDate) {
  return overview.business.map((row) => {
    const matcher = (item) => item.label === row.label;
    const monthTarget = Number(row.targetAmount || 0);
    const monthActual = Number(row.actualAmount || 0);
    const dueTarget = targetToDate(overview.targetRecords, latestDate, matcher);
    const dueActual = actualToDate(overview.actualRecords, latestDate, matcher);
    const dueRate = dueTarget > 0 ? dueActual / dueTarget : null;
    const monthRate = monthTarget > 0 ? monthActual / monthTarget : null;
    const source = overview.actualSources.find((item) => item.label === row.label) || {};
    return {
      ...row,
      monthTarget,
      monthActual,
      monthRate,
      dueTarget,
      dueActual,
      dueRate,
      rowCount: Number(source.rowCount || 0),
      orderKind: source.orderKind || "",
      crmBusiness: source.crmBusiness || "",
    };
  });
}

function buildSummaryText(overview, actualCache, targetCache) {
  const latestDate = latestActualDate(overview.actualRecords);
  const monthTarget = Number(overview.summary.targetAmount || 0);
  const monthActual = Number(overview.summary.actualAmount || 0);
  const dueTarget = targetToDate(overview.targetRecords, latestDate);
  const dueActual = actualToDate(overview.actualRecords, latestDate);
  const monthRate = monthTarget > 0 ? monthActual / monthTarget : null;
  const dueRate = dueTarget > 0 ? dueActual / dueTarget : null;
  const businessRows = buildBusinessRows(overview, latestDate);
  const sourceRange = actualCache.range || {};
  const sourceText = [
    `CRM缓存：${actualCache.syncedAt || "未知"}`,
    sourceRange.start && sourceRange.end ? `范围：${sourceRange.start} 至 ${sourceRange.end}` : "",
    sourceRange.sourceField ? `口径：${sourceRange.sourceField}` : "",
    targetCache.syncedAt ? `目标：${targetCache.syncedAt}` : "",
  ].filter(Boolean).join("；");

  const lines = [
    `【${overview.month} 营收达成测试汇报】`,
    `数据口径：${sourceText}`,
    ``,
    `整体：当前累计 ${fmtMoney(monthActual)} / 月目标 ${fmtMoney(monthTarget)}，月度达成 ${fmtPct(monthRate)}。`,
    latestDate
      ? `截至 ${dateLabel(latestDate)} 应达目标 ${fmtMoney(dueTarget)}，当前 ${fmtMoney(dueActual)}，节奏达成 ${fmtPct(dueRate)}，差额 ${fmtMoney(dueActual - dueTarget)}。${statusSentence(dueRate)}`
      : `当前没有识别到本月 CRM 实际数据。`,
    ``,
    `分业务给负责人看的重点：`,
    ...businessRows.map((item) => {
      const diff = item.dueActual - item.dueTarget;
      return `- ${item.label}：累计 ${fmtMoney(item.monthActual)} / 月目标 ${fmtMoney(item.monthTarget)}，月度达成 ${fmtPct(item.monthRate)}；截至${latestDate ? dateLabel(latestDate) : "当前"}节奏 ${fmtPct(item.dueRate)}，差额 ${fmtMoney(diff)}，CRM记录 ${fmtNumber(item.rowCount)} 条。${statusSentence(item.dueRate)}`;
    }),
    ``,
    `建议动作：`,
    ...businessRows
      .filter((item) => item.dueRate === null || item.dueRate < 0.95)
      .map((item) => `- ${item.label}：请负责人核对今日有效订单、退款/异常单和接下来 3 天补量计划。`),
  ];

  if (lines.at(-1) === `建议动作：`) {
    lines.push(`- 当前整体没有低于 95% 应达节奏的业务，建议继续按日追踪。`);
  }
  lines.push(``, `截图：随后发送总览页截图。`);

  return {
    text: lines.join("\n"),
    latestDate,
    monthTarget,
    monthActual,
    monthRate,
    dueTarget,
    dueActual,
    dueRate,
    businessRows,
  };
}

async function captureScreenshot(args, outputPath) {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await execFileAsync(args.chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=1440,1100",
    `--screenshot=${outputPath}`,
    args.baseUrl,
  ], { timeout: 30000 });
  return outputPath;
}

async function saveReport(month, text, screenshotPath, summary) {
  const reportPath = path.join(ROOT, "exports", `revenue-summary-${month}-${stamp()}.md`);
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, [
    text,
    ``,
    `---`,
    `本地截图：${screenshotPath || "未生成"}`,
    `结构化摘要：`,
    `\`\`\`json`,
    JSON.stringify(summary, null, 2),
    `\`\`\``,
  ].join("\n"), "utf8");
  return reportPath;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }

  const [overview, actualCache, targetCache] = await Promise.all([
    fetchOverview(args.baseUrl, args.month),
    readJson(path.join(ROOT, "data", "revenue-actuals.json")),
    readJson(path.join(ROOT, "data", "revenue-targets.json")),
  ]);
  const summary = buildSummaryText(overview, actualCache, targetCache);

  const screenshotPath = args.skipScreenshot
    ? ""
    : path.join(args.screenshotDir, `revenue-overview-${args.month}-${stamp()}.png`);
  if (screenshotPath) await captureScreenshot(args, screenshotPath);

  const reportPath = await saveReport(args.month, summary.text, screenshotPath, summary);

  if (!args.dryRun) {
    const config = await readJson(args.config);
    if ((config.mode || "app") === "webhook") {
      await sendWebhookText(config, summary.text);
      if (screenshotPath) {
        console.warn("当前是 webhook 模式，只发送了文字；如需发送图片，请使用飞书自建应用配置。");
      }
    } else {
      const token = await tenantAccessToken(config);
      await sendAppMessage(config, token, "text", { text: summary.text });
      if (screenshotPath) {
        const imageKey = await uploadFeishuImage(token, screenshotPath);
        await sendAppMessage(config, token, "image", { image_key: imageKey });
      }
    }
  }

  await writeJson(path.join(ROOT, "data", "integration-checks", "reports", `revenue-summary-${args.month}-latest.json`), {
    generatedAt: new Date().toISOString(),
    month: args.month,
    dryRun: Boolean(args.dryRun),
    baseUrl: args.baseUrl,
    reportPath,
    screenshotPath,
    summary,
  });

  console.log(JSON.stringify({
    ok: true,
    dryRun: Boolean(args.dryRun),
    month: args.month,
    reportPath,
    screenshotPath,
    sentToFeishu: !args.dryRun,
    latestDate: summary.latestDate,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
