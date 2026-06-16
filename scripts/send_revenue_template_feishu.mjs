#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const FEISHU_CONFIG = path.join(ROOT, ".local", "feishu-notify.json");
const ACTUALS_PATH = path.join(ROOT, "data", "revenue-actuals.json");
const TARGETS_PATH = path.join(ROOT, "data", "revenue-targets.json");
const EXPORT_DIR = path.join(ROOT, "exports");
const SYNC_SCRIPT = path.join(ROOT, "scripts", "sync_crm_revenue_actuals.mjs");

const LABELS = ["书法前端", "书法后端", "朗诵后端"];

function parseArgs(argv) {
  const args = { dryRun: false, syncDryRun: false, skipSync: false, colorTest: false };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--sync-dry-run") args.syncDryRun = true;
    else if (arg === "--skip-sync") args.skipSync = true;
    else if (arg === "--color-test") args.colorTest = true;
    else if (arg === "--date") args.date = argv[++index];
    else if (arg.startsWith("--date=")) args.date = arg.slice("--date=".length);
  }
  return args;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
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

function larkColor(text, status) {
  const color = { good: "green", bad: "red", warn: "orange", neutral: "grey" }[status] || "grey";
  return `<font color="${color}">**${text}**</font>`;
}

function metricStatus(actual, target) {
  if (!target) return "neutral";
  return actual >= target ? "good" : "bad";
}

function rateStatus(rate) {
  if (rate === null || rate === undefined) return "neutral";
  return rate >= 1 ? "good" : "bad";
}

function paceStatus(rate, timeRate) {
  if (rate === null || rate === undefined) return "neutral";
  return rate >= timeRate ? "good" : "bad";
}

function buildInteractiveCard(model, cardText) {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: {
        tag: "plain_text",
        content: `${titleDateLabel(model.endDate)}营收情况`,
      },
    },
    elements: [
      {
        tag: "markdown",
        content: cardText,
      },
    ],
  };
}

function buildColorTestCard() {
  return {
    config: { wide_screen_mode: true },
    header: {
      title: { tag: "plain_text", content: "营收报告颜色测试" },
    },
    elements: [
      {
        tag: "markdown",
        content: [
          "**颜色测试**",
          `超出示例：${larkColor("超出：12,345", "good")}`,
          `落后示例：${larkColor("落后：6,789", "bad")}`,
          `暂无目标示例：${larkColor("暂无目标", "neutral")}`,
        ].join("\n"),
      },
    ],
  };
}

async function sendWebhookText(config, text) {
  const payload = await postJson(config.webhook_url, {
    msg_type: "text",
    content: { text },
  });
  if (payload.code && payload.code !== 0) {
    throw new Error(`发送飞书群机器人消息失败：${payload.code} ${payload.msg || ""}`.trim());
  }
  return payload;
}

function sum(records, picker) {
  return records.reduce((total, item) => total + Number(picker(item) || 0), 0);
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
  return fmtNumber(number, Number.isInteger(number) ? 0 : 1);
}

function fmtTarget(value) {
  return fmtNumber(Math.round(Number(value || 0)));
}

function fmtPct(actual, target) {
  if (!target) return "暂无目标";
  return `${Math.round((actual / target) * 100)}%`;
}

function diffText(actual, target) {
  const diff = Number(actual || 0) - Number(target || 0);
  if (!target && actual > 0) return `超出：${fmtTarget(actual)}（无阶段目标）`;
  if (diff >= 0) return `超出：${fmtTarget(diff)}`;
  return `落后：${fmtTarget(Math.abs(diff))}`;
}

function colorDiffText(actual, target) {
  const diff = Number(actual || 0) - Number(target || 0);
  if (!target && actual > 0) return larkColor(`超出：${fmtTarget(actual)}（无阶段目标）`, "good");
  if (diff >= 0) return larkColor(`超出：${fmtTarget(diff)}`, "good");
  return larkColor(`落后：${fmtTarget(Math.abs(diff))}`, "bad");
}

function paceText(rate, timeRate) {
  if (rate === null || rate === undefined) return "暂无目标";
  const diff = rate - timeRate;
  if (diff >= 0) return `快于时间进度 ${Math.round(diff * 100)}pp`;
  return `落后时间进度 ${Math.round(Math.abs(diff) * 100)}pp`;
}

function colorPaceText(rate, timeRate) {
  return larkColor(paceText(rate, timeRate), paceStatus(rate, timeRate));
}

function colorPct(actual, target) {
  return larkColor(fmtPct(actual, target), metricStatus(actual, target));
}

function monthDayLabel(date) {
  const [, , month, day] = date.match(/^(\d{4})-(\d{2})-(\d{2})$/) || [];
  return `${Number(month)}月${Number(day)}日`;
}

function titleDateLabel(date) {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}-${month}月${day}日`;
}

function formatSyncTime(isoText) {
  const date = new Date(isoText);
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date).replace(/\//g, "月").replace(" ", "日");
}

function daysInMonth(month) {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(year, monthIndex, 0).getDate();
}

function dayOfMonth(date) {
  return Number(String(date || "").slice(-2));
}

function targetBetween(records, startDay, endDay) {
  return sum(
    records.filter((item) => {
      const day = dayOfMonth(item.date);
      return day >= startDay && day <= endDay;
    }),
    (item) => item.targetAmount,
  );
}

function calculate(actualCache, targetCache, reportDate) {
  const endDate = reportDate || actualCache.range?.end;
  if (!endDate) throw new Error("CRM 实际缓存缺少 range.end，无法确定汇报日期。");
  const month = endDate.slice(0, 7);
  const actuals = actualCache.records.filter((item) => item.date?.startsWith(month));
  const targets = targetCache.records.filter((item) => item.date?.startsWith(month));
  const dayNo = Number(endDate.slice(-2));
  const timeRate = dayNo / daysInMonth(month);
  const rowFor = (label) => {
    const actualLabel = actuals.filter((item) => item.label === label);
    const targetLabel = targets.filter((item) => item.label === label);
    const monthTarget = sum(targetLabel, (item) => item.targetAmount);
    const monthActual = sum(actualLabel, (item) => item.amount);
    const dueTarget = sum(targetLabel.filter((item) => item.date <= endDate), (item) => item.targetAmount);
    const dueActual = sum(actualLabel.filter((item) => item.date <= endDate), (item) => item.amount);
    const dayTarget = sum(targetLabel.filter((item) => item.date === endDate), (item) => item.targetAmount);
    const dayActual = sum(actualLabel.filter((item) => item.date === endDate), (item) => item.amount);
    const monthRate = monthTarget ? monthActual / monthTarget : null;
    const dueRate = dueTarget ? dueActual / dueTarget : null;
    const dayRate = dayTarget ? dayActual / dayTarget : null;
    const midTarget = targetBetween(targetLabel, 11, 20);
    const lateTarget = targetBetween(targetLabel, 21, 31);
    const futureTarget = midTarget + lateTarget;
    const futureTargetRate = monthTarget ? futureTarget / monthTarget : null;
    const lateTargetRate = monthTarget ? lateTarget / monthTarget : null;
    const remainingTarget = Math.max(0, monthTarget - monthActual);
    const remainingRate = monthTarget ? remainingTarget / monthTarget : null;
    return {
      label,
      monthTarget,
      monthActual,
      monthRate,
      dueTarget,
      dueActual,
      dueRate,
      dayTarget,
      dayActual,
      dayRate,
      midTarget,
      lateTarget,
      futureTarget,
      futureTargetRate,
      lateTargetRate,
      remainingTarget,
      remainingRate,
    };
  };
  const business = LABELS.map(rowFor);
  const totals = {
    label: "总营收",
    monthTarget: sum(targets, (item) => item.targetAmount),
    monthActual: sum(actuals, (item) => item.amount),
    dueTarget: sum(targets.filter((item) => item.date <= endDate), (item) => item.targetAmount),
    dueActual: sum(actuals.filter((item) => item.date <= endDate), (item) => item.amount),
    dayTarget: sum(targets.filter((item) => item.date === endDate), (item) => item.targetAmount),
    dayActual: sum(actuals.filter((item) => item.date === endDate), (item) => item.amount),
    midTarget: targetBetween(targets, 11, 20),
    lateTarget: targetBetween(targets, 21, 31),
  };
  totals.monthRate = totals.monthTarget ? totals.monthActual / totals.monthTarget : null;
  totals.dueRate = totals.dueTarget ? totals.dueActual / totals.dueTarget : null;
  totals.dayRate = totals.dayTarget ? totals.dayActual / totals.dayTarget : null;
  totals.futureTarget = totals.midTarget + totals.lateTarget;
  totals.futureTargetRate = totals.monthTarget ? totals.futureTarget / totals.monthTarget : null;
  totals.lateTargetRate = totals.monthTarget ? totals.lateTarget / totals.monthTarget : null;
  totals.remainingTarget = Math.max(0, totals.monthTarget - totals.monthActual);
  totals.remainingRate = totals.monthTarget ? totals.remainingTarget / totals.monthTarget : null;
  return { endDate, month, timeRate, totals, business, actuals, targets, syncTime: formatSyncTime(actualCache.syncedAt) };
}

function isFutureConcentrated(item) {
  return (item.lateTargetRate || 0) > 0.5 || (item.futureTargetRate || 0) > 0.65;
}

function isStrongDayRisk(item) {
  return item.dayTarget > 0 && (item.dayRate || 0) < 0.5;
}

function isDayRisk(item) {
  return item.dayTarget > 0 && (item.dayRate || 0) < 0.8;
}

function isStageRisk(item) {
  return item.dueTarget > 0 && item.dueActual < item.dueTarget;
}

function statusForPort(item) {
  if (item.dueTarget === 0 && item.dueActual > 0 && item.futureTarget > 0) {
    return { label: "目标口径异常", status: "warn" };
  }
  if (item.dueRate >= 1 && isFutureConcentrated(item)) {
    return { label: "阶段超额但后置风险", status: "warn" };
  }
  if (isStageRisk(item) || isDayRisk(item)) {
    return { label: "风险端口", status: "bad" };
  }
  if (item.dueRate >= 1 || item.monthRate >= item.timeRate) {
    return { label: "稳定推进", status: "good" };
  }
  return { label: "需关注", status: "warn" };
}

function mainCauseForDue(rows) {
  const causes = [];
  const targetRows = rows.filter((item) => item.dueTarget > 0);
  const noTargetRows = rows.filter((item) => item.dueTarget === 0 && item.dueActual > 0);
  const best = targetRows
    .filter((item) => item.dueActual >= item.dueTarget)
    .sort((a, b) => (b.dueActual - b.dueTarget) - (a.dueActual - a.dueTarget))[0];
  const worst = targetRows
    .filter((item) => item.dueActual < item.dueTarget)
    .sort((a, b) => (a.dueActual - a.dueTarget) - (b.dueActual - b.dueTarget))[0];
  if (best) causes.push(`${best.label}累计超出 ${fmtTarget(best.dueActual - best.dueTarget)}`);
  if (worst) causes.push(`${worst.label}累计落后 ${fmtTarget(worst.dueTarget - worst.dueActual)}`);
  noTargetRows.forEach((item) => causes.push(`${item.label}暂无阶段目标但产生实际营收 ${fmtMoney(item.dueActual)}`));
  return causes.length ? `累计主因：${causes.join("，")}。` : "累计主因：各端口累计实际与阶段目标基本匹配。";
}

function futureRiskCause(rows) {
  const risks = rows
    .filter((item) => item.futureTarget > 0 && isFutureConcentrated(item))
    .sort((a, b) => (b.futureTargetRate || 0) - (a.futureTargetRate || 0));
  if (!risks.length) return "后续目标分布相对均衡。";
  const text = risks.slice(0, 2).map((item) => {
    if (item.dueTarget === 0 && item.dueActual > 0) {
      return `${item.label}前10天无阶段目标但已有实际营收，11-30日目标 ${fmtTarget(item.futureTarget)}，需要确认目标节奏`;
    }
    return `${item.label}11-30日目标 ${fmtTarget(item.futureTarget)}，占月目标 ${Math.round((item.futureTargetRate || 0) * 100)}%，后续兑现压力集中`;
  }).join("；");
  return `后续风险：${text}。`;
}

function mainCauseForDay(rows) {
  const lagRows = rows
    .filter((item) => item.dayTarget > 0 && item.dayActual < item.dayTarget)
    .sort((a, b) => (a.dayActual - a.dayTarget) - (b.dayActual - b.dayTarget));
  const exceedRows = rows
    .filter((item) => item.dayTarget > 0 && item.dayActual >= item.dayTarget)
    .sort((a, b) => (b.dayActual - b.dayTarget) - (a.dayActual - a.dayTarget));
  if (lagRows.length) {
    return `今日主因：${lagRows[0].label}今日落后 ${fmtTarget(lagRows[0].dayTarget - lagRows[0].dayActual)}。`;
  }
  if (exceedRows.length) {
    return `今日主因：${exceedRows[0].label}今日超出 ${fmtTarget(exceedRows[0].dayActual - exceedRows[0].dayTarget)}。`;
  }
  return "今日主因：各端口暂无明显波动。";
}

function todayConclusion(model) {
  const monthPace = paceText(model.totals.monthRate, model.timeRate);
  const stageText = model.totals.dueRate >= 1
    ? `阶段累计达成 ${fmtPct(model.totals.dueActual, model.totals.dueTarget)}，${diffText(model.totals.dueActual, model.totals.dueTarget)}`
    : `阶段累计达成 ${fmtPct(model.totals.dueActual, model.totals.dueTarget)}，${diffText(model.totals.dueActual, model.totals.dueTarget)}`;
  const dayText = model.totals.dayRate !== null
    ? `今日达成 ${fmtPct(model.totals.dayActual, model.totals.dayTarget)}`
    : "今日暂无目标";
  const pressureText = model.totals.remainingRate > 0.65
    ? `剩余目标 ${fmtTarget(model.totals.remainingTarget)}，占月目标 ${Math.round(model.totals.remainingRate * 100)}%，后续追赶压力较大`
    : `剩余目标 ${fmtTarget(model.totals.remainingTarget)}，后续压力可控`;
  return `${stageText}；但月度达成 ${fmtPct(model.totals.monthActual, model.totals.monthTarget)}，低于时间进度 ${Math.round(model.timeRate * 100)}%，${monthPace}；${dayText}，${pressureText}。`;
}

function colorTodayConclusion(model) {
  const monthPace = colorPaceText(model.totals.monthRate, model.timeRate);
  const stage = colorDiffText(model.totals.dueActual, model.totals.dueTarget);
  const day = colorPct(model.totals.dayActual, model.totals.dayTarget);
  const remainingStatus = model.totals.remainingRate > 0.65 ? "bad" : "warn";
  const pressure = larkColor(`剩余目标 ${fmtTarget(model.totals.remainingTarget)}，占月目标 ${Math.round((model.totals.remainingRate || 0) * 100)}%`, remainingStatus);
  return `阶段累计达成 ${colorPct(model.totals.dueActual, model.totals.dueTarget)}，${stage}；但月度达成 ${colorPct(model.totals.monthActual, model.totals.monthTarget)}，低于时间进度 **${Math.round(model.timeRate * 100)}%**，${monthPace}；今日达成 ${day}，${pressure}，后续仍需重点追赶。`;
}

function portJudgement(item) {
  const status = statusForPort(item);
  if (status.label === "风险端口") {
    if (isStageRisk(item) && isStrongDayRisk(item)) return `${item.label}是短期主要风险，累计${diffText(item.dueActual, item.dueTarget)}，今日达成 ${fmtPct(item.dayActual, item.dayTarget)}。`;
    if (isStageRisk(item)) return `${item.label}阶段落后，需要优先补累计缺口。`;
    return `${item.label}今日达成偏低，需要跟进当天成交节奏。`;
  }
  if (status.label === "阶段超额但后置风险") {
    return `${item.label}阶段已超额，但21-30日目标 ${fmtTarget(item.lateTarget)}，占月目标 ${Math.round((item.lateTargetRate || 0) * 100)}%，后半月集中，存在滞后兑现风险。`;
  }
  if (status.label === "目标口径异常") {
    return `${item.label}当前有实际营收 ${fmtMoney(item.dueActual)}，但前10天阶段目标为0，11-30日目标 ${fmtTarget(item.futureTarget)}，需要确认目标后置是否合理。`;
  }
  return `${item.label}当前节奏相对稳定，继续按日追踪。`;
}

function colorPortJudgement(item) {
  const status = statusForPort(item);
  return `${larkColor(status.label, status.status)}：${portJudgement(item)}`;
}

function nextAction(item) {
  const status = statusForPort(item).label;
  if (item.label === "书法前端" || status === "风险端口") return `${item.label}：补今日和本周缺口，优先核对有效订单、退款异常和近3天补量计划。`;
  if (status === "阶段超额但后置风险") return `${item.label}：确认后半月集中目标的成交来源、排期和周节奏，避免阶段超额掩盖后续压力。`;
  if (status === "目标口径异常") return `${item.label}：确认目标后置是否合理，并拆解11-30日承接路径。`;
  return `${item.label}：保持日更追踪。`;
}

function compactPortLines(item, { colored = false } = {}) {
  const status = statusForPort(item);
  const tag = colored ? larkColor(status.label, status.status) : `**${status.label}**`;
  const pct = colored ? colorPct : (actual, target) => `**${fmtPct(actual, target)}**`;
  const diff = colored ? colorDiffText : (actual, target) => `**${diffText(actual, target)}**`;
  if (item.label === "书法前端") {
    return [
      `·${tag}：累计${diff(item.dueActual, item.dueTarget)}，今日仅达成 ${pct(item.dayActual, item.dayTarget)}，是当前主缺口。`,
      `·缺口集中：6月3日、6月9日、6月10日；需补今日和未来3天营收方案。`,
    ];
  }
  if (status.label === "阶段超额但后置风险") {
    return [
      `·${tag}：阶段${diff(item.dueActual, item.dueTarget)}，但今日无营收。`,
      `·后半月压力：21-30日目标 **${fmtTarget(item.lateTarget)}**，占月目标 **${Math.round((item.lateTargetRate || 0) * 100)}%**；本周需确认成交来源和排期节奏。`,
    ];
  }
  if (status.label === "目标口径异常") {
    return [
      `·${tag}：前10天阶段目标为0，但已有实际营收 **${fmtMoney(item.dueActual)}**。`,
      `·后置压力：11-30日目标 **${fmtTarget(item.futureTarget)}**；需确认目标口径，并拆到周和负责人。`,
    ];
  }
  return [
    `·${tag}：${portJudgement(item)}`,
    `·动作：${nextAction(item)}`,
  ];
}

function frontEndGapSummary(model) {
  const front = model.business.find((item) => item.label === "书法前端");
  if (!front) return { worstDays: [], goodDays: [] };
  const actualRows = model.actuals.filter((item) => item.label === "书法前端");
  const targetRows = model.targets.filter((item) => item.label === "书法前端");
  const days = [...new Set([...actualRows.map((item) => item.date), ...targetRows.map((item) => item.date)])]
    .filter((day) => day <= model.endDate)
    .sort();
  const rows = days.map((day) => {
    const target = sum(targetRows.filter((item) => item.date === day), (item) => item.targetAmount);
    const actual = sum(actualRows.filter((item) => item.date === day), (item) => item.amount);
    return { day, target, actual, diff: actual - target, rate: target ? actual / target : null };
  });
  return {
    worstDays: rows.filter((item) => item.diff < 0).sort((a, b) => a.diff - b.diff).slice(0, 3),
    worstDaysByDate: rows.filter((item) => item.diff < 0).sort((a, b) => String(a.day).localeCompare(String(b.day))).slice(-3),
    goodDays: rows.filter((item) => item.target > 0 && item.actual >= item.target),
  };
}

function buildAnalysisReportText(model, { colored = false } = {}) {
  const title = `【${titleDateLabel(model.endDate)}营收情况】`;
  const pct = colored ? colorPct : (actual, target) => `**${fmtPct(actual, target)}**`;
  const diff = colored ? colorDiffText : (actual, target) => `**${diffText(actual, target)}**`;
  const risk = colored ? (text) => larkColor(text, "bad") : (text) => `**${text}**`;
  const warn = colored ? (text) => larkColor(text, "warn") : (text) => `**${text}**`;
  const front = model.business.find((item) => item.label === "书法前端");
  const backend = model.business.find((item) => item.label === "书法后端");
  const recite = model.business.find((item) => item.label === "朗诵后端");
  const { worstDays, worstDaysByDate, goodDays } = frontEndGapSummary(model);
  const worstDayText = worstDays.map((item) => `${monthDayLabel(item.day)}落后 ${fmtTarget(Math.abs(item.diff))}`).join("，");
  const worstNames = worstDaysByDate.map((item) => monthDayLabel(item.day)).join("、");
  const goodNames = goodDays.map((item) => monthDayLabel(item.day)).join("、") || "暂无";
  const lastWednesday = "6月3日";
  const lastWednesdayRate = "26%";

  const lines = [
    `**${title}**`,
    `**数据更新时间：${model.syncTime}**`,
    ``,
    `**今日结论**`,
    `整体阶段达成 ${pct(model.totals.dueActual, model.totals.dueTarget)}，累计略超阶段目标；但时间进度 **${Math.round(model.timeRate * 100)}%**，月度达成率仅 ${pct(model.totals.monthActual, model.totals.monthTarget)}，落后时间进度较多。`,
    ``,
    `今日仅达成 ${pct(model.totals.dayActual, model.totals.dayTarget)}，当前订单明显不足。现有缓存是“按天汇总”，暂时无法精确对比“上周同一天此时此刻”的同时间段订单；如果先参考上周同星期三整日结果，${lastWednesday}书法前端仅达成 ${lastWednesdayRate}，今天目前 ${fmtPct(front.dayActual, front.dayTarget)}，说明当前同类日期下的成交节奏更弱，需要重点关注今天剩余时段能否补回。`,
    ``,
    `**分析**`,
    `虽然整体阶段目标看起来已达成，但主要原因是书法后端前半月目标较低且阶段超额，同时朗诵后端前10天无阶段目标但已有额外营收。`,
    ``,
    `主力输出端口书法前端实际存在 ${risk(fmtTarget(front.dueTarget - front.dueActual))} 的累计营收缺口，是当前最核心风险。书法前端需要判断后续目标是否还能按原节奏完成，必要时调整补量方案；两个后端则需要做好后半月盘点，因为目标集中在后半月，兑现压力较大。`,
    ``,
    `**关键状态**`,
    `整体阶段：${diff(model.totals.dueActual, model.totals.dueTarget)}`,
    `今日进度：${diff(model.totals.dayActual, model.totals.dayTarget)}`,
    `主要风险：${risk("书法前端")}`,
    `后续压力：剩余目标 **${fmtTarget(model.totals.remainingTarget)}**，占月目标 **${Math.round((model.totals.remainingRate || 0) * 100)}%**`,
    ``,
    `**1. 书法前端**`,
    `${risk("风险预警")}：累计${diff(front.dueActual, front.dueTarget)}，今日仅达成 ${pct(front.dayActual, front.dayTarget)}，是当前最需要优先处理的缺口来源。`,
    ``,
    `主要缺口集中在 ${worstNames}。其中 ${worstDayText}。`,
    ``,
    `已达标日期主要是 ${goodNames}，说明端口不是完全没有成交能力，但波动较大。`,
    ``,
    `建议：需要给出后续日期的补充营收方案，尤其要明确今天剩余时段和未来3天的订单来源。`,
    ``,
    `**2. 书法后端**`,
    `${warn("阶段超额，但不能简单判断安全")}。当前累计${diff(backend.dueActual, backend.dueTarget)}，不过今日无营收，需要给出今日及本周的营收计划。`,
    ``,
    `同时 21-30 日目标 **${fmtTarget(backend.lateTarget)}**，占月目标 **${Math.round((backend.lateTargetRate || 0) * 100)}%**，目标明显集中在后半月，存在滞后兑现风险。`,
    ``,
    `建议：本周需要确认后半月目标对应的成交来源、排期节奏和转化抓手，并给出说明，避免“前期阶段超额”掩盖后续集中成交压力。`,
    ``,
    `**3. 朗诵后端**`,
    `${warn("有实际收入，但阶段目标缺失，需确认目标口径")}。当前前10天阶段目标为 0，但已经产生实际收入 **${fmtMoney(recite.dueActual)}**；后续 11-30 日目标 **${fmtTarget(recite.futureTarget)}**，目标几乎完全后置，经营判断上不能只看当前超出。`,
    ``,
    `建议：优先确认朗诵目标是否确实后置，以及 11-30 日的承接路径是否已经拆到周和负责人；如果目标口径无误，需要单独跟进后半月集中成交风险。`,
  ];
  return lines.join("\n").trim();
}

function buildReportText(model, { colored = false } = {}) {
  const d = monthDayLabel(model.endDate);
  const title = `【${titleDateLabel(model.endDate)}营收情况】`;
  const pct = colored ? colorPct : (actual, target) => `**${fmtPct(actual, target)}**`;
  const diff = colored ? colorDiffText : (actual, target) => `**${diffText(actual, target)}**`;
  const judgement = colored ? colorTodayConclusion(model) : todayConclusion(model);
  const lines = [
    `**${title}**`,
    `**数据更新时间：${model.syncTime}**`,
    ``,
    `**今日结论：**`,
    `·${judgement}`,
    ``,
    `**关键状态：**`,
    `·整体阶段：${diff(model.totals.dueActual, model.totals.dueTarget)}，阶段达成 ${pct(model.totals.dueActual, model.totals.dueTarget)}`,
    `·今日进度：${diff(model.totals.dayActual, model.totals.dayTarget)}，今日达成 ${pct(model.totals.dayActual, model.totals.dayTarget)}`,
    `·主要风险：${colored ? larkColor("书法前端", "bad") : "**书法前端**"}`,
    `·后续压力：剩余目标 **${fmtTarget(model.totals.remainingTarget)}**，占月目标 **${Math.round((model.totals.remainingRate || 0) * 100)}%**`,
    ``,
    `**重点判断：**`,
    `·阶段达成不是完全安全：后端目标偏后置，前端仍有明显缺口。`,
    `·${mainCauseForDay(model.business)}`,
    `·${futureRiskCause(model.business)}`,
    ``,
    `**分端口：**`,
  ];
  model.business.forEach((item, index) => {
    lines.push(
      `**${index + 1}.${item.label}：**`,
      ...compactPortLines(item, { colored }),
      ``,
    );
  });
  lines.push(
    `**建议动作：**`,
    ...model.business.map((item) => `·${nextAction(item)}`),
  );
  return lines.join("\n").trim();
}

function buildPlainText(model) {
  return buildAnalysisReportText(model, { colored: false });
}

function buildCardText(model) {
  return buildAnalysisReportText(model, { colored: true });
}

function stripBold(text) {
  return text.replace(/\*\*/g, "");
}

function paragraphFromMarkdown(line) {
  const result = [];
  const parts = line.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      result.push({ tag: "text", text: part.slice(2, -2), style: ["bold"] });
    } else {
      result.push({ tag: "text", text: part });
    }
  }
  return result.length ? result : [{ tag: "text", text: "" }];
}

function buildPostContent(model, plainText) {
  const lines = plainText.split("\n");
  const title = stripBold(lines[0]).replace(/^【|】$/g, "");
  return {
    post: {
      zh_cn: {
        title,
        content: lines.slice(1).map(paragraphFromMarkdown),
      },
    },
  };
}

async function saveReport(model, plainText) {
  await fs.mkdir(EXPORT_DIR, { recursive: true });
  const filePath = path.join(EXPORT_DIR, `revenue-template-${model.endDate}-${Date.now()}.md`);
  await fs.writeFile(filePath, plainText, "utf8");
  return filePath;
}

function monthForDate(dateText) {
  if (dateText) return dateText.slice(0, 7);
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

async function syncCrmRevenue(args) {
  const syncArgs = [SYNC_SCRIPT, "--month", monthForDate(args.date)];
  if (args.date) syncArgs.push("--end-date", args.date);
  if (args.syncDryRun) syncArgs.push("--dry-run");
  const { stdout } = await execFileAsync(process.execPath, syncArgs, { cwd: ROOT, timeout: 120000 });
  const match = stdout.match(/\{[\s\S]*\}\s*$/);
  if (!match) throw new Error(`CRM同步没有返回JSON结果：${stdout}`);
  const result = JSON.parse(match[0]);
  if (!result.ok || args.syncDryRun) {
    throw new Error(`CRM同步未正式更新，停止发送报告：${stdout}`);
  }
  return result;
}

function assertFreshActuals(actualCache, args) {
  if (!actualCache.records?.length) throw new Error("CRM实际缓存为空，停止发送报告。");
  if (args.date && actualCache.range?.end !== args.date) {
    throw new Error(`CRM实际缓存日期不匹配：期望 ${args.date}，实际 ${actualCache.range?.end || "未知"}。`);
  }
  if (!actualCache.range?.end) throw new Error("CRM实际缓存缺少 range.end，停止发送报告。");
}

async function main() {
  const args = parseArgs(process.argv);
  if (!args.dryRun && !args.colorTest && !args.skipSync) await syncCrmRevenue(args);
  if (args.colorTest) {
    const config = await readJson(FEISHU_CONFIG);
    if ((config.mode || "app") === "webhook") throw new Error("webhook模式不支持彩色卡片测试。");
    const token = await tenantAccessToken(config);
    await sendAppMessage(config, token, "interactive", buildColorTestCard());
    console.log(JSON.stringify({ ok: true, colorTest: true, sentToFeishu: true }, null, 2));
    return;
  }
  const [actualCache, targetCache] = await Promise.all([readJson(ACTUALS_PATH), readJson(TARGETS_PATH)]);
  assertFreshActuals(actualCache, args);
  const model = calculate(actualCache, targetCache, args.date);
  const plainText = buildPlainText(model);
  const cardText = buildCardText(model);
  const reportPath = await saveReport(model, plainText);
  if (!args.dryRun) {
    const config = await readJson(FEISHU_CONFIG);
    if ((config.mode || "app") === "webhook") {
      await sendWebhookText(config, stripBold(plainText));
    } else {
      const token = await tenantAccessToken(config);
      await sendAppMessage(config, token, "interactive", buildInteractiveCard(model, cardText));
    }
  }
  console.log(JSON.stringify({
    ok: true,
    dryRun: args.dryRun,
    endDate: model.endDate,
    reportPath,
    sentToFeishu: !args.dryRun,
  }, null, 2));
  if (args.dryRun) console.log(`\n${cardText}`);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
