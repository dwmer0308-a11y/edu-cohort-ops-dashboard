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
const SCOPES = {
  overall: { label: "整体目标", title: "经营进度日报", color: "#2563eb", accent: "#10b981" },
  calligraphy_front: { label: "书法前端", title: "经营进度日报 - 书法前端", color: "#2563eb", accent: "#ef4444" },
  calligraphy_backend: { label: "书法后端", title: "经营进度日报 - 书法后端", color: "#16a34a", accent: "#ef4444" },
  recitation_backend: { label: "朗诵后端", title: "经营进度日报 - 朗诵后端", color: "#7c3aed", accent: "#ef4444" },
};

function parseArgs(argv) {
  const args = {
    month: new Date().toISOString().slice(0, 7),
    scope: "overall",
    targetId: "",
    baseUrl: DEFAULT_BASE_URL,
    config: DEFAULT_CONFIG,
    chrome: DEFAULT_CHROME,
    outputDir: "/private/tmp",
    dryRun: false,
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--month") args.month = argv[++index];
    else if (arg.startsWith("--month=")) args.month = arg.slice("--month=".length);
    else if (arg === "--scope") args.scope = argv[++index];
    else if (arg.startsWith("--scope=")) args.scope = arg.slice("--scope=".length);
    else if (arg === "--target-id") args.targetId = argv[++index];
    else if (arg.startsWith("--target-id=")) args.targetId = arg.slice("--target-id=".length);
    else if (arg === "--base-url") args.baseUrl = argv[++index];
    else if (arg.startsWith("--base-url=")) args.baseUrl = arg.slice("--base-url=".length);
    else if (arg === "--config") args.config = argv[++index];
    else if (arg.startsWith("--config=")) args.config = arg.slice("--config=".length);
    else if (arg === "--chrome") args.chrome = argv[++index];
    else if (arg.startsWith("--chrome=")) args.chrome = arg.slice("--chrome=".length);
    else if (arg === "--output-dir") args.outputDir = argv[++index];
    else if (arg.startsWith("--output-dir=")) args.outputDir = arg.slice("--output-dir=".length);
    else if (arg === "--dry-run") args.dryRun = true;
  }
  return args;
}

function printHelp() {
  console.log(`
Send overview revenue card image to Feishu

Usage:
  node scripts/send_revenue_overview_card.mjs --month 2026-06 --scope overall
  node scripts/send_revenue_overview_card.mjs --month 2026-06 --scope calligraphy_front --target-id overall
`);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
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
  const receiveIdType = config.receive_id_type || "chat_id";
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
    throw new Error(`上传飞书日报图片失败：${payload.code ?? response.status} ${payload.msg || text}`.trim());
  }
  return payload.data.image_key;
}

async function fetchOverview(baseUrl, month) {
  const url = new URL("/api/revenue-overview", baseUrl);
  url.searchParams.set("month", month);
  const response = await fetch(url);
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }
  if (!response.ok || payload.error) {
    throw new Error(payload.error || `看板接口请求失败：HTTP ${response.status} ${text}`);
  }
  return payload;
}

function normalizeTargets(config) {
  if (Array.isArray(config.targets) && config.targets.length) {
    return config.targets
      .filter((item) => item && item.id && item.receive_id)
      .map((item) => ({
        ...config,
        ...item,
        label: item.label || item.id,
        receive_id_type: item.receive_id_type || config.receive_id_type || "chat_id",
      }));
  }
  if (config.receive_id) {
    return [{
      ...config,
      id: "default",
      label: config.label || "默认接收群",
      receive_id_type: config.receive_id_type || "chat_id",
    }];
  }
  return [];
}

function pickTarget(config, targetId) {
  const targets = normalizeTargets(config);
  if (!targets.length) throw new Error("飞书配置缺少 receive_id 或 targets。");
  const target = targetId ? targets.find((item) => item.id === targetId) : targets[0];
  if (!target) throw new Error(`没有找到飞书接收群：${targetId}`);
  return target;
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
  return fmtNumber(Math.round(Number(value || 0)), 0);
}

function fmtPct(rate) {
  if (rate === null || rate === undefined || Number.isNaN(Number(rate))) return "暂无";
  return `${Math.round(Number(rate) * 100)}%`;
}

function fmtSignedPct(rate) {
  if (rate === null || rate === undefined || Number.isNaN(Number(rate))) return "暂无";
  const value = Math.round(Number(rate) * 100);
  return `${value > 0 ? "+" : ""}${value}%`;
}

function fmtSignedMoney(value) {
  const number = Number(value || 0);
  return `${number > 0 ? "+" : ""}${fmtMoney(number)}`;
}

function formatCardClock(value) {
  if (!value) return "未知";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "未知";
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date).replace(/\//g, "-");
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
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

function targetToDate(records, endDate, label = "") {
  return sum(records.filter((item) => (!label || item.label === label) && (!endDate || item.date <= endDate)), (item) => item.targetAmount);
}

function actualToDate(records, endDate, label = "") {
  return sum(records.filter((item) => (!label || item.label === label) && (!endDate || item.date <= endDate)), (item) => item.amount);
}

function targetForDate(records, day, label = "") {
  return sum(records.filter((item) => item.date === day && (!label || item.label === label)), (item) => item.targetAmount);
}

function actualForDate(records, day, label = "") {
  return sum(records.filter((item) => item.date === day && (!label || item.label === label)), (item) => item.amount);
}

function weekdayLabel(day) {
  const parsed = new Date(`${day}T00:00:00+08:00`);
  return ["周日", "周一", "周二", "周三", "周四", "周五", "周六"][parsed.getDay()];
}

function shortDayLabel(day) {
  return `${Number(String(day).slice(-2))}日${weekdayLabel(day)}`;
}

function statusSentence(rate, timeRate) {
  if (rate === null || rate === undefined || Number.isNaN(Number(rate))) return "暂无目标口径";
  if (rate >= timeRate) return "快于时间进度";
  if (rate >= timeRate - 0.08) return "略慢于时间进度";
  return "落后时间进度";
}

function rateTone(rate, baseline = 1) {
  if (rate === null || rate === undefined || Number.isNaN(Number(rate))) return "neutral";
  if (rate >= baseline) return "good";
  if (rate >= baseline - 0.08) return "warn";
  return "bad";
}

function monthDays(month) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(year, monthIndex, 0).getDate();
}

function buildBusinessRows(overview, latestDate) {
  return (overview.business || []).map((row) => {
    const monthTarget = Number(row.targetAmount || 0);
    const monthActual = Number(row.actualAmount || 0);
    const phaseTarget = targetToDate(overview.targetRecords || [], latestDate, row.label);
    const phaseActual = actualToDate(overview.actualRecords || [], latestDate, row.label);
    return {
      ...row,
      monthTarget,
      monthActual,
      monthRate: monthTarget ? monthActual / monthTarget : null,
      phaseTarget,
      phaseActual,
      phaseRate: phaseTarget ? phaseActual / phaseTarget : null,
      phaseGap: phaseActual - phaseTarget,
    };
  });
}

function progressBar(rate, tone = "bad") {
  const safeRate = Number(rate || 0);
  const width = Math.max(3, Math.min(100, Math.round(safeRate * 100)));
  return `<div class="progress ${tone}"><i style="width:${width}%"></i></div>`;
}

function demoMetricCard(label, actual, target) {
  const rate = target ? actual / target : null;
  const pct = Math.min(100, Math.round((rate || 0) * 100));
  const tone = rate >= 1 ? "#16a34a" : "#dc2626";
  return `
    <div class="demo-metric">
      <span>${escapeHtml(label)}</span>
      <strong style="color:${tone}">${fmtPct(rate)}</strong>
      <div class="demo-amount">${fmtMoney(actual)}</div>
      <div class="demo-bar"><i style="width:${pct}%;background:${tone}"></i></div>
      <small>目标 ${fmtMoney(target)} · ${rate >= 1 ? "已达标" : "未达标"}</small>
    </div>
  `;
}

function demoAnalysisList(overview) {
  return (overview.business || [])
    .slice()
    .sort((a, b) => Number(a.achievementRate || 0) - Number(b.achievementRate || 0))
    .map((row, index) => {
      const gap = Math.abs(Number(row.diffAmount || 0));
      return `<li><b>${index + 1}. ${escapeHtml(row.label)}</b>｜月度达成 ${fmtPct(row.achievementRate)}｜距月目标 ${fmtMoney(gap)} 元</li>`;
    })
    .join("");
}

function clampPercent(rate, max = 100) {
  if (rate === null || rate === undefined || Number.isNaN(Number(rate))) return 0;
  return Math.max(0, Math.min(max, Math.round(Number(rate) * 100)));
}

function reportEndDate(overview) {
  return overview.actualRange?.end || latestActualDate(overview.actualRecords || []) || `${overview.month}-01`;
}

function todayModel(overview, label, day) {
  const target = targetForDate(overview.targetRecords || [], day, label);
  const actual = actualForDate(overview.actualRecords || [], day, label);
  const rate = target ? actual / target : null;
  return { label, target, actual, rate, gap: actual - target };
}

function todayTone(item) {
  if (!item.target) return item.actual > 0 ? "good" : "neutral";
  return item.actual >= item.target ? "good" : "bad";
}

function todayStatusText(item) {
  if (!item.target) return "无今日目标";
  return item.actual >= item.target ? "超出今日目标" : "落后今日目标";
}

function todayAnalysisText(item, day) {
  const label = shortDayLabel(day);
  if (!item.target && item.actual > 0) return `分析：${label}未拆目标但已有实际收入。`;
  if (!item.target) return `分析：${label}未拆今日目标，暂无有效目标口径。`;
  return `分析：${label}${item.actual >= item.target ? "已达标" : "未达标"}，差额 ${fmtSignedMoney(item.gap)} 元。`;
}

function todayCard(item, day) {
  const tone = todayTone(item);
  const rateText = item.target ? fmtPct(item.rate) : "无目标";
  const gapRate = item.target ? fmtSignedPct(item.gap / item.target) : "无目标";
  const width = item.target ? clampPercent(item.rate, 100) : (item.actual > 0 ? 100 : 0);
  return `
    <article class="today-card ${tone}">
      <div class="today-title">${escapeHtml(item.label)}</div>
      <div class="today-values">
        <strong>${fmtMoney(item.actual)}</strong>
        <span>${rateText}</span>
        <strong>${fmtMoney(item.target)}</strong>
      </div>
      <div class="today-track"><i style="width:${width}%"></i></div>
      <p class="today-status">${todayStatusText(item)}</p>
      <p>今日目标 ${fmtMoney(item.target)}，Gap ${gapRate}，差额 ${fmtSignedMoney(item.gap)} 元；</p>
      <p>${todayAnalysisText(item, day)}</p>
    </article>
  `;
}

function todaySummaryCard(items, day) {
  const target = sum(items, (item) => item.target);
  const actual = sum(items, (item) => item.actual);
  const rate = target ? actual / target : null;
  return `
    <article class="today-summary">
      <span>今日总目标</span>
      <small>${escapeHtml(shortDayLabel(day))}</small>
      <small>目标 ${fmtMoney(target)}</small>
      <strong>营收：${fmtMoney(actual)}</strong>
      <small>今日达成 ${fmtPct(rate)}</small>
    </article>
  `;
}

function buildRevenueStatusHtml(overview, scope) {
  const day = reportEndDate(overview);
  const days = monthDays(overview.month);
  const elapsed = Math.min(Number(day.slice(-2)) || 1, days);
  const timeRate = days ? elapsed / days : 0;
  const summary = overview.summary || {};
  const todayItems = (overview.business || []).map((row) => todayModel(overview, row.label, day));
  const pageLabel = SCOPES[scope]?.label || "整体目标";
  const business = (overview.business || []).find((row) => row.label === pageLabel);
  const selectedMonthly = scope === "overall" ? summary : (business || {});
  const monthlyTarget = Number(selectedMonthly.targetAmount || 0);
  const monthlyActual = Number(selectedMonthly.actualAmount || 0);
  const revenueRate = monthlyTarget ? monthlyActual / monthlyTarget : null;
  const paceGap = (revenueRate || 0) - timeRate;
  const visibleItems = scope === "overall" ? todayItems : todayItems.filter((item) => item.label === pageLabel);
  const todayGridClass = scope === "overall" ? "all" : "single";
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { margin: 0; padding: 18px; width: 1100px; background: #f5f7fb; color: #102a34; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; }
  .report { width: 1064px; background: #f8fbfd; border: 1px solid #dce5eb; border-radius: 8px; overflow: hidden; }
  .top { display: grid; grid-template-columns: 280px 1fr 158px; gap: 18px; padding: 22px 22px 18px; background: linear-gradient(180deg, #f9fcfd, #eef8f8); border-bottom: 1px solid #dce8ee; align-items: center; }
  .total h1 { margin: 0 0 14px; font-size: 20px; }
  .total-row { display: flex; align-items: center; gap: 14px; }
  .total-lines strong { display: block; margin: 8px 0; font-size: 18px; }
  .badge { min-width: 58px; min-height: 58px; display: grid; place-items: center; border: 1px solid #f7b4aa; border-radius: 8px; background: #fff0ed; color: #c73522; font-size: 19px; font-weight: 900; }
  .progress-wrap { display: grid; gap: 18px; }
  .progress-line .meta { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; font-weight: 800; }
  .track { height: 9px; background: #e1ebf0; border-radius: 999px; overflow: hidden; }
  .track i { display: block; height: 100%; border-radius: inherit; }
  .time i { background: #1f766b; }
  .revenue i { background: #d53f0f; }
  .pace { border-left: 1px solid #d7e2e8; padding-left: 18px; }
  .pace span { display: block; color: #50616e; font-size: 12px; font-weight: 800; }
  .pace strong { display: block; margin: 8px 0 4px; font-size: 26px; }
  .pace small { color: #50616e; }
  .section { margin: 12px; padding: 14px 16px 16px; border: 1px solid #dce5eb; border-radius: 8px; background: #fff; }
  .section-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
  .section-head h2 { margin: 0; font-size: 19px; }
  .section-head span { color: #50616e; font-size: 12px; }
  .today-grid { display: grid; gap: 10px; }
  .today-grid.all { grid-template-columns: 200px repeat(3, 1fr); }
  .today-grid.single { grid-template-columns: 220px 1fr; }
  .today-summary, .today-card { border-radius: 7px; padding: 14px; min-height: 138px; }
  .today-summary { border: 1px solid #d4e8eb; background: linear-gradient(135deg, #f0fbfb, #f8fcfd); }
  .today-summary span { display: block; font-size: 16px; font-weight: 900; margin-bottom: 12px; }
  .today-summary strong { display: block; margin: 8px 0; font-size: 18px; }
  .today-summary small { display: block; margin-top: 6px; color: #334b57; font-weight: 700; }
  .today-card { border: 1px solid #f1b9b4; background: #fffafa; }
  .today-card.good { border-color: #a7dbc2; background: #f7fffb; }
  .today-card.neutral { border-color: #ccd8df; background: #fbfcfd; }
  .today-title { font-size: 16px; font-weight: 900; margin-bottom: 10px; }
  .today-values { display: grid; grid-template-columns: 1fr 80px 1fr; gap: 10px; align-items: center; margin-bottom: 8px; }
  .today-values strong { font-size: 20px; }
  .today-values strong:last-child { text-align: right; }
  .today-values span { text-align: center; font-weight: 900; }
  .today-track { height: 9px; border-radius: 999px; background: #e1ebf0; overflow: hidden; margin-bottom: 9px; }
  .today-track i { display: block; height: 100%; border-radius: inherit; background: #d53f0f; }
  .today-card.good .today-track i { background: #1f766b; }
  .today-status { color: #c73522; font-weight: 900; margin: 0 0 8px; }
  .today-card.good .today-status { color: #15803d; }
  .today-card p { margin: 6px 0 0; color: #50616e; font-size: 12px; line-height: 1.55; }
  .footer { display: flex; justify-content: space-between; padding: 10px 18px; border-top: 1px solid #dce5eb; color: #61727c; font-size: 11px; background: #fff; }
</style>
</head>
<body>
  <main class="report">
    <section class="top">
      <div class="total">
        <h1>${scope === "overall" ? "总营收" : `${escapeHtml(pageLabel)} · 总览`}</h1>
        <div class="total-row">
          <div class="total-lines">
            <strong>目标 ${fmtMoney(monthlyTarget)}</strong>
            <strong>营收：${fmtMoney(monthlyActual)}</strong>
          </div>
          <b class="badge">${fmtPct(revenueRate)}</b>
        </div>
      </div>
      <div class="progress-wrap">
        <div class="progress-line time">
          <div class="meta"><span>时间进度</span><span>${elapsed} / ${days} 天&nbsp;&nbsp;${fmtPct(timeRate)}</span></div>
          <div class="track"><i style="width:${clampPercent(timeRate)}%"></i></div>
        </div>
        <div class="progress-line revenue">
          <div class="meta"><span>营收进度</span><span>${fmtPct(revenueRate)} 月度达成</span></div>
          <div class="track"><i style="width:${clampPercent(revenueRate)}%"></i></div>
        </div>
      </div>
      <div class="pace">
        <span>节奏差</span>
        <strong>${fmtSignedPct(paceGap)}</strong>
        <small>${paceGap >= 0 ? "营收进度快于时间" : "营收进度慢于时间"}</small>
      </div>
    </section>
    <section class="section">
      <div class="section-head">
        <h2>${scope === "overall" ? "今日目标" : `今日目标 · ${escapeHtml(pageLabel)}`}</h2>
        <span>${escapeHtml(day)} 的日目标</span>
      </div>
      <div class="today-grid ${todayGridClass}">
        ${todaySummaryCard(scope === "overall" ? todayItems : visibleItems, day)}
        ${visibleItems.map((item) => todayCard(item, day)).join("")}
      </div>
    </section>
    <div class="footer">
      <span>口径：CRM totalPriceString，按 createTime 归日</span>
      <span>${escapeHtml(pageLabel)}｜生成 ${new Date().toLocaleString("zh-CN", { hour12: false })}</span>
    </div>
  </main>
</body>
</html>`;
}

function buildDemoHtml(overview) {
  return buildRevenueStatusHtml(overview, "overall");
}

function metricCard(row, timeRate) {
  const tone = rateTone(row.monthRate, timeRate);
  return `
    <div class="metric-card">
      <div class="metric-label">${escapeHtml(row.label)}</div>
      <div class="metric-rate ${tone}">${fmtPct(row.monthRate)}</div>
      <strong>${fmtMoney(row.monthActual)}</strong>
      ${progressBar(row.monthRate, tone)}
      <small>目标 ${fmtMoney(row.monthTarget)} · ${statusSentence(row.monthRate, timeRate)}</small>
    </div>
  `;
}

function analysisLine(row, latestDate, timeRate) {
  const dayTarget = targetForDate([], latestDate, row.label);
  const gapRate = row.phaseTarget ? row.phaseGap / row.phaseTarget : null;
  if (row.phaseGap >= 0 && row.monthRate >= timeRate) {
    return `${row.label} 阶段达标且快于时间，继续保持当前节奏。`;
  }
  if (row.phaseGap >= 0) {
    return `${row.label} 阶段达标，但月度仍慢于时间，后续目标压力需继续跟进。`;
  }
  return `${row.label} 阶段差额 ${fmtSignedMoney(row.phaseGap)} 元，Gap ${fmtSignedPct(gapRate)}，需优先补齐近期缺口。`;
}

function topRows(rows) {
  return rows
    .slice()
    .sort((a, b) => a.phaseGap - b.phaseGap)
    .slice(0, 3);
}

function dailyRowsForScope(overview, scope, latestDate) {
  const label = scope === "overall" ? "" : SCOPES[scope].label;
  const rows = (overview.daily || [])
    .filter((item) => !latestDate || item.date <= latestDate)
    .slice(-5)
    .map((item) => {
      const target = label ? targetForDate(overview.targetRecords || [], item.date, label) : Number(item.targetAmount || 0);
      const actual = label ? actualForDate(overview.actualRecords || [], item.date, label) : Number(item.actualAmount || 0);
      const rate = target ? actual / target : null;
      return { date: item.date, target, actual, rate, gap: actual - target };
    });
  return rows;
}

function dailyTable(rows) {
  return `
    <table>
      <thead><tr><th>日期</th><th>目标</th><th>实际</th><th>达成</th></tr></thead>
      <tbody>
        ${rows.map((row) => `<tr>
          <td>${shortDayLabel(row.date)}</td>
          <td>${fmtMoney(row.target)}</td>
          <td>${fmtMoney(row.actual)}</td>
          <td class="${rateTone(row.rate)}">${fmtPct(row.rate)}</td>
        </tr>`).join("")}
      </tbody>
    </table>
  `;
}

function buildModel(overview, scope) {
  const latestDate = overview.actualRange?.end || latestActualDate(overview.actualRecords || []);
  const elapsed = latestDate ? Math.min(Number(latestDate.slice(-2)), monthDays(overview.month)) : 0;
  const timeRate = monthDays(overview.month) ? elapsed / monthDays(overview.month) : 0;
  const businessRows = buildBusinessRows(overview, latestDate);
  const summary = {
    label: "总营收",
    monthTarget: Number(overview.summary?.targetAmount || 0),
    monthActual: Number(overview.summary?.actualAmount || 0),
    monthRate: overview.summary?.targetAmount ? Number(overview.summary.actualAmount || 0) / Number(overview.summary.targetAmount || 0) : null,
    phaseTarget: targetToDate(overview.targetRecords || [], latestDate),
    phaseActual: actualToDate(overview.actualRecords || [], latestDate),
  };
  summary.phaseRate = summary.phaseTarget ? summary.phaseActual / summary.phaseTarget : null;
  summary.phaseGap = summary.phaseActual - summary.phaseTarget;
  const selected = scope === "overall"
    ? summary
    : businessRows.find((item) => item.label === SCOPES[scope].label) || summary;
  return { latestDate, elapsed, timeRate, businessRows, summary, selected, dailyRows: dailyRowsForScope(overview, scope, latestDate) };
}

function buildHtml(overview, scope, targetLabel) {
  return buildRevenueStatusHtml(overview, scope);
}

async function renderImage(args, html) {
  await fs.mkdir(args.outputDir, { recursive: true });
  const htmlPath = path.join(args.outputDir, `feishu-overview-card-${args.month}-${args.scope}-${stamp()}.html`);
  const imagePath = htmlPath.replace(/\.html$/, ".png");
  await fs.writeFile(htmlPath, html, "utf8");
  await execFileAsync(args.chrome, [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=1120,620",
    `--screenshot=${imagePath}`,
    `file://${htmlPath}`,
  ], { timeout: 30000 });
  return { htmlPath, imagePath };
}

function scopeSummaryText(scope, overview) {
  if (scope === "overall") {
    const summary = overview.summary || {};
    const latestDate = overview.actualRange?.end || latestActualDate(overview.actualRecords || []);
    return `**书法｜营收目标口径**\n月度达成 ${fmtPct(summary.achievementRate)}｜累计 ${fmtMoney(summary.actualAmount)} / ${fmtMoney(summary.targetAmount)}｜截至 ${latestDate || "-"}`;
  }
  const row = (overview.business || []).find((item) => item.label === SCOPES[scope].label) || {};
  const latestDate = overview.actualRange?.end || latestActualDate(overview.actualRecords || []);
  return `**${SCOPES[scope].label}｜营收目标口径**\n月度达成 ${fmtPct(row.achievementRate)}｜累计 ${fmtMoney(row.actualAmount)} / ${fmtMoney(row.targetAmount)}｜截至 ${latestDate || "-"}`;
}

function buildCallbackCard(value) {
  const tabs = Array.isArray(value.tabs) ? value.tabs : [];
  const selectedScope = value.selectedScope || "overall";
  const selected = tabs.find((item) => item.scope === selectedScope) || tabs[0] || {};
  return {
    config: { wide_screen_mode: true },
    header: {
      template: "blue",
      title: { tag: "plain_text", content: value.title || "经营进度日报 · 书法（Demo）" },
    },
    elements: [
      {
        tag: "markdown",
        content: selected.summaryText || "**书法｜营收目标口径**",
      },
      {
        tag: "img",
        img_key: selected.imageKey,
        alt: { tag: "plain_text", content: `${selected.label || "经营进度"}看板` },
      },
      { tag: "hr" },
      {
        tag: "markdown",
        content: [
          "**口径说明**",
          "· 数据源：本地看板 CRM 营收总览",
          "· 实际：CRM totalPriceString，按 createTime 归日",
          "· 点击底部按钮可切换不同业务视图",
        ].join("\n"),
      },
      {
        tag: "action",
        actions: tabs.map((tab) => ({
          tag: "button",
          text: { tag: "plain_text", content: tab.label },
          type: tab.scope === selectedScope ? "primary" : "default",
          value: {
            mode: "revenue_overview_demo",
            month: value.month,
            title: value.title,
            selectedScope: tab.scope,
            tabs,
          },
        })),
      },
    ],
  };
}

function buildCard(scope, imageKey, month, overview, tabs = null) {
  const latestDate = overview.actualRange?.end || latestActualDate(overview.actualRecords || []);
  const summary = overview.summary || {};
  if (tabs?.length) {
    return buildCallbackCard({
      mode: "revenue_overview_demo",
      month,
      title: "经营进度日报 · 书法（Demo）",
      selectedScope: scope,
      tabs,
    });
  }
  return {
    config: { wide_screen_mode: true },
    header: {
      template: "blue",
      title: { tag: "plain_text", content: scope === "overall" ? "经营进度日报 · 书法（Demo）" : `${meta.title}（${month}）` },
    },
    elements: [
      {
        tag: "markdown",
        content: `**书法｜营收目标口径**\n月度达成 ${fmtPct(summary.achievementRate)}｜累计 ${fmtMoney(summary.actualAmount)} / ${fmtMoney(summary.targetAmount)}｜截至 ${latestDate || "-"}`,
      },
      {
        tag: "img",
        img_key: imageKey,
        alt: { tag: "plain_text", content: "经营进度日报看板" },
      },
      { tag: "hr" },
      {
        tag: "markdown",
        content: [
          "**口径说明**",
          "· 数据源：本地看板 CRM 营收总览",
          "· 实际：CRM totalPriceString，按 createTime 归日",
          "· 这是日报卡片样式 Demo，用于确认版式",
        ].join("\n"),
      },
      {
        tag: "action",
        actions: ["整体目标", "书法前端", "书法后端", "朗诵后端"].map((text, index) => ({
          tag: "button",
          text: { tag: "plain_text", content: text },
          type: index === 0 ? "primary" : "default",
          value: { sku: text, demo: true },
        })),
      },
    ],
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }
  if (!SCOPES[args.scope]) throw new Error(`不支持的报告范围：${args.scope}`);
  const config = await readJson(args.config);
  const target = pickTarget(config, args.targetId);
  const overview = await fetchOverview(args.baseUrl, args.month);
  const renderScopes = args.scope === "overall" ? Object.keys(SCOPES) : [args.scope];
  const rendered = [];
  for (const scope of renderScopes) {
    const html = buildHtml(overview, scope, target.label);
    const artifact = await renderImage({ ...args, scope }, html);
    rendered.push({ scope, ...artifact });
  }
  const primary = rendered.find((item) => item.scope === args.scope) || rendered[0];
  let sendPayload = null;
  let uploadedTabs = [];
  if (!args.dryRun) {
    if ((config.mode || "app") === "webhook") {
      throw new Error("当前 webhook 模式不支持上传图片日报，请使用飞书自建应用 app 配置。");
    }
    const token = await tenantAccessToken(config);
    uploadedTabs = [];
    for (const item of rendered) {
      const imageKey = await uploadFeishuImage(token, item.imagePath);
      uploadedTabs.push({
        scope: item.scope,
        label: SCOPES[item.scope].label,
        imageKey,
        summaryText: scopeSummaryText(item.scope, overview),
      });
    }
    const primaryTab = uploadedTabs.find((item) => item.scope === args.scope) || uploadedTabs[0];
    sendPayload = await sendAppMessage(target, token, "interactive", buildCard(args.scope, primaryTab.imageKey, args.month, overview, uploadedTabs));
  }
  const result = {
    ok: true,
    dryRun: Boolean(args.dryRun),
    month: args.month,
    scope: args.scope,
    scopeLabel: SCOPES[args.scope].label,
    targetId: target.id,
    targetLabel: target.label,
    htmlPath: primary.htmlPath,
    imagePath: primary.imagePath,
    rendered,
    sentAt: new Date().toISOString(),
    messageId: sendPayload?.data?.message_id || "",
  };
  await writeJson(path.join(ROOT, "data", "integration-checks", "reports", `feishu-overview-card-${args.month}-latest.json`), result);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
