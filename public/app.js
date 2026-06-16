const D_STAGES = Array.from({ length: 10 }, (_, index) => `D${index + 4}`);
const LIFECYCLE_STAGES = ["待接量", "接量期", "行课期", "转化期", "追单期", "已封板", "未匹配"];
const WEEKDAYS = [
  { value: 1, label: "周一" },
  { value: 2, label: "周二" },
  { value: 3, label: "周三" },
  { value: 4, label: "周四" },
  { value: 5, label: "周五" },
  { value: 6, label: "周六" },
  { value: 0, label: "周日" },
];
const DEFAULT_INTAKE_RULES = [
  {
    id: "standard_3_5",
    name: "标准3.5天切量",
    allocation: "hourly",
    isDefault: true,
    entries: [
      { openWeekday: 1, startWeekday: 3, startTime: "10:00", endWeekday: 6, endTime: "22:00" },
      { openWeekday: 4, startWeekday: 6, startTime: "22:00", endWeekday: 3, endTime: "10:00" },
    ],
  },
];
const DEFAULT_TEAM_MAPPINGS = [
  { ownerName: "汪国炳", teamName: "BD1" },
  { ownerName: "孙晓迪", teamName: "BD2" },
  { ownerName: "卢宁", teamName: "APP" },
  { ownerName: "杜思博", teamName: "BD1" },
  { ownerName: "李博伟", teamName: "BD2" },
  { ownerName: "齐海洋1", teamName: "私域" },
  { ownerName: "李聿为", teamName: "BD1" },
  { ownerName: "郭庆函", teamName: "BD2" },
  { ownerName: "张艺珂", teamName: "BD2" },
  { ownerName: "王阿芳-投放", teamName: "私域" },
  { ownerName: "赵智勇2", teamName: "BD2" },
  { ownerName: "李俊超", teamName: "BD2" },
  { ownerName: "李云霞", teamName: "直播" },
  { ownerName: "李振亮", teamName: "BD2" },
  { ownerName: "刘检华", teamName: "BD1" },
  { ownerName: "任磬语", teamName: "待填写" },
  { ownerName: "马宇2", teamName: "私域" },
];
const STORAGE_KEY = "calligraphy_campaign_dashboard_config_v1";
const IS_STANDALONE = window.DASHBOARD_STANDALONE || window.location.protocol === "file:";
const DEFAULT_CONFIG = {
  projectName: "书法",
  channels: [
    { id: "bd1", name: "BD1" },
    { id: "paid", name: "信息流" },
    { id: "private", name: "私域" },
    { id: "other", name: "其他" },
  ],
  subchannels: [
    { id: "bd1_books", channelId: "bd1", name: "BD1-图书" },
    { id: "bd1_free", channelId: "bd1", name: "BD1-0元" },
    { id: "paid_mix", channelId: "paid", name: "信息流-混合" },
    { id: "miniapp", channelId: "private", name: "小程序" },
    { id: "wecom", channelId: "private", name: "企微析出" },
  ],
  teachers: [
    { code: "BZ", name: "白止" },
    { code: "ST", name: "ST" },
  ],
  leadTargets: [],
  rTemplates: [],
  campaigns: [],
  actualCampaigns: [],
  studioMappings: DEFAULT_TEAM_MAPPINGS,
  intakeRules: DEFAULT_INTAKE_RULES,
  budgetSnapshots: [],
  predictionSnapshots: [],
  settings: {
    gmvDanger: 80,
    leadsLow: 80,
    leadsHigh: 120,
    leadsGoodLow: 90,
    leadsGoodHigh: 110,
  },
};

const state = {
  data: null,
  config: null,
  generated: { campaigns: [], daily: {} },
  view: "overview",
  targetMonth: formatLocalDay(new Date()).slice(0, 7),
  dailyMonth: "",
  overviewMonth: "",
  predictionMonth: "",
  predictionScenario: {},
  revenueOverviewByMonth: {},
  revenueOverviewLoading: {},
  revenueSyncing: false,
  revenueCalendarWeekStart: "",
  selectedRevenueDate: "",
  selectedRevenueCampaign: "",
  lastPredictionReport: "",
  configTab: "campaigns",
  planTab: "analysis",
  expandedCampaignBudgetRows: [],
  campaignBudgetEditMode: false,
  campaignBudgetDraft: {},
  selectedBudgetCampaigns: [],
  selectedBudgetSubRows: [],
  builderMonth: "",
  builderSort: "desc",
  selectedBuilderCampaigns: [],
  campaignSubSyncOpen: false,
  campaignSubSyncAll: false,
  campaignSubSyncCampaigns: [],
  campaignSubSyncSubs: [],
  channelAnalysis: null,
  channelAnalysisSelected: { level: "all", key: "全部" },
  channelAnalysisMetric: "leads",
  channelAnalysisMetrics: ["leads"],
  channelAnalysisTab: "analysis",
  channelAnalysisPerspective: "studio",
  channelAnalysisCompareKeys: [],
  channelAnalysisChartZoom: 1,
  channelAnalysisHighlightColor: "#e11d48",
  channelAnalysisHighlights: [],
  channelAnalysisActiveHighlight: null,
  channelAnalysisHighlightSeriesKey: "",
  channelAnalysisBotLogs: [],
  channelAnalysisBreakdownSelection: null,
};
const OPERATION_SESSION_ID = id("session");

const titles = {
  overview: ["经营进度总览", "按月、周、日营收目标、实际和达标率，并进行问题分析和建议，自动更新"],
  plan: ["计划中心", "查看预算拆解、快照变化和营期预算核对。"],
  config: ["配置中心", "维护基础配置、营期规则、流量规划和转化目标。"],
  calendarTargets: ["预算中心", "按日期、按子渠道手填每日 Leads 目标，并模拟月度预算。"],
  prediction: ["营收日历", "按未来自然日、营期、子渠道和D阶段推演收入。"],
  channelAnalysis: ["投放分析", "按开课日期、工作室、负责人、业务分类和渠道号查看投放走势。"],
  rTemplates: ["R值目标", "按子渠道配置 D4-D13 目标R值，新建营期自动套用。"],
  builder: ["建期中心", "按开课日、接量日期和子渠道生成标准营期名称。"],
  campaigns: ["营期监控", "按营期查看目标、实际、ROI 和 R值。"],
  daily: ["每日进度", "按自然日追踪 Leads 和 GMV 目标达成，支持子渠道筛选。"],
  channels: ["渠道分类", "看清不同渠道、分类的投入产出表现。"],
};

function id(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
}

function fmtNumber(value, digits = 0) {
  const n = Number(value || 0);
  return n.toLocaleString("zh-CN", { maximumFractionDigits: digits, minimumFractionDigits: digits });
}

function fmtMoney(value) {
  return fmtNumber(value);
}

function fmtGmvPlain(value) {
  return fmtNumber(value);
}

function fmtPct(value) {
  return `${Math.round(Number(value || 0) * 100)}%`;
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

function pct(numerator, denominator) {
  return Number(denominator || 0) ? Number(numerator || 0) / Number(denominator || 0) : 0;
}

function metricNumber(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return value;
  const text = String(value).trim().replace(/,/g, "");
  if (!text) return 0;
  if (text.endsWith("%")) return Number(text.slice(0, -1)) / 100 || 0;
  return Number(text) || 0;
}

function toDay(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function parseLocalDay(day) {
  const [year, month, date] = String(day).slice(0, 10).split("-").map(Number);
  return new Date(year, month - 1, date);
}

function formatLocalDay(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(day, count) {
  const date = parseLocalDay(day);
  date.setDate(date.getDate() + count);
  return formatLocalDay(date);
}

function daysBetween(start, end) {
  const result = [];
  if (!start || !end) return result;
  let current = toDay(start);
  while (current <= end) {
    result.push(current);
    current = addDays(current, 1);
  }
  return result;
}

function dayDiff(start, end) {
  const startDate = parseLocalDay(start);
  const endDate = parseLocalDay(end);
  return Math.round((endDate - startDate) / 86400000);
}

function weekdayOf(day) {
  return parseLocalDay(day).getDay();
}

function weekdayLabel(day) {
  const weekday = WEEKDAYS.find((item) => item.value === weekdayOf(day));
  return weekday?.label || "";
}

function weekdayShortLabel(day) {
  return weekdayLabel(day).replace("周", "");
}

function withWeekday(day) {
  return day ? `${day}（${weekdayLabel(day)}）` : "-";
}

function normalizeTime(value, fallback = "00:00") {
  const text = String(value || "").trim();
  return /^\d{2}:\d{2}$/.test(text) ? text : fallback;
}

function dateTimeValue(day, time) {
  return day ? `${day}T${normalizeTime(time)}` : "";
}

function dateTimeLabel(value) {
  if (!value) return "-";
  const [day, time = "00:00"] = String(value).split("T");
  return `${withWeekday(day)} ${time.slice(0, 5)}`;
}

function parseLocalDateTime(value) {
  const [day, time = "00:00"] = String(value || "").split("T");
  const [year, month, date] = day.split("-").map(Number);
  const [hour, minute] = time.slice(0, 5).split(":").map(Number);
  return new Date(year, month - 1, date, hour || 0, minute || 0, 0, 0);
}

function configuredWeekdayBefore(openDate, targetWeekday) {
  const openWeekday = weekdayOf(openDate);
  let diff = (openWeekday - Number(targetWeekday) + 7) % 7;
  if (diff === 0) diff = 7;
  return addDays(openDate, -diff);
}

function defaultIntakeRules() {
  return clone(DEFAULT_INTAKE_RULES);
}

function ruleEntryForOpenDate(rule, openDate) {
  return (rule?.entries || []).find((entry) => Number(entry.openWeekday) === weekdayOf(openDate));
}

function intakeRuleLabel(rule) {
  return rule ? `${rule.name}${rule.isDefault ? "（默认）" : ""}` : "自定义接量日期";
}

function ruleBasedIntakeRange(openDate, ruleId) {
  const rule = (state.config.intakeRules || []).find((item) => item.id === ruleId);
  const entry = ruleEntryForOpenDate(rule, openDate);
  if (!openDate || !entry) return null;
  const intakeStart = configuredWeekdayBefore(openDate, entry.startWeekday);
  const intakeEnd = configuredWeekdayBefore(openDate, entry.endWeekday);
  return {
    intakeRuleId: rule.id,
    intakeStart,
    intakeEnd,
    intakeStartDateTime: dateTimeValue(intakeStart, entry.startTime),
    intakeEndDateTime: dateTimeValue(intakeEnd, entry.endTime),
  };
}

function inferredIntakeRange(openDate) {
  if (!openDate) return { intakeStart: "", intakeEnd: "" };
  const weekday = weekdayOf(openDate);
  const startOffset = weekday === 1 ? -4 : -3;
  return {
    intakeStart: addDays(openDate, startOffset),
    intakeEnd: addDays(openDate, -1),
  };
}

function nextOpenDatesByWeekdays(startDay, count, weekdays) {
  const dates = [];
  if (!startDay || !count || !weekdays.length) return dates;
  let cursor = startDay;
  let guard = 0;
  while (dates.length < count && guard < 370) {
    if (weekdays.includes(weekdayOf(cursor))) {
      dates.push(cursor);
    }
    cursor = addDays(cursor, 1);
    guard += 1;
  }
  return dates;
}

function stageFor(openDate, currentDate) {
  if (!openDate || !currentDate) return "";
  const open = parseLocalDay(openDate);
  const current = parseLocalDay(currentDate);
  const delta = Math.round((current - open) / 86400000);
  if (delta >= 0) return `D${delta + 1}`;
  return delta === -1 ? "D0" : `D${delta + 1}`;
}

function displayDx(stage) {
  const text = String(stage || "");
  const positive = text.match(/^D(\d+)$/);
  if (positive && Number(positive[1]) >= 14) return `${text}（已封板）`;
  const negative = text.match(/^D(-?\d+)$/);
  if (negative && Number(negative[1]) <= 0) {
    return `${text}（开课前${Math.abs(Number(negative[1])) + 1}天）`;
  }
  return stage || "-";
}

function lifecycleStage(campaign, asOf = formatLocalDay(new Date())) {
  if (!campaign?.openDate || !asOf) return campaign?.stage || "未匹配";
  if (campaign.intakeStart && campaign.intakeEnd && asOf >= campaign.intakeStart && asOf <= campaign.intakeEnd) return "接量期";
  if (campaign.intakeStart && asOf < campaign.intakeStart) return "待接量";
  const stage = stageFor(campaign.openDate, asOf);
  const match = stage.match(/^D(-?\d+)$/);
  if (!match) return campaign.stage || "未匹配";
  const day = Number(match[1]);
  if (day < 1) return "待接量";
  if (day <= 3) return "行课期";
  if (day <= 6) return "转化期";
  if (day <= 13) return "追单期";
  return "已封板";
}

function mmdd(day) {
  return String(day || "").slice(5, 7) + String(day || "").slice(8, 10);
}

function campaignName(baseNo, subNo, teacherCode, openDate) {
  return `${state.config.projectName || "书法"}${baseNo}.${subNo}.${teacherCode}.${mmdd(openDate)}`;
}

function campaignPartsFromName(name) {
  const match = String(name || "").match(/^(.+?)(\d+)\.(\d+)\.([^.]+)\.(\d{4})$/);
  if (!match) return {};
  return {
    baseNo: Number(match[2]),
    subNo: Number(match[3]),
    teacherCode: match[4],
  };
}

function targetMap() {
  const map = new Map();
  for (const item of state.config.leadTargets || []) {
    map.set(`${item.date}|${item.subchannelId}`, Number(item.leads || 0));
  }
  return map;
}

function targetWeightForDay(campaign, day) {
  if (!campaign.intakeStartDateTime || !campaign.intakeEndDateTime) {
    return day >= campaign.intakeStart && day <= campaign.intakeEnd ? 1 : 0;
  }
  const windowStart = parseLocalDateTime(campaign.intakeStartDateTime);
  const windowEnd = parseLocalDateTime(campaign.intakeEndDateTime);
  const dayStart = parseLocalDateTime(`${day}T00:00`);
  const dayEnd = parseLocalDateTime(`${day}T24:00`);
  const overlapMs = Math.max(0, Math.min(windowEnd, dayEnd) - Math.max(windowStart, dayStart));
  return overlapMs / 86400000;
}

function campaignIntakeDays(campaign) {
  return daysBetween(campaign.intakeStart, campaign.intakeEnd)
    .map((day) => ({ day, weight: targetWeightForDay(campaign, day) }))
    .filter((item) => item.weight > 0);
}

function rMap(campaign = null) {
  const map = new Map();
  for (const item of state.config.rTemplates || []) {
    map.set(`${item.subchannelId}|${item.stage}`, Number(item.rValue || 0));
  }
  for (const item of campaign?.rOverrides || []) {
    map.set(`${item.subchannelId}|${item.stage}`, Number(item.rValue || 0));
  }
  return map;
}

function targetRStage(stage) {
  const match = String(stage || "").match(/^D(\d+)$/);
  if (!match) return "";
  const day = Number(match[1]);
  if (day > 13) return "D13";
  return D_STAGES.includes(stage) ? stage : "";
}

function campaignTargetShareMap(campaigns) {
  const groups = new Map();
  campaigns.forEach((campaign) => {
    const key = campaign.openDate || campaign.name;
    groups.set(key, (groups.get(key) || 0) + 1);
  });
  return new Map(campaigns.map((campaign) => {
    const key = campaign.openDate || campaign.name;
    return [campaign.name, 1 / Math.max(groups.get(key) || 1, 1)];
  }));
}

function getTarget(date, subchannelId) {
  return Number((state.config.leadTargets || []).find((x) => x.date === date && x.subchannelId === subchannelId)?.leads || 0);
}

function setTarget(date, subchannelId, leads) {
  state.config.leadTargets = state.config.leadTargets || [];
  const existing = state.config.leadTargets.find((x) => x.date === date && x.subchannelId === subchannelId);
  if (existing) {
    existing.leads = Number(leads || 0);
  } else {
    state.config.leadTargets.push({ date, subchannelId, leads: Number(leads || 0) });
  }
}

function computeCampaignTargets(asOf = null) {
  const targets = targetMap();
  const subById = Object.fromEntries((state.config.subchannels || []).map((item) => [item.id, item]));
  const campaigns = planningCampaigns();
  const shareByName = campaignTargetShareMap(campaigns);
  const computed = campaigns.map((campaign) => {
    const stage = stageFor(campaign.openDate, asOf || campaign.openDate);
    const rStage = targetRStage(stage);
    const rValues = rMap(campaign);
    const intakeDays = campaignIntakeDays(campaign);
    const targetShare = shareByName.get(campaign.name) || 1;
    const subTargets = (campaign.subchannelIds || []).map((subId) => {
      const leads = intakeDays.reduce((sum, item) => sum + Number(targets.get(`${item.day}|${subId}`) || 0) * item.weight, 0) * targetShare;
      const rValue = rStage ? Number(rValues.get(`${subId}|${rStage}`) || 0) : 0;
      return {
        subchannelId: subId,
        subchannelName: subById[subId]?.name || subId,
        targetLeads: leads,
        targetR: rValue,
        targetGmv: leads * rValue,
      };
    });
    const totalLeads = subTargets.reduce((sum, item) => sum + item.targetLeads, 0);
    const weightedR = pct(subTargets.reduce((sum, item) => sum + item.targetLeads * item.targetR, 0), totalLeads);
    return {
      ...campaign,
      stage,
      lifecycleStage: lifecycleStage(campaign, asOf || formatLocalDay(new Date())),
      targetShare,
      subTargets,
      targetLeads: totalLeads,
      targetR: weightedR,
      targetGmv: totalLeads * weightedR,
    };
  });
  return applyActualCampaigns(computed);
}

function normalizeActualCampaign(row) {
  const name = row.name || row.campaignName || row["营期"] || row["营期名"] || row["营期名称"];
  if (!name) return null;
  const leads = metricNumber(row.actualLeads ?? row.leads ?? row["leads数"] ?? row["Leads"] ?? row["实际Leads"] ?? row["实际leads"]);
  const gmv = metricNumber(row.actualGmv ?? row.gmv ?? row["gmv"] ?? row["GMV"] ?? row["实际GMV"] ?? row["实际gmv"]);
  const spend = metricNumber(row.spend ?? row["消耗"]);
  const fullPriceStudents = metricNumber(row.fullPriceStudents ?? row["正价课学员数"] ?? row["正价学员数"]);
  const importedR = metricNumber(row.rValue ?? row["累计R值"]);
  const importedRoi = metricNumber(row.roi ?? row.ROI);
  const importedConversion = metricNumber(row.conversionRate ?? row["转化率"]);
  return {
    name: String(name).trim(),
    actualLeads: leads,
    actualGmv: gmv,
    spend,
    fullPriceStudents,
    categories: row.categories || row["分类"] || "",
    openDate: row.openDate || row["开课日期"] || "",
    closeDate: row.closeDate || row["封板日期"] || "",
    stage: row.stage || row["营期阶段"] || "",
    rValue: importedR || pct(gmv, leads),
    roi: importedRoi || pct(gmv, spend),
    conversionRate: importedConversion,
    actualSubchannels: row.actualSubchannels || [],
    studioTotals: row.studioTotals || [],
    rBreakdown: row.rBreakdown || {},
    source: row.source || "导入",
  };
}

function actualCampaignMap() {
  return new Map((state.config.actualCampaigns || [])
    .map(normalizeActualCampaign)
    .filter(Boolean)
    .map((item) => [item.name, item]));
}

function actualStage(actual) {
  if (actual.openDate) return stageFor(actual.openDate, formatLocalDay(new Date()));
  return actual.stage || "";
}

function rBreakdownFromRow(row) {
  return Object.fromEntries(D_STAGES.map((stage) => {
    const key = `${stage.toLowerCase()}_R值`;
    return [`${stage}-R值`, metricNumber(row[key] ?? row[`${stage}_R值`] ?? row[`${stage}-R值`])];
  }).filter(([, value]) => value));
}

function normalizeActualSubchannel(row) {
  return {
    studio: row["工作室"] || "",
    category: row["分类"] || row.categories || "",
    actualLeads: metricNumber(row["leads数"] ?? row.actualLeads ?? row.leads),
    actualGmv: metricNumber(row.GMV ?? row.gmv ?? row.actualGmv),
    spend: metricNumber(row["消耗"] ?? row.spend),
    rValue: metricNumber(row["累计R值"] ?? row.rValue),
    roi: metricNumber(row.ROI ?? row.roi),
    conversionRate: metricNumber(row["转化率"] ?? row.conversionRate),
    rBreakdown: rBreakdownFromRow(row),
  };
}

function groupNativeActualRows(rows) {
  if (!rows.some((row) => "工作室" in row && "分类" in row && "营期" in row)) return rows;
  const groups = new Map();
  for (const row of rows) {
    const name = String(row["营期"] || "").trim();
    if (!name) continue;
    if (!groups.has(name)) groups.set(name, { aggregate: null, subchannels: [], studioTotals: [] });
    const group = groups.get(name);
    const studio = String(row["工作室"] || "").trim();
    const category = String(row["分类"] || "").trim();
    if (studio === "营期汇总" && category === "-") {
      group.aggregate = row;
    } else if (category === "工作室汇总") {
      group.studioTotals.push(normalizeActualSubchannel(row));
    } else {
      group.subchannels.push(normalizeActualSubchannel(row));
    }
  }
  return [...groups.entries()].map(([name, group]) => {
    const aggregate = group.aggregate || { "营期": name };
    return {
      ...aggregate,
      name,
      actualSubchannels: group.subchannels,
      studioTotals: group.studioTotals,
      categories: group.subchannels.map((item) => item.category).filter(Boolean).join("、"),
      rBreakdown: rBreakdownFromRow(aggregate),
      source: "营期渠道数据统计",
    };
  });
}

function applyActualCampaigns(campaigns) {
  const actuals = actualCampaignMap();
  return (campaigns || []).map((campaign) => {
    const actual = actuals.get(campaign.name);
    if (!actual) return campaign;
    const actualLeads = Number(actual.actualLeads || 0);
    const actualGmv = Number(actual.actualGmv || 0);
    const spend = Number(actual.spend || 0);
    const fullPriceStudents = Number(actual.fullPriceStudents || 0);
    return {
      ...campaign,
      ...actual,
      stage: campaign.stage || actual.stage,
      lifecycleStage: campaign.lifecycleStage || lifecycleStage(campaign),
      actualImported: true,
      leads: actualLeads,
      gmv: actualGmv,
      actualLeads,
      actualGmv,
      spend,
      fullPriceStudents,
      conversionRate: actual.conversionRate || pct(fullPriceStudents, actualLeads),
      roi: actual.roi || pct(actualGmv, spend),
      rValue: actual.rValue || pct(actualGmv, actualLeads),
      targetLeadsRate: pct(actualLeads, campaign.targetLeads),
      targetGmvRate: pct(actualGmv, campaign.targetGmv),
    };
  });
}

function campaignSource() {
  const planned = state.data?.campaigns?.length
    ? state.data.campaigns
    : computeCampaignTargets(state.data?.overview?.latestDate || formatLocalDay(new Date()));
  const merged = applyActualCampaigns(planned);
  const plannedNames = new Set(merged.map((item) => item.name));
  const unmatched = [...actualCampaignMap().values()]
    .filter((item) => !plannedNames.has(item.name))
    .map((item) => ({
      ...item,
      actualImported: true,
      unmatchedPlan: true,
      stage: actualStage(item),
      lifecycleStage: lifecycleStage(item),
      targetLeads: 0,
      targetR: 0,
      targetGmv: 0,
      targetLeadsRate: 0,
      targetGmvRate: 0,
    }));
  return [...merged, ...unmatched];
}

function settings() {
  return state.config?.settings || {};
}

function rateStatus(rate, type = "leads") {
  const cfg = settings();
  const value = Number(rate || 0) * 100;
  if (!value) return "empty";
  if (type === "gmv") return value < Number(cfg.gmvDanger || 80) ? "danger" : value >= 100 ? "good" : "warn";
  if (value < Number(cfg.leadsLow || 80) || value > Number(cfg.leadsHigh || 120)) return "danger";
  if (value >= Number(cfg.leadsGoodLow || 90) && value <= Number(cfg.leadsGoodHigh || 110)) return "good";
  return "warn";
}

function rStatus(label, value) {
  const threshold = Number((state.config.rTemplates || []).find((x) => x.stage === label)?.rValue || 0);
  if (!threshold || !Number(value)) return "empty";
  return Number(value) >= threshold ? "good" : "danger";
}

function statusLabel(status) {
  return { good: "正常", warn: "关注", danger: "异常", empty: "无数据" }[status] || status;
}

async function fetchJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "请求失败");
  return payload;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeConfig(config) {
  const normalized = { ...clone(DEFAULT_CONFIG), ...(config || {}) };
  normalized.intakeRules = Array.isArray(normalized.intakeRules) && normalized.intakeRules.length
    ? normalized.intakeRules
    : defaultIntakeRules();
  normalized.studioMappings = Array.isArray(normalized.studioMappings) && normalized.studioMappings.length
    ? normalized.studioMappings
    : Array.isArray(normalized.teamMappings) && normalized.teamMappings.length
      ? normalized.teamMappings
    : clone(DEFAULT_TEAM_MAPPINGS);
  delete normalized.teamMappings;
  return normalized;
}

function configSummary(config = state.config) {
  return {
    leadTargets: config?.leadTargets?.length || 0,
    rTemplates: config?.rTemplates?.length || 0,
    campaigns: config?.campaigns?.length || 0,
    actualCampaigns: config?.actualCampaigns?.length || 0,
    intakeRules: config?.intakeRules?.length || 0,
    budgetSnapshots: config?.budgetSnapshots?.length || 0,
  };
}

function logOperation(action, detail = {}) {
  const payload = {
    action,
    detail,
    sessionId: OPERATION_SESSION_ID,
    view: state.view,
    path: window.location.pathname,
    clientTime: new Date().toISOString(),
    config: configSummary(),
  };
  if (IS_STANDALONE) {
    console.info("operation-log", payload);
    return;
  }
  const body = JSON.stringify(payload);
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/operation-log", new Blob([body], { type: "application/json" }));
      return;
    }
  } catch (error) {
    console.warn("operation log beacon failed", error);
  }
  fetch("/api/operation-log", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch((error) => console.warn("operation log failed", error));
}

function channelBotMessage(action, detail = {}) {
  if (action === "select") return `点击下钻：${detail.label || "全部"}`;
  if (action === "compare") return `更新对比：${detail.labels?.length ? detail.labels.join("、") : "未选择对比"}`;
  if (action === "metric") return `切换指标：${detail.metrics?.join("、") || "Leads"}`;
  if (action === "perspective") return `切换视角：${detail.perspective === "channel" ? "按渠道" : "按工作室"}`;
  if (action === "highlight_series") return `标记线条：${detail.series || "未选择"}`;
  if (action === "highlight_point") return `选择波段点：${detail.series || ""} 第 ${Number(detail.index || 0) + 1} 个点`;
  if (action === "highlight_color") return `应用波段颜色：${detail.color || ""}`;
  if (action === "zoom") return `缩放折线图：${detail.zoom || "100%"}`;
  if (action === "import") return `导入投放数据：${detail.rows || 0} 行`;
  if (action === "breakdown_manual") return `下一级拆解改为手动范围：${detail.label || "全部"}`;
  if (action === "breakdown_auto") return `下一级拆解恢复自动跟随：${detail.label || "当前路径"}`;
  return detail.message || action;
}

function pushChannelBotLog(action, detail = {}) {
  const entry = {
    action,
    detail,
    message: channelBotMessage(action, detail),
    time: new Date().toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };
  state.channelAnalysisBotLogs = [entry, ...(state.channelAnalysisBotLogs || [])].slice(0, 8);
  logOperation(`channel_analysis_${action}`, detail);
  renderChannelBot();
}

function renderChannelBot() {
  const box = document.getElementById("channelAnalysisBot");
  if (!box) return;
  const metrics = selectedChannelMetrics().map((metric) => CHANNEL_ANALYSIS_METRICS[metric]?.label || metric);
  const compareLabels = (state.channelAnalysisCompareKeys || [])
    .map((key) => channelAnalysisSelectionLabel(decodeChannelNode(key)))
    .filter(Boolean);
  const logs = state.channelAnalysisBotLogs || [];
  box.innerHTML = `
    <h3>分析记录机器人</h3>
    <p>当前：${escapeHtml(channelAnalysisSelectionLabel())} · ${metrics.map(escapeHtml).join(" / ") || "Leads"}</p>
    <p>对比：${compareLabels.length ? compareLabels.map(escapeHtml).join("、") : "未选择"}</p>
    <ul>
      ${logs.length ? logs.map((item) => `
        <li><time>${escapeHtml(item.time)}</time>${escapeHtml(item.message)}</li>
      `).join("") : `<li><time>--:--:--</time>等待你在投放分析页操作。</li>`}
    </ul>
  `;
}

function configDataScore(config) {
  return Number(config?.leadTargets?.length || 0)
    + Number(config?.rTemplates?.length || 0) * 10
    + Number(config?.actualCampaigns?.length || 0) * 20
    + Number(config?.campaigns?.length || 0) * 20;
}

async function loadConfig() {
  if (IS_STANDALONE) {
    const saved = localStorage.getItem(STORAGE_KEY);
    const savedConfig = saved ? normalizeConfig(JSON.parse(saved)) : null;
    const initialConfig = window.DASHBOARD_INITIAL_CONFIG ? normalizeConfig(window.DASHBOARD_INITIAL_CONFIG) : null;
    state.config = savedConfig || initialConfig || normalizeConfig(DEFAULT_CONFIG);
    if (initialConfig && configDataScore(initialConfig) > configDataScore(state.config)) {
      state.config = initialConfig;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.config));
    }
    await loadGeneratedTargets();
    return;
  }
  state.config = normalizeConfig(await fetchJson("/api/config"));
  await loadGeneratedTargets();
}

async function saveConfig() {
  const before = configSummary();
  if (IS_STANDALONE) {
    state.config = normalizeConfig(state.config);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.config));
    await loadGeneratedTargets();
    logOperation("save_config", { before, after: configSummary(), mode: "standalone" });
    return;
  }
  state.config = normalizeConfig(await fetchJson("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(state.config),
  }));
  await loadGeneratedTargets();
  logOperation("save_config", { before, after: configSummary(), mode: "service" });
}

async function loadGeneratedTargets() {
  if (IS_STANDALONE) {
    state.generated = { campaigns: computeCampaignTargets(formatLocalDay(new Date())), daily: {} };
    return;
  }
  state.generated = await fetchJson("/api/generated-targets");
}

function setView(view) {
  state.view = view;
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  document.querySelectorAll(".view").forEach((item) => item.classList.toggle("active", item.id === view));
  const [title, subtitle] = titles[view] || titles.overview;
  document.getElementById("pageTitle").textContent = title;
  document.getElementById("pageSubtitle").textContent = subtitle;
  render();
}

function mountPlanSections() {
  // Plan center now owns only the budget-analysis display. Editing modules live under config tabs.
}

function revenueLatestDate(overview) {
  if (!overview || overview.error) return "";
  if (overview.actualRange?.end) return overview.actualRange.end;
  return (overview.actualRecords || [])
    .filter((row) => Number(row.amount || 0) !== 0 || Number(row.rowCount || 0) > 0)
    .map((row) => row.date)
    .sort()
    .at(-1) || "";
}

function formatSyncClock(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("zh-CN", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function updateMeta() {
  const overviewMonth = selectedOverviewMonth();
  const revenueOverview = state.view === "overview" ? state.revenueOverviewByMonth[overviewMonth] : null;
  const latestDate = revenueLatestDate(revenueOverview) || state.data?.overview?.latestDate || derivedOverview().latestDate;
  const syncClock = revenueOverview && !revenueOverview.error ? formatSyncClock(revenueOverview.actualSyncedAt) : "";
  const latestText = latestDate ? `最新数据：${latestDate}${syncClock ? ` ${syncClock}` : ""}` : "未加载实际";
  const pageSubtitle = document.getElementById("pageSubtitle");
  const pageTitle = document.getElementById("pageTitle");
  const latestDateEl = document.getElementById("latestDate");
  const sheetCountEl = document.getElementById("sheetCount");
  pageTitle.textContent = (titles[state.view] || titles.overview)[0];
  if (state.view === "overview") {
    pageSubtitle.innerHTML = `${escapeHtml(titles.overview[1])}<span class="inline-meta-tag">${escapeHtml(latestText)}</span>`;
    latestDateEl.style.display = "none";
    sheetCountEl.style.display = "none";
  } else {
    pageSubtitle.textContent = (titles[state.view] || titles.overview)[1];
    latestDateEl.style.display = "";
    sheetCountEl.style.display = "";
    latestDateEl.textContent = latestText;
    sheetCountEl.textContent = `${state.config?.actualCampaigns?.length || 0} 个实际营期`;
  }
}

function kpi(label, value, sub, status = "empty") {
  return `
    <article class="kpi">
      <label>${label}<span class="status ${status}">${statusLabel(status)}</span></label>
      <strong>${value}</strong>
      <small>${sub}</small>
    </article>
  `;
}

function tripleKpi(label, target, actual, estimate, formatter, status = "empty") {
  return `
    <article class="kpi triple-kpi">
      <label>${label}<span class="status ${status}">${statusLabel(status)}</span></label>
      <div class="triple-values">
        <div>
          <span>目标</span>
          <strong>${formatter(target)}</strong>
        </div>
        <div>
          <span>实际</span>
          <strong class="actual">${formatter(actual)}</strong>
        </div>
        <div>
          <span>预估</span>
          <strong class="estimate">${formatter(estimate)}</strong>
        </div>
      </div>
    </article>
  `;
}

function availableMonths() {
  const months = new Set();
  (state.config.leadTargets || []).forEach((item) => {
    if (item.date) months.add(item.date.slice(0, 7));
  });
  computeDailyRows().forEach((row) => {
    if (row.date) months.add(row.date.slice(0, 7));
  });
  campaignSource().forEach((campaign) => {
    if (campaign.openDate) months.add(campaign.openDate.slice(0, 7));
  });
  return [...months].sort();
}

function selectedOverviewMonth() {
  const months = availableMonths();
  const currentMonth = formatLocalDay(new Date()).slice(0, 7);
  if (!state.overviewMonth && months.includes(currentMonth)) state.overviewMonth = currentMonth;
  if (!state.overviewMonth && months.length) state.overviewMonth = months.at(-1);
  return state.overviewMonth || formatLocalDay(new Date()).slice(0, 7);
}

function monthLeadTargetTotal(month) {
  return (state.config.leadTargets || [])
    .filter((item) => item.date?.startsWith(month))
    .reduce((sum, item) => sum + Number(item.leads || 0), 0);
}

function monthBounds(month) {
  const days = monthDays(month);
  return { start: days[0], end: days.at(-1), days };
}

function latestBudgetSnapshot(month) {
  return (state.config.budgetSnapshots || [])
    .filter((item) => item.month === month)
    .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0))[0] || null;
}

function addBudgetBucket(breakdown, key, campaign, leads, targetGmv, sourceLabel, conversionInMonth) {
  breakdown[key].leads += leads;
  breakdown[key].targetGmv += targetGmv;
  breakdown[key].campaigns.push(campaign.name);
  breakdown[key].details.push({
    name: campaign.name,
    openDate: campaign.openDate,
    intakeStart: campaign.intakeStart,
    intakeEnd: campaign.intakeEnd,
    intakeStartDateTime: campaign.intakeStartDateTime,
    intakeEndDateTime: campaign.intakeEndDateTime,
    leads,
    targetGmv,
    sourceLabel,
    conversionStages: conversionInMonth.map((item) => `${item.stage}/${item.date}`),
  });
}

function campaignConversionDays(campaign) {
  return D_STAGES.map((stage) => ({
    stage,
    date: addDays(campaign.openDate, Number(stage.slice(1)) - 1),
  }));
}

function computeBudgetAnalysis(month, options = {}) {
  const useActuals = options.useActuals !== false;
  const { start, end, days } = monthBounds(month);
  const campaigns = planningCampaigns();
  const actuals = actualCampaignMap();
  const subById = Object.fromEntries((state.config.subchannels || []).map((sub) => [sub.id, sub]));
  const shareByName = campaignTargetShareMap(campaigns);
  const rByCampaign = new Map(campaigns.map((campaign) => [campaign.name, rMap(campaign)]));
  const targetByDaySub = targetMap();
  const monthTargetLeads = monthLeadTargetTotal(month);
  const breakdown = {
    carryIn: { label: "上月转入", leads: 0, targetGmv: 0, campaigns: [], details: [] },
    fullUse: { label: "本月完全使用", leads: 0, targetGmv: 0, campaigns: [], details: [] },
    partialUse: { label: "本月部分使用", leads: 0, targetGmv: 0, campaigns: [], details: [] },
    flowNext: { label: "本月流向下月", leads: 0, targetGmv: 0, campaigns: [], details: [] },
  };
  const conversionCoverage = new Map(days.map((day) => [day, 0]));
  const intakeCoverage = new Map();
  const red = [];
  const yellow = [];
  const green = [];
  const unmatchedTargets = [];
  const missingConversionDays = [];
  let targetGmv = 0;
  let campaignCount = 0;
  let rTargetTotal = 0;

  days.forEach((day) => {
    (state.config.subchannels || []).forEach((sub) => {
      if (Number(targetByDaySub.get(`${day}|${sub.id}`) || 0) > 0) {
        intakeCoverage.set(`${day}|${sub.id}`, false);
      }
    });
  });

  if (!campaigns.length) {
    red.push("没有已建立营期，Leads 目标无法关联到转化目标。");
  }

  campaigns.forEach((campaign) => {
    const actual = useActuals ? actuals.get(campaign.name) : null;
    const intakeDays = campaignIntakeDays(campaign);
    const conversionDays = campaignConversionDays(campaign);
    const conversionInMonth = conversionDays.filter((item) => item.date >= start && item.date <= end);
    const intakeInMonth = intakeDays.some((item) => item.day >= start && item.day <= end);
    const d13 = campaign.openDate ? addDays(campaign.openDate, 12) : "";
    if ((campaign.intakeStart && campaign.intakeEnd && campaign.intakeEnd >= start && campaign.intakeStart <= end)
      || (campaign.openDate && d13 >= start && campaign.openDate <= end)) {
      campaignCount += 1;
      const budgetSubRows = campaignBudgetSubRows(campaign, shareByName.get(campaign.name) || 1, actuals.get(campaign.name));
      rTargetTotal += D_STAGES.reduce((sum, stage) => sum + campaignStageRValue(campaign, stage, budgetSubRows), 0);
    }
    const intakeBeforeMonth = campaign.intakeStart && campaign.intakeStart < start;
    let subLeads = campaignLeadsBySubchannel(campaign, shareByName.get(campaign.name) || 1);
    const plannedLeads = subLeads.reduce((sum, item) => sum + item.leads, 0);
    const actualLeads = Number(actual?.actualLeads || 0);
    const sourceLabel = actualLeads ? "实际Leads优先" : "预算Leads";
    if (actualLeads && plannedLeads) {
      subLeads = subLeads.map((item) => ({ ...item, leads: item.leads * (actualLeads / plannedLeads) }));
    }
    const campaignLeads = actualLeads || plannedLeads;
    const rValues = rByCampaign.get(campaign.name);
    let campaignMonthGmv = conversionInMonth.reduce((sum, item) => {
      const actualR = Number(actual?.rBreakdown?.[`${item.stage}-R值`] || 0);
      const dayGmv = actualR
        ? campaignLeads * actualR
        : subLeads.reduce((subSum, sub) => subSum + sub.leads * Number(rValues.get(`${sub.subchannelId}|${item.stage}`) || 0), 0);
      conversionCoverage.set(item.date, Number(conversionCoverage.get(item.date) || 0) + dayGmv);
      return sum + dayGmv;
    }, 0);
    if (!campaignMonthGmv && Number(actual?.actualGmv || 0) && conversionInMonth.length) {
      campaignMonthGmv = Number(actual.actualGmv || 0);
    }
    targetGmv += campaignMonthGmv;

    intakeDays.forEach(({ day }) => {
      (campaign.subchannelIds || []).forEach((subId) => {
        const key = `${day}|${subId}`;
        if (intakeCoverage.has(key)) intakeCoverage.set(key, true);
      });
    });

    if (campaignLeads > 0) {
      if (intakeBeforeMonth && conversionInMonth.length) {
        addBudgetBucket(breakdown, "carryIn", campaign, campaignLeads, campaignMonthGmv, sourceLabel, conversionInMonth);
      } else if (intakeInMonth && conversionInMonth.length === D_STAGES.length) {
        addBudgetBucket(breakdown, "fullUse", campaign, campaignLeads, campaignMonthGmv, sourceLabel, conversionInMonth);
      } else if (intakeInMonth && conversionInMonth.length > 0) {
        addBudgetBucket(breakdown, "partialUse", campaign, campaignLeads, campaignMonthGmv, sourceLabel, conversionInMonth);
      } else if (intakeInMonth) {
        addBudgetBucket(breakdown, "flowNext", campaign, campaignLeads, campaignMonthGmv, sourceLabel, conversionInMonth);
      }
    }

    const missingRBySub = new Map();
    subLeads.filter((item) => item.leads > 0).forEach((sub) => {
      D_STAGES.forEach((stage) => {
        if (!Number(rValues.get(`${sub.subchannelId}|${stage}`) || 0)) {
          if (!missingRBySub.has(sub.subchannelId)) missingRBySub.set(sub.subchannelId, []);
          missingRBySub.get(sub.subchannelId).push(stage);
        }
      });
    });
    if (missingRBySub.size) {
      const detail = [...missingRBySub.entries()].map(([subId, stages]) => {
        const name = subById[subId]?.name || subId;
        const shown = stages.length === D_STAGES.length ? "D4-D13" : stages.join("、");
        return `${name}（${shown}）`;
      }).join("；");
      red.push(`${campaign.name} 有目标Leads但缺少R值：${detail}。若该子渠道本期不用，请在建期中取消该子渠道，或把对应接量日Leads置0。`);
    }
    if (campaign.inferredFromActual) yellow.push(`${campaign.name} 使用历史导入推测接量期，后续以宽表字段为准。`);
    if ((shareByName.get(campaign.name) || 1) < 1) yellow.push(`${campaign.name} 与同期开课小营期平分目标，属于估算分摊。`);
    if (campaignLeads > 0 && conversionInMonth.length > 0 && conversionInMonth.length < D_STAGES.length) {
      yellow.push(`${campaign.name} D4-D13 跨月，本月按部分使用展示。`);
    }
  });

  [...intakeCoverage.entries()].forEach(([key, matched]) => {
    if (matched) return;
    const [date, subchannelId] = key.split("|");
    unmatchedTargets.push({
      date,
      subchannelId,
      subchannelName: subById[subchannelId]?.name || subchannelId,
      leads: Number(targetByDaySub.get(key) || 0),
    });
  });
  const unmatched = unmatchedTargets.length;
  if (unmatched) red.push(`本月有 ${unmatched} 个日期/子渠道 Leads 目标没有命中任何营期接量期。`);
  missingConversionDays.push(...[...conversionCoverage.entries()].filter(([, value]) => !value).map(([day]) => day));
  if (missingConversionDays.length) red.push(`本月有 ${missingConversionDays.length} 天没有 D4-D13 转化目标覆盖。`);
  if (!red.length && !yellow.length) green.push("目标完整：接量期、D4-D13 转化目标和R值均可用于预算判断。");

  const availableLeads = Object.values(breakdown).reduce((sum, item) => sum + item.leads, 0);
  const snapshot = latestBudgetSnapshot(month);
  return {
    month,
    monthTargetLeads,
    availableLeads,
    targetGmv,
    campaignCount,
    rTargetTotal,
    breakdown,
    integrity: { red, yellow, green, unmatchedTargets, missingConversionDays },
    snapshot,
    diff: snapshot ? {
      targetLeads: monthTargetLeads - Number(snapshot.monthTargetLeads || 0),
      availableLeads: availableLeads - Number(snapshot.availableLeads || 0),
      targetGmv: targetGmv - Number(snapshot.targetGmv || 0),
      rTargetTotal: rTargetTotal - Number(snapshot.rTargetTotal || 0),
    } : null,
  };
}

function derivedOverview(month = null) {
  const dailyRows = computeDailyRows();
  const currentMonth = month || selectedOverviewMonth();
  const monthRows = dailyRows.filter((row) => row.date.startsWith(currentMonth));
  const latest = monthRows.filter((row) => row.actualLeads || row.actualGmv || row.targetLeads || row.targetGmv).at(-1) || {};
  const actualLeads = monthRows.reduce((sum, row) => sum + Number(row.actualLeads || 0), 0);
  const actualGmv = monthRows.reduce((sum, row) => sum + Number(row.actualGmv || 0), 0);
  const targetLeads = monthLeadTargetTotal(currentMonth);
  const targetGmv = monthRows.reduce((sum, row) => sum + Number(row.targetGmv || 0), 0);
  return {
    latestDate: latest.date || "",
    todayTargetLeads: latest.targetLeads || 0,
    todayActualLeads: latest.actualLeads || 0,
    todayLeadsRate: pct(latest.actualLeads, latest.targetLeads),
    todayTargetGmv: latest.targetGmv || 0,
    todayActualGmv: latest.actualGmv || 0,
    todayGmvRate: pct(latest.actualGmv, latest.targetGmv),
    monthTargetLeads: targetLeads,
    monthActualLeads: actualLeads,
    monthLeadsRate: pct(actualLeads, targetLeads),
    monthTargetGmv: targetGmv,
    monthActualGmv: actualGmv,
    monthGmvRate: pct(actualGmv, targetGmv),
    warningCount: 0,
  };
}

function overviewEstimatedProgress(month, forecast) {
  const rows = computeDailyRows().filter((row) => row.date.startsWith(month));
  const cutoff = effectiveActualDate(forecast.latestActualDate || "");
  const futureRows = cutoff ? rows.filter((row) => row.date > cutoff) : rows;
  const actualLeads = rows.reduce((sum, row) => sum + Number(row.actualLeads || 0), 0);
  const futureTargetLeads = futureRows.reduce((sum, row) => sum + Number(row.targetLeads || 0), 0);
  return {
    leads: actualLeads + futureTargetLeads,
    gmv: forecast.planForecastGmv,
  };
}

function gaugeKpi(label, rate, value, detail) {
  const clamped = Math.max(0, Math.min(1.2, Number(rate || 0)));
  const angle = 180 * Math.min(clamped, 1);
  return `
    <article class="kpi gauge-kpi">
      <label>${label}<span class="status ${rate >= 1 ? "good" : rate >= 0.8 ? "warn" : "danger"}">${fmtPct(rate)}</span></label>
      <div class="semi-gauge" style="--angle:${angle}deg">
        <div class="semi-gauge-inner"></div>
        <strong>${value}</strong>
      </div>
      <small>${detail}</small>
    </article>
  `;
}

function overviewCalendarPreview(month) {
  const calendar = revenueCalendarData(month, {});
  const busyDays = calendar.days
    .map((day) => ({ day, total: calendar.totals.get(day)?.total || 0, actual: calendar.actualDate && day <= calendar.actualDate }))
    .filter((item) => item.total > 0);
  const maxTotal = Math.max(...busyDays.map((item) => item.total), 1);
  return `
    <div class="mini-calendar">
      ${calendar.days.map((day) => {
        const total = calendar.totals.get(day)?.total || 0;
        const active = total > 0;
        const actual = calendar.actualDate && day <= calendar.actualDate;
        return `<span class="${active ? (actual ? "actual" : "future") : ""}" style="--heat:${active ? Math.max(0.18, total / maxTotal).toFixed(2) : 0}">${day.slice(8)}</span>`;
      }).join("")}
    </div>
    <p class="muted">红色为已发生，绿色为未来推演。点击左侧“营收日历”看完整明细。</p>
  `;
}

function overviewAlerts(targetDiagnostics, budget, forecast, overview, monthCampaigns) {
  const alerts = [];
  if (targetDiagnostics.length) alerts.push(targetDiagnostics[0]);
  if (budget.integrity.red.length) alerts.push(budget.integrity.red[0]);
  if (overview.monthTargetGmv && forecast.planForecastGmv < overview.monthTargetGmv) {
    alerts.push(`本月按规划预估低于 GMV 目标，差额 ${fmtMoney(overview.monthTargetGmv - forecast.planForecastGmv)}。`);
  }
  const riskCampaign = monthCampaigns.find((item) => (item.actualGmv ?? 0) && item.targetGmv && (item.actualGmv / item.targetGmv) < 0.8);
  if (riskCampaign) alerts.push(`${riskCampaign.name} GMV 达成偏低，建议查看营期监控。`);
  if (!alerts.length) alerts.push("当前目标、实际和推演暂无高优先级异常。");
  return alerts.slice(0, 4).map((text, index) => dashboardLine(index ? "提醒" : "优先处理", text)).join("");
}

function fmtAchievementRate(value) {
  return value === null || value === undefined ? "-" : fmtPct(value);
}

async function loadRevenueOverview(month) {
  if (IS_STANDALONE || !month || state.revenueOverviewLoading[month]) return;
  state.revenueOverviewLoading[month] = true;
  try {
    state.revenueOverviewByMonth[month] = await fetchJson(`/api/revenue-overview?month=${encodeURIComponent(month)}`);
  } catch (error) {
    state.revenueOverviewByMonth[month] = { month, error: error.message || "营收数据加载失败" };
  } finally {
    state.revenueOverviewLoading[month] = false;
  }
}

function renderRevenueSyncButton() {
  const button = document.getElementById("revenueSyncButton");
  if (!button) return;
  button.disabled = state.revenueSyncing || IS_STANDALONE;
  button.textContent = state.revenueSyncing ? "更新中..." : "更新 CRM 数据";
}

function revenueSyncErrorMessage(error) {
  const message = error?.message || String(error || "");
  if (/钥匙串|crm-dashboard/i.test(message)) {
    return "CRM 自动登录失败，旧数据已保留。请检查钥匙串里的 CRM 凭据。";
  }
  if (/2000|重新登录|其他设备登录|登录态|token|自动登录/i.test(message)) {
    return "CRM 自动登录失败，旧数据已保留。请手动登录 CRM 后再点击更新。";
  }
  return message || "CRM 数据更新失败，旧数据已保留。";
}

async function syncRevenueFromCrm() {
  if (IS_STANDALONE || state.revenueSyncing) return;
  const month = selectedOverviewMonth();
  state.revenueSyncing = true;
  renderRevenueSyncButton();
  setHint("正在从 CRM 更新营收数据...");
  try {
    const payload = await fetchJson("/api/revenue-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ month }),
    });
    delete state.revenueOverviewByMonth[month];
    await loadRevenueOverview(month);
    renderOverview();
    updateMeta();
    const rangeEnd = payload.range?.end || month;
    const syncClock = formatSyncClock(payload.syncedAt);
    const loginText = payload.loginRefreshed ? "，已自动刷新登录" : "";
    setHint(`CRM 数据已更新：${rangeEnd}${syncClock ? ` ${syncClock}` : ""}${loginText}`);
  } catch (error) {
    const message = revenueSyncErrorMessage(error);
    setHint(message);
    alert(message);
  } finally {
    state.revenueSyncing = false;
    renderRevenueSyncButton();
  }
}

function ensureRevenueOverview(month) {
  if (IS_STANDALONE || state.revenueOverviewByMonth[month] || state.revenueOverviewLoading[month]) return;
  loadRevenueOverview(month).then(() => {
    if (state.view === "overview" && selectedOverviewMonth() === month) {
      renderOverview();
      updateMeta();
    }
  });
}

function daysInMonth(month) {
  if (!month) return 30;
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(year, monthIndex, 0).getDate();
}

function clampRate(value) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function segmentActualToDate(overview, label, endDate) {
  return (overview.actualRecords || overview.daily || [])
    .filter((row) => row.label === label && (!endDate || String(row.date) <= endDate))
    .reduce((sum, row) => sum + Number(row.amount || row.actualAmount || 0), 0);
}

function targetToDate(overview, label, endDate) {
  return (overview.targetRecords || [])
    .filter((row) => row.label === label && (!endDate || String(row.date) <= endDate))
    .reduce((sum, row) => sum + Number(row.targetAmount || 0), 0);
}

function sumDailyUntil(rows, field, endDate) {
  return rows
    .filter((row) => !endDate || String(row.date) <= endDate)
    .reduce((sum, row) => sum + Number(row[field] || 0), 0);
}

function weekRangeFor(dateText) {
  const parsed = dateText ? new Date(`${dateText}T00:00:00`) : new Date();
  const day = parsed.getDay() || 7;
  const start = new Date(parsed);
  start.setDate(parsed.getDate() - day + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: formatLocalDay(start), end: formatLocalDay(end) };
}

function renderDesignMetric(label, target, actual, caption = "") {
  const rate = target ? actual / target : null;
  const rateLabel = target ? fmtAchievementRate(rate) : (actual > 0 ? "无目标实际" : "-");
  return `
    <article class="design-metric ${rateStatus(rate || 0, "gmv")}">
      <label>${escapeHtml(label)}<span>${rateLabel}</span></label>
      <strong>${fmtMoney(actual)}</strong>
      <small>目标 ${fmtMoney(target)}${caption ? ` · ${escapeHtml(caption)}` : ""}</small>
    </article>
  `;
}

function renderDesignProgress(label, value, sub, tone = "", suffix = "") {
  const percent = `${Math.round(clampRate(value) * 100)}%`;
  const suffixHtml = suffix ? `<em>${escapeHtml(suffix)}</em>` : "";
  return `
    <div class="design-progress ${tone}">
      <div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(sub)}${suffixHtml}</span></div>
      <div class="design-progress-track"><i style="width:${percent}"></i></div>
    </div>
  `;
}

function renderOverviewDesign() {
  const month = selectedOverviewMonth();
  const monthInput = document.getElementById("overviewMonthFilter");
  if (monthInput) monthInput.value = month;
  const target = document.getElementById("overviewBoard");
  if (!target) return;
  if (IS_STANDALONE) {
    target.innerHTML = `<section class="panel"><p class="muted">总览需要本地服务版营收接口。</p></section>`;
    return;
  }
  ensureRevenueOverview(month);
  const overview = state.revenueOverviewByMonth[month];
  if (!overview) {
    target.innerHTML = `<section class="panel"><p class="muted">正在加载营收数据...</p></section>`;
    return;
  }
  if (overview.error) {
    target.innerHTML = `<section class="panel"><p class="muted">${escapeHtml(overview.error)}</p></section>`;
    return;
  }

  const dailyRows = (overview.daily || []).slice().sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const actualEnd = overview.actualRange?.end || dailyRows.filter((row) => Number(row.actualAmount || 0) > 0).map((row) => row.date).at(-1) || `${month}-${String(new Date().getDate()).padStart(2, "0")}`;
  const monthDays = daysInMonth(month);
  const elapsedDay = Math.min(Number(actualEnd.slice(-2)) || 1, monthDays);
  const timeRate = elapsedDay / monthDays;
  const revenueRate = overview.summary?.achievementRate || 0;
  const paceGap = revenueRate - timeRate;
  const throughTarget = sumDailyUntil(dailyRows, "targetAmount", actualEnd);
  const throughActual = sumDailyUntil(dailyRows, "actualAmount", actualEnd);
  const week = weekRangeFor(actualEnd);
  const weekRows = dailyRows.filter((row) => row.date >= week.start && row.date <= week.end);
  const weekTarget = weekRows.reduce((sum, row) => sum + Number(row.targetAmount || 0), 0);
  const weekActual = weekRows.reduce((sum, row) => sum + Number(row.actualAmount || 0), 0);
  const businessRows = overview.business || [];
  const actualDaily = dailyRows.filter((row) => String(row.date) <= actualEnd);
  const labels = businessRows.map((row) => row.label);
  const actualFor = (date, label) => (overview.actualRecords || [])
    .filter((row) => row.date === date && row.label === label)
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const targetFor = (date, label) => (overview.targetRecords || [])
    .filter((row) => row.date === date && row.label === label)
    .reduce((sum, row) => sum + Number(row.targetAmount || 0), 0);
  const weekActualFor = (label) => (overview.actualRecords || [])
    .filter((row) => row.label === label && row.date >= week.start && row.date <= week.end)
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const weekTargetFor = (label) => (overview.targetRecords || [])
    .filter((row) => row.label === label && row.date >= week.start && row.date <= week.end)
    .reduce((sum, row) => sum + Number(row.targetAmount || 0), 0);

  target.innerHTML = `
    <section class="design-hero">
      <div class="design-hero-total">
        <span>总营收</span>
        <div class="design-revenue-summary">
          <div class="design-revenue-lines">
            <small>目标 ${fmtMoney(overview.summary?.targetAmount || 0)}</small>
            <strong>营收：${fmtMoney(overview.summary?.actualAmount || 0)}</strong>
          </div>
          <b class="design-achievement-badge ${paceGap >= 0 ? "ahead" : "behind"}">${fmtAchievementRate(revenueRate)}</b>
        </div>
      </div>
      <div class="design-hero-progress">
        ${renderDesignProgress("时间进度", timeRate, `${elapsedDay} / ${monthDays} 天`, "", fmtAchievementRate(timeRate))}
        ${renderDesignProgress("营收进度", revenueRate, `${fmtAchievementRate(revenueRate)} 月度达成`, paceGap >= 0 ? "ahead" : "behind")}
      </div>
      <div class="design-pace-card">
        <label>节奏差</label>
        <strong>${paceGap >= 0 ? "+" : ""}${Math.round(paceGap * 100)}%</strong>
        <span>${paceGap >= 0 ? "营收进度快于时间" : "营收进度慢于时间"}</span>
      </div>
    </section>

    <section class="design-section">
      <div class="design-section-head"><h3>月度目标达成</h3><span>整月目标口径</span></div>
      <div class="design-metric-grid">
        ${renderDesignMetric("总营收", overview.summary?.targetAmount || 0, overview.summary?.actualAmount || 0, "月度")}
        ${businessRows.map((row) => renderDesignMetric(row.label, row.targetAmount || 0, row.actualAmount || 0, "月度")).join("")}
      </div>
    </section>

    <section class="design-section">
      <div class="design-section-head"><h3>应达进度达成</h3><span>1号到 ${escapeHtml(actualEnd)} 的日目标加总</span></div>
      <div class="design-metric-grid">
        ${renderDesignMetric("总营收应达", throughTarget, throughActual, "截至今日")}
        ${businessRows.map((row) => renderDesignMetric(`${row.label}应达`, targetToDate(overview, row.label, actualEnd), row.actualAmount || 0, "截至今日")).join("")}
      </div>
    </section>

    <section class="design-section">
      <div class="design-section-head"><h3>本周达成</h3><span>${escapeHtml(week.start)} 至 ${escapeHtml(week.end)}</span></div>
      <div class="design-week-grid">
        ${renderDesignMetric("本周总营收", weekTarget, weekActual, "自然周")}
        <div class="table-wrap compact-table">
          <table class="revenue-table">
            <thead><tr><th>业务</th><th>周目标</th><th>周实际</th><th>周达成</th></tr></thead>
            <tbody>
              ${labels.map((label) => {
                const target = weekTargetFor(label);
                const actual = weekActualFor(label);
                return `<tr><td><strong>${escapeHtml(label)}</strong></td><td class="num">${fmtMoney(target)}</td><td class="num">${fmtMoney(actual)}</td><td class="num">${fmtAchievementRate(target ? actual / target : null)}</td></tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="design-section">
      <div class="design-section-head"><h3>每日达成明细</h3><span>默认显示已抓取实际区间</span></div>
      <div class="table-wrap compact-table">
        <table class="revenue-table">
          <thead><tr><th>日期</th><th>总目标</th><th>总实际</th><th>总达成</th><th>书法前端</th><th>书法后端</th><th>朗诵后端</th></tr></thead>
          <tbody>
            ${actualDaily.map((row) => `<tr>
              <td>${escapeHtml(row.date)}</td>
              <td class="num">${fmtMoney(row.targetAmount || 0)}</td>
              <td class="num">${fmtMoney(row.actualAmount || 0)}</td>
              <td class="num">${fmtAchievementRate(row.achievementRate)}</td>
              ${labels.map((label) => {
                const actual = actualFor(row.date, label);
                const target = targetFor(row.date, label);
                return `<td class="num">${fmtMoney(actual)} <span class="muted">${fmtAchievementRate(target ? actual / target : null)}</span></td>`;
              }).join("")}
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function monthlyForecast(month) {
  const monthRows = computeDailyRows().filter((row) => row.date.startsWith(month));
  const actualRows = monthRows.filter((row) => Number(row.actualGmv || 0) > 0);
  const latestActualDate = actualRows.map((row) => row.date).sort().at(-1) || "";
  const historyRows = latestActualDate
    ? monthRows.filter((row) => row.date <= latestActualDate)
    : [];
  const futureRows = latestActualDate
    ? monthRows.filter((row) => row.date > latestActualDate)
    : monthRows;
  const historyActualGmv = historyRows.reduce((sum, row) => sum + Number(row.actualGmv || 0), 0);
  const historyTargetGmv = historyRows.reduce((sum, row) => sum + Number(row.targetGmv || 0), 0);
  const futureTargetGmv = futureRows.reduce((sum, row) => sum + Number(row.targetGmv || 0), 0);
  const targetTotalGmv = monthRows.reduce((sum, row) => sum + Number(row.targetGmv || 0), 0);
  const trendRate = historyTargetGmv ? historyActualGmv / historyTargetGmv : 1;
  return {
    latestActualDate,
    historyDays: historyRows.filter((row) => Number(row.actualGmv || 0) > 0).length,
    futureDays: futureRows.filter((row) => Number(row.targetGmv || 0) > 0).length,
    historyActualGmv,
    historyTargetGmv,
    futureTargetGmv,
    targetTotalGmv,
    planForecastGmv: historyActualGmv + futureTargetGmv,
    trendForecastGmv: historyActualGmv + futureTargetGmv * trendRate,
    trendRate,
  };
}

function bumpRatioBucket(map, key, actual, target) {
  if (!key) return;
  if (!map.has(key)) map.set(key, { actual: 0, target: 0 });
  const item = map.get(key);
  item.actual += Number(actual || 0);
  item.target += Number(target || 0);
}

function ratioFromBucket(map, key, fallback = 1) {
  const item = map.get(key);
  return item && item.target > 0 ? item.actual / item.target : fallback;
}

function structuredForecast(month, baseForecast) {
  const campaigns = planningCampaigns();
  const actuals = actualCampaignMap();
  const shareByName = campaignTargetShareMap(campaigns);
  const subByName = new Map((state.config.subchannels || []).map((sub) => [sub.name, sub]));
  const subById = new Map((state.config.subchannels || []).map((sub) => [sub.id, sub]));
  const latestActualDate = baseForecast.latestActualDate;
  const leadBuckets = new Map();
  const rBuckets = new Map();
  const stageBuckets = new Map();
  const overallRate = baseForecast.trendRate || 1;

  campaigns.forEach((campaign) => {
    const actual = actuals.get(campaign.name);
    if (!actual || !campaign.openDate || (latestActualDate && campaign.openDate > latestActualDate)) return;
    const plannedSubLeads = new Map(campaignLeadsBySubchannel(campaign, shareByName.get(campaign.name) || 1).map((item) => [item.subchannelId, item.leads]));
    (actual.actualSubchannels || []).forEach((subActual) => {
      const sub = subByName.get(subActual.category) || subchannelByNameOrId(subActual.category);
      if (!sub) return;
      bumpRatioBucket(leadBuckets, sub.id, Number(subActual.actualLeads || 0), Number(plannedSubLeads.get(sub.id) || 0));
      D_STAGES.forEach((stage) => {
        const actualR = Number(subActual.rBreakdown?.[`${stage}-R值`] || 0);
        if (!actualR) return;
        const targetR = Number(rMap(campaign).get(`${sub.id}|${stage}`) || 0);
        bumpRatioBucket(rBuckets, `${sub.id}|${stage}`, actualR, targetR);
        bumpRatioBucket(stageBuckets, stage, actualR, targetR);
      });
    });
  });

  let futureStructuredGmv = 0;
  const subDetails = new Map();
  const futureCampaigns = campaigns.filter((campaign) => {
    const conversionDates = campaignConversionDays(campaign);
    return conversionDates.some((item) => item.date.startsWith(month) && (!latestActualDate || item.date > latestActualDate));
  });

  futureCampaigns.forEach((campaign) => {
    const campaignR = rMap(campaign);
    const subLeads = campaignLeadsBySubchannel(campaign, shareByName.get(campaign.name) || 1);
    D_STAGES.forEach((stage) => {
      const date = addDays(campaign.openDate, Number(stage.slice(1)) - 1);
      if (!date.startsWith(month) || (latestActualDate && date <= latestActualDate)) return;
      subLeads.forEach((subLead) => {
        const targetR = Number(campaignR.get(`${subLead.subchannelId}|${stage}`) || 0);
        if (!targetR || !subLead.leads) return;
        const leadsRate = ratioFromBucket(leadBuckets, subLead.subchannelId, 1);
        const stageRate = ratioFromBucket(stageBuckets, stage, overallRate);
        const rRate = ratioFromBucket(rBuckets, `${subLead.subchannelId}|${stage}`, stageRate);
        const gmv = subLead.leads * leadsRate * targetR * rRate;
        futureStructuredGmv += gmv;
        if (!subDetails.has(subLead.subchannelId)) {
          subDetails.set(subLead.subchannelId, {
            subchannelId: subLead.subchannelId,
            subchannelName: subById.get(subLead.subchannelId)?.name || subLead.subchannelId,
            leadsRate,
            gmv: 0,
          });
        }
        const detail = subDetails.get(subLead.subchannelId);
        detail.gmv += gmv;
        detail.leadsRate = leadsRate;
      });
    });
  });

  const details = [...subDetails.values()].sort((a, b) => b.gmv - a.gmv);
  return {
    structuredForecastGmv: baseForecast.historyActualGmv + futureStructuredGmv,
    futureStructuredGmv,
    futureCampaignCount: futureCampaigns.length,
    subchannelCount: details.length,
    details,
  };
}

function addSample(map, key, value, openDate) {
  if (!key || !Number.isFinite(Number(value))) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push({ value: Number(value), openDate });
}

function weightedRecent(samples, fallback = 0) {
  const valid = (samples || [])
    .filter((item) => Number(item.value) > 0)
    .sort((a, b) => String(b.openDate || "").localeCompare(String(a.openDate || "")))
    .slice(0, 3);
  if (!valid.length) return { value: fallback, count: 0 };
  const weights = [0.5, 0.3, 0.2];
  const totalWeight = valid.reduce((sum, _item, index) => sum + weights[index], 0);
  return {
    value: valid.reduce((sum, item, index) => sum + item.value * weights[index], 0) / totalWeight,
    count: valid.length,
  };
}

function predictionSamples(month) {
  const actuals = actualCampaignMap();
  const campaigns = planningCampaigns();
  const shareByName = campaignTargetShareMap(campaigns);
  const subByName = new Map((state.config.subchannels || []).map((sub) => [sub.name, sub]));
  const leads = new Map();
  const subStageR = new Map();
  const subR = new Map();
  const stageR = new Map();
  campaigns.forEach((campaign) => {
    const actual = actuals.get(campaign.name);
    if (!actual || !campaign.openDate || campaign.openDate > `${month}-31`) return;
    const plannedSubLeads = new Map(campaignLeadsBySubchannel(campaign, shareByName.get(campaign.name) || 1).map((item) => [item.subchannelId, item.leads]));
    (actual.actualSubchannels || []).forEach((subActual) => {
      const sub = subByName.get(subActual.category) || subchannelByNameOrId(subActual.category);
      if (!sub) return;
      const targetLeads = Number(plannedSubLeads.get(sub.id) || 0);
      if (targetLeads > 0) addSample(leads, sub.id, Number(subActual.actualLeads || 0) / targetLeads, campaign.openDate);
      D_STAGES.forEach((stage) => {
        const actualR = Number(subActual.rBreakdown?.[`${stage}-R值`] || 0);
        if (!actualR) return;
        addSample(subStageR, `${sub.id}|${stage}`, actualR, campaign.openDate);
        addSample(subR, sub.id, actualR, campaign.openDate);
        addSample(stageR, stage, actualR, campaign.openDate);
      });
    });
  });
  return { leads, subStageR, subR, stageR };
}

function predictionBasis(samples, subId, stage, targetR) {
  const exact = weightedRecent(samples.subStageR.get(`${subId}|${stage}`), 0);
  if (exact.count) return { r: exact.value, label: `同子渠道${stage}近${exact.count}期` };
  const sub = weightedRecent(samples.subR.get(subId), 0);
  if (sub.count) return { r: sub.value, label: `同子渠道近${sub.count}期R值` };
  const stageAvg = weightedRecent(samples.stageR.get(stage), 0);
  if (stageAvg.count) return { r: stageAvg.value, label: `全渠道${stage}近${stageAvg.count}期` };
  return { r: Number(targetR || 0), label: "使用目标R值" };
}

function predictionActualSubLeadMap(actual) {
  const map = new Map();
  if (!actual) return map;
  (actual.actualSubchannels || []).forEach((item) => {
    const sub = subchannelByNameOrId(item.category);
    if (!sub) return;
    map.set(sub.id, Number(item.actualLeads || 0));
  });
  return map;
}

function compactStageRange(stages) {
  const nums = [...new Set(stages.map((stage) => Number(String(stage).replace("D", ""))).filter(Number.isFinite))].sort((a, b) => a - b);
  if (!nums.length) return "-";
  if (nums.length === 1) return `D${nums[0]}`;
  const continuous = nums.every((num, index) => !index || num === nums[index - 1] + 1);
  return continuous ? `D${nums[0]}-D${nums.at(-1)}` : nums.map((num) => `D${num}`).join("、");
}

function weekStart(day) {
  const date = parseLocalDay(day);
  const offset = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - offset);
  return formatLocalDay(date);
}

function averageR(gmv, leads) {
  return leads ? gmv / leads : 0;
}

function effectiveActualDate(latestActualDate) {
  if (!latestActualDate) return "";
  const yesterday = addDays(formatLocalDay(new Date()), -1);
  return latestActualDate < yesterday ? latestActualDate : yesterday;
}

function cellCompareClass(cell) {
  if (!cell) return "";
  if (cell.type !== "actual") return "pending";
  if (cell.actualGmv < cell.predictedGmv) return "below";
  if (cell.actualGmv > cell.predictedGmv) return "above";
  return "equal";
}

function predictionBusinessBasis(subName, subTotal) {
  const labels = [...(subTotal.basisLabels || new Set())];
  const exactCount = labels.filter((label) => label.includes("同子渠道D")).length;
  const targetOnly = labels.filter((label) => label.includes("目标R值")).length;
  const stages = compactStageRange(subTotal.stages || []);
  if (exactCount >= Math.max(2, labels.length * 0.5)) {
    return `${subName}预计贡献 ${fmtGmvPlain(subTotal.gmv)}，主要参考最近同子渠道${stages}表现，样本相对直接，推演可信度较高。`;
  }
  if (targetOnly >= Math.max(1, labels.length * 0.5)) {
    return `${subName}预计贡献 ${fmtGmvPlain(subTotal.gmv)}，部分D阶段历史样本不足，主要沿用当前目标R值，适合人工复核。`;
  }
  if (labels.some((label) => label.includes("全渠道"))) {
    return `${subName}预计贡献 ${fmtGmvPlain(subTotal.gmv)}，部分D阶段借用了全渠道同阶段表现，可信度中等。`;
  }
  return `${subName}预计贡献 ${fmtGmvPlain(subTotal.gmv)}，综合最近子渠道R值与目标R值推算，建议重点观察后续实际回传。`;
}

function scenarioAdjustments() {
  return state.predictionScenario || {};
}

function futureDxCell(campaign, stage, date, context) {
  const { actualLeadMap, campaignR, samples, subById, subLeads, adjustments } = context;
  let gmv = 0;
  let leads = 0;
  const parts = [];
  subLeads.forEach((subLead) => {
    const targetR = Number(campaignR.get(`${subLead.subchannelId}|${stage}`) || 0);
    if (!targetR) return;
    const leadSample = weightedRecent(samples.leads.get(subLead.subchannelId), 1);
    const scenario = adjustments[subLead.subchannelId] || {};
    const hasActualSubLeads = actualLeadMap.has(subLead.subchannelId);
    const leadRate = Number(scenario.leadsRate || 0) > 0 ? Number(scenario.leadsRate) / 100 : (hasActualSubLeads ? 1 : leadSample.value);
    const predictedLeads = (hasActualSubLeads ? actualLeadMap.get(subLead.subchannelId) : subLead.leads) * leadRate;
    if (!predictedLeads) return;
    const rBasis = predictionBasis(samples, subLead.subchannelId, stage, targetR);
    const rLift = Number(scenario.rLift || 0) / 100;
    const r = rBasis.r * (1 + rLift);
    const subGmv = predictedLeads * r;
    if (!subGmv) return;
    gmv += subGmv;
    leads += predictedLeads;
    parts.push({
      subchannelId: subLead.subchannelId,
      subchannelName: subById.get(subLead.subchannelId)?.name || subLead.subchannelId,
      leads: predictedLeads,
      r,
      gmv: subGmv,
      basis: rBasis.label,
    });
  });
  return gmv ? { stage, date, type: "future", gmv, leads, r: averageR(gmv, leads), parts } : null;
}

function actualDxCell(actual, stage, date) {
  if (!actual) return null;
  const parts = [];
  let gmv = 0;
  let leads = 0;
  (actual.actualSubchannels || []).forEach((item) => {
    const sub = subchannelByNameOrId(item.category);
    const subLeads = Number(item.actualLeads || 0);
    const r = Number(item.rBreakdown?.[`${stage}-R值`] || 0);
    const subGmv = subLeads * r;
    if (!subGmv) return;
    gmv += subGmv;
    leads += subLeads;
    parts.push({
      subchannelId: sub?.id || item.category,
      subchannelName: item.category,
      leads: subLeads,
      r,
      gmv: subGmv,
      basis: "实际回传",
    });
  });
  if (!gmv) {
    const r = Number(actual.rBreakdown?.[`${stage}-R值`] || 0);
    const actualLeads = Number(actual.actualLeads || 0);
    gmv = actualLeads * r;
    leads = actualLeads;
  }
  return gmv ? { stage, date, type: "actual", gmv, leads, r: averageR(gmv, leads), parts } : null;
}

function revenueCalendarData(month, adjustments = {}) {
  const base = monthlyForecast(month);
  const latestActualDate = base.latestActualDate;
  const actualDate = effectiveActualDate(latestActualDate);
  const days = monthDays(month);
  const samples = predictionSamples(month);
  const subById = new Map((state.config.subchannels || []).map((sub) => [sub.id, sub]));
  const campaigns = planningCampaigns();
  const actuals = actualCampaignMap();
  const shareByName = campaignTargetShareMap(campaigns);
  const rows = [];
  const totals = new Map(days.map((day) => [day, { actual: 0, future: 0, total: 0 }]));

  campaigns.forEach((campaign) => {
    const actual = actuals.get(campaign.name);
    const actualLeadMap = predictionActualSubLeadMap(actual);
    const campaignR = rMap(campaign);
    const subLeads = campaignLeadsBySubchannel(campaign, shareByName.get(campaign.name) || 1);
    const context = { actualLeadMap, campaignR, samples, subById, subLeads, adjustments };
    const cells = new Map();
    campaignConversionDays(campaign).forEach(({ stage, date }) => {
      if (!days.includes(date)) return;
      const predicted = futureDxCell(campaign, stage, date, context);
      const isActualDay = Boolean(actualDate && date <= actualDate);
      const actualCell = isActualDay ? actualDxCell(actual, stage, date) : null;
      const cell = predicted || actualCell ? {
        stage,
        date,
        type: isActualDay ? "actual" : "future",
        gmv: actualCell?.gmv || predicted?.gmv || 0,
        r: actualCell?.r || predicted?.r || 0,
        leads: actualCell?.leads || predicted?.leads || 0,
        predictedGmv: predicted?.gmv || 0,
        predictedR: predicted?.r || 0,
        predictedLeads: predicted?.leads || 0,
        actualGmv: actualCell?.gmv || 0,
        actualR: actualCell?.r || 0,
        actualLeads: actualCell?.leads || 0,
        predictedParts: predicted?.parts || [],
        actualParts: actualCell?.parts || [],
        parts: actualCell?.parts?.length ? actualCell.parts : (predicted?.parts || []),
      } : null;
      if (!cell) return;
      cells.set(date, cell);
      const total = totals.get(date);
      total.actual += cell.actualGmv;
      total.future += cell.predictedGmv;
      total.total += cell.type === "actual" ? cell.actualGmv : cell.predictedGmv;
    });
    if (cells.size) {
      rows.push({
        name: campaign.name,
        openDate: campaign.openDate,
        status: lifecycleStage(campaign, latestActualDate || formatLocalDay(new Date())),
        cells,
      });
    }
  });

  return { month, latestActualDate, actualDate, days, rows: rows.sort((a, b) => String(a.openDate).localeCompare(String(b.openDate))), totals };
}

function dxDayPrediction(month, adjustments = {}) {
  const base = monthlyForecast(month);
  const samples = predictionSamples(month);
  const subById = new Map((state.config.subchannels || []).map((sub) => [sub.id, sub]));
  const campaigns = planningCampaigns();
  const actuals = actualCampaignMap();
  const shareByName = campaignTargetShareMap(campaigns);
  const latestActualDate = effectiveActualDate(base.latestActualDate);
  const monthEnd = monthBounds(month).end;
  const rangeStart = latestActualDate ? addDays(latestActualDate, 1) : `${month}-01`;
  const rows = [];
  const subDetails = new Map();
  let futureGmv = 0;
  let futureLeads = 0;

  campaigns.forEach((campaign) => {
    const futureStages = campaignConversionDays(campaign)
      .filter((item) => item.date.startsWith(month) && (!latestActualDate || item.date > latestActualDate));
    if (!futureStages.length) return;
    const actual = actuals.get(campaign.name);
    const actualLeadMap = predictionActualSubLeadMap(actual);
    const campaignR = rMap(campaign);
    const subLeads = campaignLeadsBySubchannel(campaign, shareByName.get(campaign.name) || 1);
    const dxRows = [];
    const campaignSubTotals = new Map();
    let campaignGmv = 0;
    let campaignLeads = 0;

    futureStages.forEach(({ stage, date }) => {
      let dayGmv = 0;
      const parts = [];
      subLeads.forEach((subLead) => {
        const targetR = Number(campaignR.get(`${subLead.subchannelId}|${stage}`) || 0);
        if (!targetR) return;
        const leadSample = weightedRecent(samples.leads.get(subLead.subchannelId), 1);
        const scenario = adjustments[subLead.subchannelId] || {};
        const hasActualSubLeads = actualLeadMap.has(subLead.subchannelId);
        const leadRate = Number(scenario.leadsRate || 0) > 0 ? Number(scenario.leadsRate) / 100 : (hasActualSubLeads ? 1 : leadSample.value);
        const predictedLeads = (hasActualSubLeads ? actualLeadMap.get(subLead.subchannelId) : subLead.leads) * leadRate;
        if (!predictedLeads) return;
        const rBasis = predictionBasis(samples, subLead.subchannelId, stage, targetR);
        const rLift = Number(scenario.rLift || 0) / 100;
        const predictedR = rBasis.r * (1 + rLift);
        const gmv = predictedLeads * predictedR;
        if (!gmv) return;
        const subName = subById.get(subLead.subchannelId)?.name || subLead.subchannelId;
        dayGmv += gmv;
        campaignGmv += gmv;
        parts.push({ subchannelId: subLead.subchannelId, subchannelName: subName, leads: predictedLeads, r: predictedR, gmv, basis: rBasis.label });
        const isNewCampaignSub = !campaignSubTotals.has(subLead.subchannelId);
        if (isNewCampaignSub) {
          campaignSubTotals.set(subLead.subchannelId, { subchannelId: subLead.subchannelId, subchannelName: subName, leads: predictedLeads, gmv: 0, basisLabels: new Set(), stages: [] });
          campaignLeads += predictedLeads;
        }
        const campaignSub = campaignSubTotals.get(subLead.subchannelId);
        campaignSub.gmv += gmv;
        campaignSub.basisLabels.add(rBasis.label);
        campaignSub.stages.push(stage);
        if (!subDetails.has(subLead.subchannelId)) {
          subDetails.set(subLead.subchannelId, { subchannelName: subName, leads: 0, gmv: 0 });
        }
        const subTotal = subDetails.get(subLead.subchannelId);
        if (isNewCampaignSub) subTotal.leads += predictedLeads;
        subTotal.gmv += gmv;
      });
      if (dayGmv) dxRows.push({ stage, date, gmv: dayGmv, parts });
    });

    if (campaignGmv) {
      futureGmv += campaignGmv;
      futureLeads += campaignLeads;
      const subTop = [...campaignSubTotals.values()].sort((a, b) => b.gmv - a.gmv);
      rows.push({
        name: campaign.name,
        openDate: campaign.openDate,
        status: lifecycleStage(campaign, latestActualDate || formatLocalDay(new Date())),
        predictedLeads: campaignLeads,
        predictedGmv: campaignGmv,
        dxRows,
        subTop,
        dxRange: compactStageRange(dxRows.map((item) => item.stage)),
      });
    }
  });

  return {
    month,
    latestActualDate,
    rangeStart,
    rangeEnd: monthEnd,
    historyActualGmv: base.historyActualGmv,
    futureGmv,
    totalGmv: base.historyActualGmv + futureGmv,
    futureLeads,
    rows: rows.sort((a, b) => String(a.openDate).localeCompare(String(b.openDate))),
    subDetails: [...subDetails.values()].sort((a, b) => b.gmv - a.gmv),
  };
}

function campaignTrendPrediction(month, adjustments = {}) {
  const base = monthlyForecast(month);
  const samples = predictionSamples(month);
  const subById = new Map((state.config.subchannels || []).map((sub) => [sub.id, sub]));
  const campaigns = planningCampaigns();
  const actuals = actualCampaignMap();
  const shareByName = campaignTargetShareMap(campaigns);
  const latestActualDate = base.latestActualDate;
  const rows = [];
  const subTotals = new Map();
  let futureGmv = 0;
  let futureLeads = 0;
  campaigns
    .filter((campaign) => !actuals.has(campaign.name))
    .forEach((campaign) => {
      const campaignR = rMap(campaign);
      const subLeads = campaignLeadsBySubchannel(campaign, shareByName.get(campaign.name) || 1);
      let campaignGmv = 0;
      let campaignLeads = 0;
      const basisLabels = new Set();
      D_STAGES.forEach((stage) => {
        const date = addDays(campaign.openDate, Number(stage.slice(1)) - 1);
        if (!date.startsWith(month) || (latestActualDate && date <= latestActualDate)) return;
        subLeads.forEach((subLead) => {
          const targetR = Number(campaignR.get(`${subLead.subchannelId}|${stage}`) || 0);
          if (!targetR || !subLead.leads) return;
          const leadSample = weightedRecent(samples.leads.get(subLead.subchannelId), 1);
          const scenario = adjustments[subLead.subchannelId] || {};
          const leadRate = Number(scenario.leadsRate || 0) > 0 ? Number(scenario.leadsRate) / 100 : leadSample.value;
          const rBasis = predictionBasis(samples, subLead.subchannelId, stage, targetR);
          const rLift = Number(scenario.rLift || 0) / 100;
          const predictedLeads = subLead.leads * leadRate;
          const predictedR = rBasis.r * (1 + rLift);
          const gmv = predictedLeads * predictedR;
          campaignGmv += gmv;
          campaignLeads += predictedLeads;
          basisLabels.add(`${subById.get(subLead.subchannelId)?.name || subLead.subchannelId}:${leadSample.count ? `Leads近${leadSample.count}期` : "Leads按100%"} / ${rBasis.label}`);
          if (!subTotals.has(subLead.subchannelId)) {
            subTotals.set(subLead.subchannelId, { subchannelName: subById.get(subLead.subchannelId)?.name || subLead.subchannelId, leads: 0, gmv: 0 });
          }
          const subTotal = subTotals.get(subLead.subchannelId);
          subTotal.leads += predictedLeads;
          subTotal.gmv += gmv;
        });
      });
      if (campaignGmv || campaignLeads) {
        futureGmv += campaignGmv;
        futureLeads += campaignLeads;
        rows.push({
          name: campaign.name,
          openDate: campaign.openDate,
          predictedLeads: campaignLeads,
          predictedGmv: campaignGmv,
          plannedGmv: Number(campaign.targetGmv || 0),
          basis: [...basisLabels].slice(0, 3).join("；"),
        });
      }
    });
  const subDetails = [...subTotals.values()].sort((a, b) => b.gmv - a.gmv);
  return {
    month,
    latestActualDate,
    historyActualGmv: base.historyActualGmv,
    futureGmv,
    totalGmv: base.historyActualGmv + futureGmv,
    futureLeads,
    rows: rows.sort((a, b) => String(a.openDate).localeCompare(String(b.openDate))),
    subDetails,
  };
}

function renderOverview() {
  renderOverviewDesign();
}

function selectedPredictionMonth() {
  const months = availableMonths();
  const currentMonth = formatLocalDay(new Date()).slice(0, 7);
  if (!state.predictionMonth && months.includes(currentMonth)) state.predictionMonth = currentMonth;
  if (!state.predictionMonth && months.length) state.predictionMonth = months.at(-1);
  return state.predictionMonth || currentMonth;
}

function renderPrediction() {
  const month = selectedPredictionMonth();
  const input = document.getElementById("predictionMonth");
  input.value = month;
  const machine = dxDayPrediction(month);
  const overview = derivedOverview(month);
  const expectedRate = pct(machine.totalGmv, overview.monthTargetGmv);
  renderRevenueCalendar(month);
  document.getElementById("predictionKpis").innerHTML = [
    kpi("本月目标GMV", fmtGmvPlain(overview.monthTargetGmv), "来自计划中心目标", overview.monthTargetGmv ? "good" : "empty"),
    kpi("已发生实际GMV", fmtGmvPlain(machine.historyActualGmv), `最新实际 ${machine.latestActualDate || "-"}`, machine.historyActualGmv ? "good" : "empty"),
    kpi("未来推演GMV", fmtGmvPlain(machine.futureGmv), `${machine.rangeStart} ~ ${machine.rangeEnd}`, machine.futureGmv ? "good" : "empty"),
    kpi("本月预估GMV", fmtGmvPlain(machine.totalGmv), `预计达成 ${fmtPct(expectedRate)} · 营期 ${fmtNumber(machine.rows.length)}`, machine.totalGmv ? rateStatus(expectedRate, "gmv") : "empty"),
  ].join("");
}

function renderCalendarCell(cell) {
  if (!cell) return `<div class="calendar-empty">-</div>`;
  const topParts = (cell.parts || []).slice().sort((a, b) => b.gmv - a.gmv).slice(0, 3);
  const title = topParts.length
    ? topParts.map((item) => `${item.subchannelName} ${fmtGmvPlain(item.gmv)} / R ${fmtNumber(item.r, 2)}`).join("\n")
    : "";
  return `
    <div class="calendar-cell ${cellCompareClass(cell)}" title="${title}">
      <strong>${cell.stage}</strong>
      <span><b class="predict-value">${fmtGmvPlain(cell.predictedGmv)}</b>/<b class="actual-value">${fmtGmvPlain(cell.actualGmv)}</b></span>
      <em><b class="predict-value">${fmtNumber(cell.predictedR, 2)}</b>/<b class="actual-value">${fmtNumber(cell.actualR, 2)}</b></em>
    </div>
  `;
}

function revenueDateAnalysis(calendar, date) {
  const cells = calendar.rows
    .map((row) => ({ row, cell: row.cells.get(date) }))
    .filter((item) => item.cell)
    .sort((a, b) => (b.cell.type === "actual" ? b.cell.actualGmv : b.cell.predictedGmv) - (a.cell.type === "actual" ? a.cell.actualGmv : a.cell.predictedGmv));
  const total = calendar.totals.get(date) || { total: 0 };
  const isActual = calendar.actualDate && date <= calendar.actualDate;
  const subTotals = new Map();
  cells.forEach(({ cell }) => {
    const parts = isActual ? (cell.actualParts || []) : (cell.predictedParts || []);
    parts.forEach((part) => {
      const key = part.subchannelName || part.subchannelId;
      if (!subTotals.has(key)) subTotals.set(key, { name: key, gmv: 0, leads: 0 });
      const item = subTotals.get(key);
      item.gmv += Number(part.gmv || 0);
      item.leads += Number(part.leads || 0);
    });
  });
  const topCampaigns = cells.slice(0, 4);
  const topSubs = [...subTotals.values()].sort((a, b) => b.gmv - a.gmv).slice(0, 4);
  const strongest = topCampaigns[0];
  const summary = cells.length
    ? `${date} ${isActual ? "已回传实际" : "仍为系统推演"}，共有 ${fmtNumber(cells.length)} 个营期产生 D4-D13 转化，推演GMV ${fmtGmvPlain(total.future || 0)}，实际GMV ${fmtGmvPlain(total.actual || 0)}。${strongest ? `主要由 ${strongest.row.name} 的 ${strongest.cell.stage} 贡献${isActual ? "实际" : "推演"} ${fmtGmvPlain(isActual ? strongest.cell.actualGmv : strongest.cell.predictedGmv)}。` : ""}`
    : `${date} 暂无 D4-D13 转化收入。`;
  return { cells, total, isActual, topCampaigns, topSubs, summary };
}

function revenueCampaignCellAnalysis(calendar, campaignName, date) {
  const row = calendar.rows.find((item) => item.name === campaignName);
  const cell = row?.cells.get(date);
  if (!row || !cell) return null;
  const isActual = cell.type === "actual";
  const parts = (isActual ? cell.actualParts : cell.predictedParts).slice().sort((a, b) => b.gmv - a.gmv);
  return { row, cell, isActual, parts };
}

function renderRevenueCalendarDetail(calendar, date, campaignName = "") {
  const target = document.getElementById("revenueCalendarDetail");
  if (!target) return;
  const campaignAnalysis = campaignName ? revenueCampaignCellAnalysis(calendar, campaignName, date) : null;
  if (campaignAnalysis) {
    const { row, cell, isActual, parts } = campaignAnalysis;
    target.innerHTML = `
      <div class="calendar-detail-head">
        <div>
          <strong>${row.name} · ${withWeekday(date)}</strong>
          <span class="${isActual ? "actual" : "future"}">${isActual ? "已发生实际" : "未发生推演"}</span>
        </div>
        <b>${fmtGmvPlain(isActual ? cell.actualGmv : cell.predictedGmv)}</b>
      </div>
      <p>${row.name} 在 ${date} 落到 ${cell.stage}，推演GMV ${fmtGmvPlain(cell.predictedGmv)}、实际GMV ${fmtGmvPlain(cell.actualGmv)}；R推 ${fmtNumber(cell.predictedR, 2)}、R实 ${fmtNumber(cell.actualR, 2)}。</p>
      <div class="calendar-detail-grid">
        <div>
          <h4>营期单日拆解</h4>
          <article><strong>Leads</strong><span>推 ${fmtNumber(cell.predictedLeads)} · 实 ${fmtNumber(cell.actualLeads)}</span></article>
          <article><strong>GMV</strong><span>推 ${fmtGmvPlain(cell.predictedGmv)} · 实 ${fmtGmvPlain(cell.actualGmv)}</span></article>
          <article><strong>R值</strong><span>推 ${fmtNumber(cell.predictedR, 2)} · 实 ${fmtNumber(cell.actualR, 2)}</span></article>
        </div>
        <div>
          <h4>主要子渠道</h4>
          ${parts.length ? parts.slice(0, 5).map((item) => `
            <article>
              <strong>${item.subchannelName}</strong>
              <span>GMV ${fmtGmvPlain(item.gmv)} · R ${fmtNumber(item.r, 2)}</span>
            </article>
          `).join("") : `<span class="muted">暂无子渠道拆解。</span>`}
        </div>
      </div>
    `;
    return;
  }
  const analysis = revenueDateAnalysis(calendar, date);
  target.innerHTML = `
    <div class="calendar-detail-head">
      <div>
        <strong>${withWeekday(date)}</strong>
        <span class="${analysis.isActual ? "actual" : "future"}">${analysis.isActual ? "已发生实际" : "未发生推演"}</span>
      </div>
      <b>${fmtGmvPlain(analysis.total.total || 0)}</b>
    </div>
    <p>${analysis.summary}</p>
    <div class="calendar-detail-grid">
      <div>
        <h4>关键营期</h4>
        ${analysis.topCampaigns.length ? analysis.topCampaigns.map(({ row, cell }) => `
          <article>
            <strong>${row.name}</strong>
            <span>${cell.stage} · 推 ${fmtGmvPlain(cell.predictedGmv)} · 实 ${fmtGmvPlain(cell.actualGmv)}</span>
          </article>
        `).join("") : `<span class="muted">当天暂无营期贡献。</span>`}
      </div>
      <div>
        <h4>渠道贡献</h4>
        ${analysis.topSubs.length ? analysis.topSubs.map((item) => `
          <article>
            <strong>${item.name}</strong>
            <span>GMV ${fmtGmvPlain(item.gmv)} · Leads ${fmtNumber(item.leads)}</span>
          </article>
        `).join("") : `<span class="muted">当天暂无子渠道拆解。</span>`}
      </div>
    </div>
  `;
}

function renderRevenueCalendar(month) {
  const calendar = revenueCalendarData(month, scenarioAdjustments());
  if (!state.selectedRevenueDate || !calendar.days.includes(state.selectedRevenueDate)) {
    state.selectedRevenueDate = calendar.latestActualDate && calendar.days.includes(calendar.latestActualDate)
      ? calendar.latestActualDate
      : calendar.days.find((day) => (calendar.totals.get(day)?.total || 0) > 0) || calendar.days[0];
  }
  const label = document.getElementById("revenueWeekLabel");
  if (label) label.textContent = `${month} 全月`;
  const head = `
    <thead>
      <tr>
        <th class="campaign-col">营期</th>
        ${calendar.days.map((day) => {
          const total = calendar.totals.get(day) || {};
          const type = calendar.actualDate && day <= calendar.actualDate ? "actual" : "future";
          return `<th class="calendar-day ${state.selectedRevenueDate === day ? "selected" : ""}" data-revenue-date="${day}"><span>${day.slice(5)} ${weekdayLabel(day).replace("周", "")}</span><strong class="${type}">${fmtGmvPlain(total.total || 0)}</strong></th>`;
        }).join("")}
      </tr>
    </thead>
  `;
  const body = calendar.rows.map((row) => `
    <tr>
      <td class="campaign-col">
        <strong>${row.name}</strong>
        <span>${row.status} · ${row.openDate.slice(5)}</span>
      </td>
      ${calendar.days.map((day) => `<td class="${state.selectedRevenueDate === day && state.selectedRevenueCampaign === row.name ? "selected" : ""}" data-revenue-date="${day}" data-revenue-campaign="${row.name}">${renderCalendarCell(row.cells.get(day))}</td>`).join("")}
    </tr>
  `).join("") || `<tr><td colspan="${calendar.days.length + 1}" class="empty-cell">当前月份暂无 D4-D13 营收数据。</td></tr>`;
  document.getElementById("revenueCalendar").innerHTML = `
    <div class="calendar-table-wrap">
      <table class="revenue-calendar-table">
        ${head}
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
  renderRevenueCalendarDetail(calendar, state.selectedRevenueDate, state.selectedRevenueCampaign);
}

function progressRow(label, actual, target, formatter, estimated = null) {
  const rate = pct(actual, target);
  const estimateRate = estimated === null ? 0 : pct(estimated, target);
  return `
    <div class="progress-row">
      <div>
        <strong>${label}</strong>
        <span>实际 ${formatter(actual)} / 目标 ${formatter(target)}</span>
        ${estimated === null ? "" : `<span>预估 ${formatter(estimated)}</span>`}
      </div>
      <div class="bar-track dual-track">
        ${estimated === null ? "" : `<div class="bar-fill estimate" style="width:${Math.min(100, Math.round(estimateRate * 100))}%"></div>`}
        <div class="bar-fill actual" style="width:${Math.min(100, Math.round(rate * 100))}%"></div>
      </div>
      <b>${fmtPct(rate)}${estimated === null ? "" : `<small>预估 ${fmtPct(estimateRate)}</small>`}</b>
    </div>
  `;
}

function dashboardLine(title, detail) {
  return `<article class="dashboard-line"><strong>${title}</strong><span>${detail}</span></article>`;
}

function renderBudgetBreakdownItem(item) {
  const details = (item.details || []).map((detail) => `
    <tr>
      <td><strong>${detail.name}</strong><br><span class="muted">开课 ${withWeekday(detail.openDate)} · 接量 ${detail.intakeStartDateTime ? `${dateTimeLabel(detail.intakeStartDateTime)} 至 ${dateTimeLabel(detail.intakeEndDateTime)}` : `${withWeekday(detail.intakeStart)} 至 ${withWeekday(detail.intakeEnd)}`}</span></td>
      <td class="num">${fmtNumber(detail.leads)}</td>
      <td class="num">${fmtMoney(detail.targetGmv)}</td>
      <td>${detail.sourceLabel}</td>
      <td>${detail.conversionStages.slice(0, 4).join("、")}${detail.conversionStages.length > 4 ? ` 等${detail.conversionStages.length}天` : ""}</td>
    </tr>
  `).join("");
  return `
    <details class="budget-detail-card">
      <summary>
        <strong>${item.label}</strong>
        <span>Leads ${fmtNumber(item.leads)} · GMV ${fmtMoney(item.targetGmv)} · 营期 ${fmtNumber(new Set(item.campaigns).size)} 个</span>
      </summary>
      ${details ? `
        <div class="mini-table-wrap">
          <table class="mini-table">
            <thead><tr><th>营期</th><th>Leads</th><th>预算GMV</th><th>预算口径</th><th>本月转化日</th></tr></thead>
            <tbody>${details}</tbody>
          </table>
        </div>
      ` : `<p class="muted">当前分类下没有命中的营期。</p>`}
    </details>
  `;
}

function renderPlan() {
  document.getElementById("budgetMonth").value = state.targetMonth;
  const panels = {
    analysis: "planAnalysis",
    snapshot: "planSnapshot",
    campaignBudget: "planCampaignBudget",
  };
  document.querySelectorAll("[data-plan-tab]").forEach((button) => {
    const active = button.dataset.planTab === state.planTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  Object.entries(panels).forEach(([key, idName]) => {
    document.getElementById(idName)?.classList.toggle("active", key === state.planTab);
  });
  renderBudgetAnalysis();
  renderBudgetSnapshot();
  renderCampaignBudgetCalendar();
}

function renderConfig() {
  const panels = {
    channels: "configChannels",
    teachers: "configTeachers",
    campaigns: "configCampaigns",
    traffic: "calendarTargets",
    conversion: "rTemplates",
  };
  document.querySelectorAll("[data-config-tab]").forEach((button) => {
    const active = button.dataset.configTab === state.configTab;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });
  Object.entries(panels).forEach(([key, idName]) => {
    document.getElementById(idName)?.classList.toggle("active", key === state.configTab);
  });
  const channelOptions = (selected) => (state.config.channels || []).map((channel) => `<option value="${channel.id}" ${channel.id === selected ? "selected" : ""}>${channel.name}</option>`).join("");
  const weekdayOptions = (selected) => WEEKDAYS.map((item) => `<option value="${item.value}" ${Number(selected) === item.value ? "selected" : ""}>${item.label}</option>`).join("");
  document.getElementById("channelEditor").innerHTML = (state.config.channels || []).map((item, index) => `
    <div class="editor-row">
      <input data-channel-field="id" data-index="${index}" value="${item.id}" placeholder="id" />
      <input data-channel-field="name" data-index="${index}" value="${item.name}" placeholder="渠道名" />
      <button class="delete-btn" data-delete-channel="${index}">×</button>
    </div>
  `).join("");
  document.getElementById("subchannelEditor").innerHTML = (state.config.subchannels || []).map((item, index) => `
    <div class="editor-row subchannel-row">
      <input data-sub-field="id" data-index="${index}" value="${item.id}" placeholder="id" />
      <select data-sub-field="channelId" data-index="${index}">${channelOptions(item.channelId)}</select>
      <input data-sub-field="name" data-index="${index}" value="${item.name}" placeholder="子渠道名" />
      <button class="delete-btn" data-delete-subchannel="${index}">×</button>
    </div>
  `).join("");
  document.getElementById("teacherEditor").innerHTML = (state.config.teachers || []).map((item, index) => `
    <div class="editor-row">
      <input data-teacher-field="code" data-index="${index}" value="${item.code}" placeholder="缩写" />
      <input data-teacher-field="name" data-index="${index}" value="${item.name}" placeholder="老师名" />
      <button class="delete-btn" data-delete-teacher="${index}">×</button>
    </div>
  `).join("");
  document.getElementById("intakeRuleEditor").innerHTML = (state.config.intakeRules || []).map((rule, ruleIndex) => `
    <article class="intake-rule-card">
      <div class="intake-rule-head">
        <input data-rule-field="name" data-rule-index="${ruleIndex}" value="${rule.name || ""}" placeholder="规则名称" />
        <label><input type="checkbox" data-rule-field="isDefault" data-rule-index="${ruleIndex}" ${rule.isDefault ? "checked" : ""} />默认</label>
        <button class="delete-btn" data-delete-intake-rule="${ruleIndex}">删除</button>
      </div>
      <div class="intake-rule-entries">
        ${(rule.entries || []).map((entry, entryIndex) => `
          <div class="intake-rule-entry">
            <label>开课<select data-rule-entry-field="openWeekday" data-rule-index="${ruleIndex}" data-entry-index="${entryIndex}">${weekdayOptions(entry.openWeekday)}</select></label>
            <label>开始<select data-rule-entry-field="startWeekday" data-rule-index="${ruleIndex}" data-entry-index="${entryIndex}">${weekdayOptions(entry.startWeekday)}</select></label>
            <label>时间<input type="time" data-rule-entry-field="startTime" data-rule-index="${ruleIndex}" data-entry-index="${entryIndex}" value="${normalizeTime(entry.startTime, "10:00")}" /></label>
            <label>结束<select data-rule-entry-field="endWeekday" data-rule-index="${ruleIndex}" data-entry-index="${entryIndex}">${weekdayOptions(entry.endWeekday)}</select></label>
            <label>时间<input type="time" data-rule-entry-field="endTime" data-rule-index="${ruleIndex}" data-entry-index="${entryIndex}" value="${normalizeTime(entry.endTime, "22:00")}" /></label>
            <button class="delete-btn" data-delete-rule-entry="${ruleIndex}:${entryIndex}">×</button>
          </div>
        `).join("")}
      </div>
      <button class="ghost-btn tiny-btn" type="button" data-add-rule-entry="${ruleIndex}">新增开课周几</button>
    </article>
  `).join("");
}

function monthDays(month) {
  const [year, mon] = month.split("-").map(Number);
  const total = new Date(year, mon, 0).getDate();
  return Array.from({ length: total }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}

function renderCalendarTargets() {
  document.getElementById("targetMonth").value = state.targetMonth;
  document.getElementById("budgetMonth").value = state.targetMonth;
  const subs = state.config.subchannels || [];
  const days = monthDays(state.targetMonth);
  renderBudgetAnalysis();
  document.getElementById("targetGrid").innerHTML = `
    <div class="target-row header">
      <span>日期</span>
      ${subs.map((sub) => `<span>${sub.name}</span>`).join("")}
    </div>
    ${days.map((day) => `
      <div class="target-row">
        <strong>${day.slice(5)}</strong>
        ${subs.map((sub) => `<input type="number" min="0" step="1" data-target-date="${day}" data-target-sub="${sub.id}" value="${getTarget(day, sub.id) || ""}" />`).join("")}
      </div>
    `).join("")}
  `;
}

function integrityItem(level, text) {
  return `<article class="integrity-item ${level}"><strong>${statusLabel(level)}</strong><span>${text}</span></article>`;
}

function renderUnmatchedTargetDetails(items) {
  if (!items?.length) return "";
  return `
    <details class="integrity-detail-card" open>
      <summary>查看未命中接量期的 ${items.length} 个 Leads 目标</summary>
      <div class="mini-table-wrap">
        <table class="mini-table">
          <thead><tr><th>日期</th><th>子渠道</th><th>Leads</th><th>操作</th></tr></thead>
          <tbody>
            ${items.map((item) => `
              <tr>
                <td>${withWeekday(item.date)}</td>
                <td>${item.subchannelName}</td>
                <td class="num">${fmtNumber(item.leads)}</td>
                <td><button class="ghost-btn tiny-btn" type="button" data-edit-target-date="${item.date}" data-edit-target-sub="${item.subchannelId}">去修改</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </details>
  `;
}

function renderIntegritySummary(integrity) {
  const items = [
    ...integrity.red.map((text) => ({ level: "danger", text })),
    ...integrity.yellow.map((text) => ({ level: "warn", text })),
    ...integrity.green.map((text) => ({ level: "good", text })),
  ];
  const summary = `
    <div class="integrity-summary">
      <span class="status danger">红 ${integrity.red.length}</span>
      <span class="status warn">黄 ${integrity.yellow.length}</span>
      <span class="status good">绿 ${integrity.green.length}</span>
    </div>
  `;
  if (!items.length) return summary + integrityItem("empty", "暂无可检查的目标数据。");
  const visible = items.slice(0, 4).map((item) => integrityItem(item.level, item.text)).join("");
  const hidden = items.slice(4).map((item) => integrityItem(item.level, item.text)).join("");
  return summary
    + visible
    + renderUnmatchedTargetDetails(integrity.unmatchedTargets || [])
    + (hidden ? `<details class="integrity-more"><summary>查看其余 ${items.length - 4} 条问题</summary>${hidden}</details>` : "");
}

function renderBudgetRevenueBreakdown(analysis) {
  const buckets = Object.values(analysis.breakdown || {}).filter((item) => Number(item.targetGmv || 0) || Number(item.leads || 0));
  if (!buckets.length) return `<article class="dashboard-line"><strong>暂无营收目标</strong><span>当前月份还没有可用于预算拆解的营期和R值目标。</span></article>`;
  const totalGmv = buckets.reduce((sum, item) => sum + Number(item.targetGmv || 0), 0);
  return buckets.map((item) => {
    const share = totalGmv ? Number(item.targetGmv || 0) / totalGmv * 100 : 0;
    return dashboardLine(item.label, `${fmtMoney(item.targetGmv)} · 占预算GMV ${fmtNumber(share, 1)}% · 营期 ${fmtNumber(new Set(item.campaigns).size)} 个`);
  }).join("");
}

function renderBudgetAnalysis() {
  const month = state.targetMonth;
  const analysis = computeBudgetAnalysis(month, { useActuals: false });
  document.getElementById("budgetKpis").innerHTML = [
    kpi(`${month} 月度Leads预算`, fmtNumber(analysis.monthTargetLeads), "自然月接量目标合计", analysis.monthTargetLeads ? "good" : "empty"),
    kpi("可用Leads预算", fmtNumber(analysis.availableLeads), "按营期转化落月拆解", analysis.availableLeads ? "good" : "warn"),
    kpi("预算GMV", fmtMoney(analysis.targetGmv), "可用Leads × R值目标", analysis.targetGmv ? "good" : "warn"),
    kpi("预算营期", fmtNumber(analysis.campaignCount || 0), "与当前月份生命周期相关", analysis.campaignCount ? "good" : "empty"),
  ].join("");
  document.getElementById("budgetBreakdown").innerHTML = Object.values(analysis.breakdown).map(renderBudgetBreakdownItem).join("");
  document.getElementById("budgetRevenueBreakdown").innerHTML = renderBudgetRevenueBreakdown(analysis);
  document.getElementById("budgetIntegrity").innerHTML = renderIntegritySummary(analysis.integrity);
}

function renderBudgetSnapshot() {
  const month = state.targetMonth;
  const analysis = computeBudgetAnalysis(month, { useActuals: false });
  const snapshot = analysis.snapshot;
  const diff = analysis.diff;
  document.getElementById("budgetSnapshotKpis").innerHTML = [
    kpi("首次/最近定版", snapshot ? snapshot.createdAt : "暂无", snapshot ? `${snapshot.month} 固定规划` : "点击固定本次规划后生成", snapshot ? "good" : "empty"),
    kpi("Leads变化", diff ? `${diff.targetLeads >= 0 ? "+" : ""}${fmtNumber(diff.targetLeads)}` : "-", "自然月接量目标", diff ? (diff.targetLeads >= 0 ? "good" : "warn") : "empty"),
    kpi("可用Leads变化", diff ? `${diff.availableLeads >= 0 ? "+" : ""}${fmtNumber(diff.availableLeads)}` : "-", "营期转化落月口径", diff ? (diff.availableLeads >= 0 ? "good" : "warn") : "empty"),
    kpi("预算GMV变化", diff ? `${diff.targetGmv >= 0 ? "+" : ""}${fmtMoney(diff.targetGmv)}` : "-", "相对最近快照", diff ? (diff.targetGmv >= 0 ? "good" : "warn") : "empty"),
    kpi("R值目标变化", diff ? `${diff.rTargetTotal >= 0 ? "+" : ""}${fmtNumber(diff.rTargetTotal, 2)}` : "-", "当前月相关营期D4-D13合计", diff ? (diff.rTargetTotal >= 0 ? "good" : "warn") : "empty"),
  ].join("");
  document.getElementById("budgetSnapshotDiff").innerHTML = analysis.snapshot ? `
    <div class="mini-table-wrap snapshot-table">
      <table class="mini-table">
        <thead><tr><th>变更项</th><th>最近快照</th><th>当前预算</th><th>差异</th><th>影响说明</th></tr></thead>
        <tbody>
          <tr><td>月度Leads预算</td><td class="num">${fmtNumber(snapshot.monthTargetLeads || 0)}</td><td class="num">${fmtNumber(analysis.monthTargetLeads)}</td><td class="num">${diff.targetLeads >= 0 ? "+" : ""}${fmtNumber(diff.targetLeads)}</td><td>来自自然月日历 Leads 目标变化。</td></tr>
          <tr><td>可用Leads预算</td><td class="num">${fmtNumber(snapshot.availableLeads || 0)}</td><td class="num">${fmtNumber(analysis.availableLeads)}</td><td class="num">${diff.availableLeads >= 0 ? "+" : ""}${fmtNumber(diff.availableLeads)}</td><td>受营期接量、开课日期和转化落月影响。</td></tr>
          <tr><td>预算GMV</td><td class="num">${fmtMoney(snapshot.targetGmv || 0)}</td><td class="num">${fmtMoney(analysis.targetGmv)}</td><td class="num">${diff.targetGmv >= 0 ? "+" : ""}${fmtMoney(diff.targetGmv)}</td><td>由可用Leads与D4-D13 R值目标共同决定。</td></tr>
          <tr><td>R值目标</td><td class="num">${fmtNumber(snapshot.rTargetTotal || 0, 2)}</td><td class="num">${fmtNumber(analysis.rTargetTotal || 0, 2)}</td><td class="num">${diff.rTargetTotal >= 0 ? "+" : ""}${fmtNumber(diff.rTargetTotal, 2)}</td><td>当前月份相关营期的D4-D13 R值目标合计变化。</td></tr>
          <tr><td>营期数量</td><td class="num">${fmtNumber(snapshot.campaignCount || 0)}</td><td class="num">${fmtNumber(analysis.campaignCount || 0)}</td><td class="num">${fmtNumber((analysis.campaignCount || 0) - Number(snapshot.campaignCount || 0))}</td><td>当前月份生命周期相关营期数量变化。</td></tr>
        </tbody>
      </table>
    </div>
  ` : `<span class="muted">固定本次规划后，这里会展示相对最近快照的变化。</span>`;
}

function campaignStageRValue(campaign, stage, subRows = null) {
  const rows = subRows || campaignBudgetSubRows(campaign);
  const totalLeads = rows.reduce((sum, row) => sum + Number(row.totalLeads || 0), 0);
  if (!totalLeads) return 0;
  return rows.reduce((sum, row) => sum + Number(row.totalLeads || 0) * Number(row.stageR.get(stage) || 0), 0) / totalLeads;
}

function actualSubchannelLeadMap(actual) {
  const map = new Map();
  (actual?.actualSubchannels || []).forEach((item) => {
    const sub = subchannelByNameOrId(item.category);
    if (!sub) return;
    map.set(sub.id, Number(map.get(sub.id) || 0) + Number(item.actualLeads || 0));
  });
  return map;
}

function budgetRKey(campaignName, subchannelId, stage) {
  return `${campaignName}||${subchannelId}||${stage}`;
}

function budgetSubKey(campaignName, subchannelId) {
  return `${campaignName}||${subchannelId}`;
}

function draftBudgetRValue(campaign, subchannelId, stage, fallback) {
  const key = budgetRKey(campaign.name, subchannelId, stage);
  if (state.campaignBudgetEditMode && Object.prototype.hasOwnProperty.call(state.campaignBudgetDraft || {}, key)) {
    return Number(state.campaignBudgetDraft[key] || 0);
  }
  return Number(fallback || 0);
}

function campaignBudgetSubRows(campaign, targetShare = 1, actual = null) {
  const values = rMap(campaign);
  const subById = Object.fromEntries((state.config.subchannels || []).map((sub) => [sub.id, sub]));
  let leadRows = campaignLeadsBySubchannel(campaign, targetShare);
  const plannedTotal = leadRows.reduce((sum, item) => sum + Number(item.leads || 0), 0);
  if (!plannedTotal && actual) {
    const actualLeadMap = actualSubchannelLeadMap(actual);
    const actualMappedTotal = [...actualLeadMap.values()].reduce((sum, value) => sum + Number(value || 0), 0);
    if (actualMappedTotal) {
      leadRows = (campaign.subchannelIds || []).map((subchannelId) => ({
        subchannelId,
        leads: Number(actualLeadMap.get(subchannelId) || 0),
      }));
    } else if (Number(actual.actualLeads || 0) && (campaign.subchannelIds || []).length) {
      const equalLead = Number(actual.actualLeads || 0) / (campaign.subchannelIds || []).length;
      leadRows = (campaign.subchannelIds || []).map((subchannelId) => ({ subchannelId, leads: equalLead }));
    }
  }
  return leadRows.map((item) => {
    const stageR = new Map(D_STAGES.map((stage) => {
      const fallback = Number(values.get(`${item.subchannelId}|${stage}`) || 0);
      return [stage, draftBudgetRValue(campaign, item.subchannelId, stage, fallback)];
    }));
    const totalR = [...stageR.values()].reduce((sum, value) => sum + Number(value || 0), 0);
    return {
      type: "subchannel",
      name: subById[item.subchannelId]?.name || item.subchannelId,
      parentName: campaign.name,
      subchannelId: item.subchannelId,
      totalLeads: Number(item.leads || 0),
      stageR,
      totalR,
      totalGmv: Number(item.leads || 0) * totalR,
      openDate: campaign.openDate,
      intakeStart: campaign.intakeStart,
      intakeEnd: campaign.intakeEnd,
      d13: campaign.openDate ? addDays(campaign.openDate, 12) : "",
    };
  });
}

function campaignBudgetRows(month) {
  const { start, end } = monthBounds(month);
  const campaigns = planningCampaigns();
  const actuals = actualCampaignMap();
  const shareByName = campaignTargetShareMap(campaigns);
  return campaigns
    .map((campaign) => {
      const d13 = campaign.openDate ? addDays(campaign.openDate, 12) : "";
      const lifecycleStart = [campaign.intakeStart, campaign.openDate].filter(Boolean).sort()[0] || "";
      const lifecycleEnd = [campaign.intakeEnd, d13].filter(Boolean).sort().at(-1) || "";
      const intersectsMonth = lifecycleStart && lifecycleEnd && lifecycleEnd >= start && lifecycleStart <= end;
      if (!intersectsMonth) return null;
      const subRows = campaignBudgetSubRows(campaign, shareByName.get(campaign.name) || 1, actuals.get(campaign.name));
      const totalLeads = subRows.reduce((sum, item) => sum + Number(item.totalLeads || 0), 0);
      const stageR = new Map(D_STAGES.map((stage) => [stage, campaignStageRValue(campaign, stage, subRows)]));
      const totalR = [...stageR.values()].reduce((sum, value) => sum + Number(value || 0), 0);
      const conversionInMonth = D_STAGES.some((stage) => {
        const date = addDays(campaign.openDate, Number(stage.slice(1)) - 1);
        return date >= start && date <= end;
      });
      return {
        ...campaign,
        d13,
        lifecycleStart,
        lifecycleEnd,
        totalLeads,
        stageR,
        totalR,
        totalGmv: subRows.reduce((sum, row) => sum + Number(row.totalGmv || 0), 0),
        subRows: subRows.map((row) => ({ ...row, frozen: !conversionInMonth })),
        frozen: !conversionInMonth,
      };
    })
    .filter(Boolean)
    .sort((a, b) => (a.openDate || "").localeCompare(b.openDate || "") || (a.name || "").localeCompare(b.name || ""));
}

function renderCampaignBudgetCell(row, day) {
  const classes = ["campaign-budget-day"];
  const labels = [];
  const tooltip = [];
  if ([0, 6].includes(weekdayOf(day))) classes.push("weekend");
  const inIntake = row.intakeStart && row.intakeEnd && day >= row.intakeStart && day <= row.intakeEnd;
  const prevDay = addDays(day, -1);
  const nextDay = addDays(day, 1);
  if (inIntake) {
    classes.push("intake");
    if (!(row.intakeStart && row.intakeEnd && prevDay >= row.intakeStart && prevDay <= row.intakeEnd)) classes.push("segment-start");
    if (!(row.intakeStart && row.intakeEnd && nextDay >= row.intakeStart && nextDay <= row.intakeEnd)) classes.push("segment-end");
    labels.push("接");
    tooltip.push(`${withWeekday(day)} 接量期`);
  }
  if (row.openDate && day >= row.openDate && day <= row.d13) {
    const diff = daysBetween(row.openDate, day).length;
    const stage = `D${diff}`;
    classes.push("stage");
    const prevDiff = daysBetween(row.openDate, prevDay).length;
    const nextDiff = daysBetween(row.openDate, nextDay).length;
    if (prevDay < row.openDate || prevDiff < 1 || (D_STAGES.includes(stage) && !D_STAGES.includes(`D${prevDiff}`))) classes.push("segment-start");
    if (nextDay > row.d13 || nextDiff > 13 || (!D_STAGES.includes(stage) && D_STAGES.includes(`D${nextDiff}`))) classes.push("segment-end");
    if (D_STAGES.includes(stage)) {
      classes.push("conversion");
      const rValue = Number(row.stageR.get(stage) || 0);
      if (state.campaignBudgetEditMode && row.type === "subchannel") {
        labels.push(`<input class="campaign-budget-r-input" type="number" min="0" step="0.1" value="${fmtNumber(rValue, 1)}" data-budget-r-campaign="${row.parentName}" data-budget-r-sub="${row.subchannelId}" data-budget-r-stage="${stage}" />`);
      } else {
        labels.push(`<b>${fmtNumber(rValue, 1)}</b>`);
      }
      tooltip.push(`${withWeekday(day)} ${stage} R值 ${fmtNumber(rValue, 1)}`);
    } else {
      labels.push(`<span>${stage}</span>`);
      tooltip.push(`${withWeekday(day)} ${stage}`);
    }
  }
  if (row.frozen) {
    classes.push("frozen");
    tooltip.push("冻结状态");
  }
  if (!labels.length) classes.push("empty");
  return `<span class="${classes.join(" ")}" title="${tooltip.join(" · ")}">${labels.join("")}</span>`;
}

function renderCampaignBudgetRow(row, days, expandedNames) {
  const isSub = row.type === "subchannel";
  const expandable = !isSub && (row.subRows || []).length > 0;
  const expanded = expandedNames.has(row.name);
  const selectedCampaigns = new Set(state.selectedBudgetCampaigns || []);
  const selectedSubs = new Set(state.selectedBudgetSubRows || []);
  const subKey = isSub ? budgetSubKey(row.parentName, row.subchannelId) : "";
  return `
    <div class="campaign-budget-row ${row.frozen ? "frozen" : ""} ${isSub ? "subchannel-row" : "parent-row"}">
      <div class="campaign-budget-name sticky-col name-col" tabindex="0">
        ${state.campaignBudgetEditMode ? `<label class="budget-select">${isSub ? `<input type="checkbox" data-select-budget-sub="${subKey}" ${selectedSubs.has(subKey) ? "checked" : ""} />` : `<input type="checkbox" data-select-budget-campaign="${row.name}" ${selectedCampaigns.has(row.name) ? "checked" : ""} />`}</label>` : (expandable ? `<button class="icon-toggle" type="button" data-toggle-campaign-budget="${row.name}" aria-expanded="${expanded ? "true" : "false"}">${expanded ? "▾" : "▸"}</button>` : `<span class="toggle-spacer"></span>`)}
        <div class="campaign-budget-title">
          <strong>${isSub ? row.name : row.name}</strong>
          <span>${isSub ? "子渠道明细" : (row.inferredFromActual ? "历史导入推测" : "在线建期")}</span>
        </div>
        <div class="campaign-budget-tooltip">
          <b>${isSub ? `${row.parentName} / ${row.name}` : row.name}</b>
          <span>接量：${withWeekday(row.intakeStart)} 至 ${withWeekday(row.intakeEnd)}</span>
          <span>开课：${withWeekday(row.openDate)}</span>
          <span>封板：${withWeekday(row.d13)}</span>
        </div>
      </div>
      <div class="num sticky-col leads-col">${fmtNumber(row.totalLeads)}</div>
      <div class="num sticky-col r-col">${fmtNumber(row.totalR, 1)}</div>
      <div class="num sticky-col gmv-col">${fmtGmvPlain(row.totalGmv)}</div>
      <div class="campaign-budget-days">${days.map((day) => renderCampaignBudgetCell(row, day)).join("")}</div>
    </div>
  `;
}

function renderCampaignBudgetCalendar() {
  const month = state.targetMonth;
  const days = monthDays(month);
  const rows = campaignBudgetRows(month);
  const expandedNames = new Set(state.expandedCampaignBudgetRows || []);
  if (state.campaignBudgetEditMode) {
    rows.forEach((row) => expandedNames.add(row.name));
    state.expandedCampaignBudgetRows = [...expandedNames];
  }
  const renderedRows = rows.flatMap((row) => [
    renderCampaignBudgetRow(row, days, expandedNames),
    ...(expandedNames.has(row.name) ? (row.subRows || []).map((subRow) => renderCampaignBudgetRow(subRow, days, expandedNames)) : []),
  ]).join("");
  document.getElementById("campaignBudgetCalendar").innerHTML = `
    <div class="campaign-budget-legend">
      <span><i class="legend-dot intake"></i>接量期</span>
      <span><i class="legend-dot active"></i>D1-D13</span>
      <span><i class="legend-dot frozen"></i>冻结状态</span>
      <span>父行R值按子渠道Leads加权；展开后查看每个子渠道原始R值目标</span>
    </div>
    <div class="campaign-budget-table" style="--month-days:${days.length};">
      <div class="campaign-budget-header">
        <span class="sticky-col name-col">营期</span>
        <span class="sticky-col leads-col">总Leads</span>
        <span class="sticky-col r-col">总R</span>
        <span class="sticky-col gmv-col">总GMV</span>
        <div class="campaign-budget-days">${days.map((day) => `<span class="${[0, 6].includes(weekdayOf(day)) ? "weekend" : ""}">${Number(day.slice(-2))}（${weekdayShortLabel(day)}）</span>`).join("")}</div>
      </div>
      ${renderedRows || `<div class="campaign-budget-empty">当前月份暂无生命周期相关营期。</div>`}
    </div>
  `;
  renderCampaignBudgetToolbar();
}

function renderCampaignBudgetToolbar() {
  const editing = Boolean(state.campaignBudgetEditMode);
  document.getElementById("editCampaignBudgetR").hidden = editing;
  document.getElementById("batchFillCampaignBudgetR").hidden = !editing;
  document.getElementById("copyCampaignBudgetR").hidden = !editing;
  document.getElementById("saveCampaignBudgetR").hidden = !editing;
  document.getElementById("cancelCampaignBudgetR").hidden = !editing;
}

function setCampaignBudgetDraftValue(campaignName, subchannelId, stage, value) {
  state.campaignBudgetDraft = state.campaignBudgetDraft || {};
  state.campaignBudgetDraft[budgetRKey(campaignName, subchannelId, stage)] = Number(value || 0);
}

function selectedCampaignBudgetTargets() {
  const rows = campaignBudgetRows(state.targetMonth);
  const selectedCampaigns = new Set(state.selectedBudgetCampaigns || []);
  const selectedSubs = new Set(state.selectedBudgetSubRows || []);
  const targets = [];
  rows.forEach((row) => {
    if (selectedCampaigns.has(row.name)) {
      row.subRows.forEach((subRow) => targets.push({ campaignName: row.name, subchannelId: subRow.subchannelId }));
    }
    row.subRows.forEach((subRow) => {
      const key = budgetSubKey(row.name, subRow.subchannelId);
      if (selectedSubs.has(key)) targets.push({ campaignName: row.name, subchannelId: subRow.subchannelId });
    });
  });
  const unique = new Map(targets.map((item) => [budgetSubKey(item.campaignName, item.subchannelId), item]));
  return [...unique.values()];
}

function parseRValuesInput(text) {
  const values = String(text || "")
    .split(/[\s,，、]+/)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  if (values.length === 1) return Array.from({ length: D_STAGES.length }, () => values[0]);
  if (values.length === D_STAGES.length) return values;
  throw new Error("请输入 1 个数字，或按 D4-D13 输入 10 个数字。");
}

function applyRValuesToBudgetTargets(targets, values) {
  targets.forEach((target) => {
    D_STAGES.forEach((stage, index) => {
      setCampaignBudgetDraftValue(target.campaignName, target.subchannelId, stage, values[index]);
    });
  });
}

function enterCampaignBudgetEditMode() {
  state.campaignBudgetEditMode = true;
  state.campaignBudgetDraft = {};
  state.selectedBudgetCampaigns = [];
  state.selectedBudgetSubRows = [];
  renderCampaignBudgetCalendar();
}

function cancelCampaignBudgetEditMode() {
  state.campaignBudgetEditMode = false;
  state.campaignBudgetDraft = {};
  state.selectedBudgetCampaigns = [];
  state.selectedBudgetSubRows = [];
  renderCampaignBudgetCalendar();
}

function mutableCampaignByName(name) {
  const planned = (state.config.campaigns || []).find((campaign) => campaign.name === name);
  if (planned) return planned;
  return (state.config.actualCampaigns || []).find((campaign) => campaign.name === name);
}

function setCampaignOverrideRValue(campaign, subchannelId, stage, value) {
  campaign.rOverrides = campaign.rOverrides || [];
  const existing = campaign.rOverrides.find((item) => item.subchannelId === subchannelId && item.stage === stage);
  if (existing) existing.rValue = Number(value || 0);
  else campaign.rOverrides.push({ subchannelId, stage, rValue: Number(value || 0) });
}

async function saveCampaignBudgetROverrides() {
  const draft = state.campaignBudgetDraft || {};
  let count = 0;
  Object.entries(draft).forEach(([key, value]) => {
    const [campaignName, subchannelId, stage] = key.split("||");
    const campaign = mutableCampaignByName(campaignName);
    if (!campaign || !subchannelId || !stage) return;
    setCampaignOverrideRValue(campaign, subchannelId, stage, value);
    count += 1;
  });
  await saveConfig();
  state.campaignBudgetEditMode = false;
  state.campaignBudgetDraft = {};
  state.selectedBudgetCampaigns = [];
  state.selectedBudgetSubRows = [];
  render();
  setHint(`已保存 ${count} 个营期R值覆盖。`);
}

function batchFillCampaignBudgetR() {
  const targets = selectedCampaignBudgetTargets();
  if (!targets.length) {
    alert("请先勾选要批量编辑的营期或子渠道。");
    return;
  }
  const input = prompt("输入R值：可输入1个数字应用到D4-D13，或输入10个数字分别对应D4-D13。");
  if (input === null) return;
  try {
    applyRValuesToBudgetTargets(targets, parseRValuesInput(input));
    renderCampaignBudgetCalendar();
  } catch (error) {
    alert(error.message);
  }
}

function copyCampaignBudgetR() {
  const selectedSubs = state.selectedBudgetSubRows || [];
  if (selectedSubs.length !== 1) {
    alert("请先只勾选1个子渠道明细行作为复制来源。");
    return;
  }
  const [sourceCampaign, sourceSub] = selectedSubs[0].split("||");
  const sourceRows = campaignBudgetRows(state.targetMonth);
  const sourceCampaignRow = sourceRows.find((row) => row.name === sourceCampaign);
  const sourceSubRow = sourceCampaignRow?.subRows?.find((row) => row.subchannelId === sourceSub);
  if (!sourceSubRow) {
    alert("没有找到复制来源。");
    return;
  }
  const destinationCampaigns = new Set(state.selectedBudgetCampaigns || []);
  const finalTargets = sourceRows
    .filter((row) => destinationCampaigns.has(row.name))
    .flatMap((row) => row.subRows.filter((subRow) => subRow.subchannelId === sourceSub).map((subRow) => ({ campaignName: row.name, subchannelId: subRow.subchannelId })));
  const uniqueTargets = [...new Map(finalTargets.map((item) => [budgetSubKey(item.campaignName, item.subchannelId), item])).values()]
    .filter((target) => target.campaignName !== sourceCampaign || target.subchannelId !== sourceSub);
  if (!uniqueTargets.length) {
    alert("请勾选要复制到的目标营期；系统会复制到目标营期里的同一子渠道。");
    return;
  }
  const values = D_STAGES.map((stage) => Number(sourceSubRow.stageR.get(stage) || 0));
  applyRValuesToBudgetTargets(uniqueTargets, values);
  renderCampaignBudgetCalendar();
}

function getRValue(subchannelId, stage) {
  return Number((state.config.rTemplates || []).find((x) => x.subchannelId === subchannelId && x.stage === stage)?.rValue || 0);
}

function setRValue(subchannelId, stage, value) {
  state.config.rTemplates = state.config.rTemplates || [];
  const existing = state.config.rTemplates.find((x) => x.subchannelId === subchannelId && x.stage === stage);
  if (existing) {
    existing.rValue = Number(value || 0);
  } else {
    state.config.rTemplates.push({ subchannelId, stage, rValue: Number(value || 0) });
  }
}

function collectRTemplateInputs() {
  document.querySelectorAll("[data-r-sub]").forEach((input) => setRValue(input.dataset.rSub, input.dataset.rStage, input.value));
}

function totalRValue(stage) {
  const values = (state.config.subchannels || [])
    .map((sub) => getRValue(sub.id, stage))
    .filter((value) => value > 0);
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function subchannelTotalRValue(subchannelId) {
  const values = D_STAGES
    .map((stage) => getRValue(subchannelId, stage))
    .filter((value) => value > 0);
  return values.reduce((sum, value) => sum + value, 0);
}

function renderRTemplates() {
  document.getElementById("rTemplateHead").innerHTML = `<tr><th>子渠道</th>${D_STAGES.map((stage) => `<th>${stage}</th>`).join("")}</tr>`;
  const totalRow = `
    <tr>
      <td><strong>总R值</strong><br><span class="muted">已填均值</span></td>
      ${D_STAGES.map((stage) => `<td class="num"><strong>${fmtNumber(totalRValue(stage), 2)}</strong></td>`).join("")}
    </tr>
  `;
  const subRows = (state.config.subchannels || []).map((sub) => `
    <tr>
      <td><strong>${sub.name}</strong><br><span class="muted">汇总R值 ${fmtNumber(subchannelTotalRValue(sub.id), 2)}</span></td>
      ${D_STAGES.map((stage) => `<td><input type="number" min="0" step="0.1" data-r-sub="${sub.id}" data-r-stage="${stage}" value="${getRValue(sub.id, stage) || ""}" /></td>`).join("")}
    </tr>
  `).join("");
  document.getElementById("rTemplateRows").innerHTML = totalRow + subRows;
  document.getElementById("rTemplateCampaignList").innerHTML = planningCampaigns().map((campaign) => `
    <label><input type="checkbox" data-copy-campaign-name="${campaign.name}" />${campaign.name}${campaign.inferredFromActual ? "（历史导入）" : ""}</label>
  `).join("") || `<p class="muted">还没有已建立营期。</p>`;
}

function renderBuilder() {
  const oneClickMonth = document.getElementById("oneClickMonth");
  if (oneClickMonth && !oneClickMonth.value) oneClickMonth.value = state.targetMonth || formatLocalDay(new Date()).slice(0, 7);
  document.getElementById("teacherCode").innerHTML = (state.config.teachers || []).map((item) => `<option value="${item.code}">${item.code}</option>`).join("");
  const rules = state.config.intakeRules || [];
  document.getElementById("intakeRuleSelect").innerHTML = `
    ${rules.map((rule) => `<option value="${rule.id}" ${rule.isDefault ? "selected" : ""}>${intakeRuleLabel(rule)}</option>`).join("")}
    <option value="custom">自定义接量日期</option>
  `;
  document.getElementById("openWeekdays").innerHTML = WEEKDAYS.map((item) => `
    <label><input type="checkbox" value="${item.value}" ${item.value === 1 || item.value === 4 ? "checked" : ""} />${item.label}</label>
  `).join("");
  document.getElementById("builderSubchannels").innerHTML = (state.config.subchannels || []).map((item) => `
    <label><input type="checkbox" value="${item.id}" checked />${item.name}</label>
  `).join("");
  renderCampaignConfigRows();
}

function campaignLifecycleRange(campaign) {
  const d13 = campaign.openDate ? addDays(campaign.openDate, 12) : "";
  const start = [campaign.intakeStart, campaign.openDate].filter(Boolean).sort()[0] || "";
  const end = [campaign.intakeEnd, d13].filter(Boolean).sort().at(-1) || "";
  return { start, end, d13 };
}

function monthKeysBetween(start, end) {
  if (!start || !end) return [];
  const keys = [];
  let cursor = `${start.slice(0, 7)}-01`;
  const endMonth = end.slice(0, 7);
  while (cursor.slice(0, 7) <= endMonth) {
    keys.push(cursor.slice(0, 7));
    const [year, month] = cursor.slice(0, 7).split("-").map(Number);
    cursor = `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01`;
  }
  return keys;
}

function campaignIntersectsMonth(campaign, monthStart, monthEnd) {
  const { start, end } = campaignLifecycleRange(campaign);
  return Boolean(start && end && end >= monthStart && start <= monthEnd);
}

function renderCampaignConfigRows() {
  const generated = planningCampaigns();
  const months = [...new Set(generated.flatMap((item) => {
    const { start, end } = campaignLifecycleRange(item);
    return monthKeysBetween(start, end);
  }))].sort();
  if (!state.builderMonth && months.length) state.builderMonth = months.at(-1);
  const monthFilter = document.getElementById("builderMonthFilter");
  if (monthFilter) {
    monthFilter.min = months[0] || "";
    monthFilter.max = months.at(-1) || "";
    monthFilter.value = state.builderMonth || "";
  }
  const sortButton = document.getElementById("toggleBuilderSort");
  if (sortButton) sortButton.textContent = state.builderSort === "asc" ? "开课日期正序" : "开课日期倒序";
  const month = state.builderMonth || months.at(-1) || formatLocalDay(new Date()).slice(0, 7);
  const days = monthDays(month);
  const monthStart = days[0];
  const monthEnd = days.at(-1);
  const subById = Object.fromEntries((state.config.subchannels || []).map((sub) => [sub.id, sub]));
  const teacherCodes = new Set((state.config.teachers || []).map((teacher) => teacher.code));
  const ruleById = new Map((state.config.intakeRules || []).map((rule) => [rule.id, rule]));
  const rows = generated
    .filter((item) => campaignIntersectsMonth(item, monthStart, monthEnd))
    .sort((a, b) => {
      const left = a.openDate || "";
      const right = b.openDate || "";
      return state.builderSort === "asc" ? left.localeCompare(right) : right.localeCompare(left);
    });
  const selectableNames = new Set(rows.filter((item) => !item.inferredFromActual).map((item) => item.name));
  state.selectedBuilderCampaigns = (state.selectedBuilderCampaigns || []).filter((name) => selectableNames.has(name));
  const selectedNames = new Set(state.selectedBuilderCampaigns || []);
  const selectAll = document.getElementById("selectAllCampaignRows");
  if (selectAll) {
    selectAll.checked = selectableNames.size > 0 && [...selectableNames].every((name) => selectedNames.has(name));
    selectAll.indeterminate = selectedNames.size > 0 && !selectAll.checked;
    selectAll.disabled = selectableNames.size === 0;
  }
  document.getElementById("campaignConfigCount").textContent = `${rows.length}/${generated.length} · 已选 ${selectedNames.size}`;
  const overlapNames = campaignIntakeOverlapNames(rows);
  document.getElementById("campaignConfigRows").style.setProperty("--timeline-days", days.length);
  document.getElementById("campaignConfigRows").innerHTML = `
    <div class="campaign-shell-legend">
      <span><i class="legend-dot intake"></i>接量期</span>
      <span><i class="legend-dot active"></i>开课后 D1-D13</span>
      <span><i class="open-marker sample"></i>开课日</span>
      <span><i class="legend-outline"></i>需检查</span>
    </div>
    <div class="campaign-shell-header">
      <span>状态</span>
      <span>营期</span>
      <span>老师</span>
      <span>操作</span>
      <div class="timeline-grid">${days.map((day) => `<span class="${[0, 6].includes(weekdayOf(day)) ? "weekend" : ""}">${Number(day.slice(-2))}（${weekdayShortLabel(day)}）</span>`).join("")}</div>
    </div>
    ${rows.map((item) => renderCampaignShellRow(item, {
      days,
      monthStart,
      monthEnd,
      selectedNames,
      subById,
      teacherCodes,
      ruleById,
      overlapNames,
    })).join("") || `<div class="empty-cell campaign-shell-empty">当前月份没有已建立营期。</div>`}
  `;
  renderCampaignSubSyncPanel(month, rows, subById);
}

function renderCampaignSubSyncPanel(month, rows, subById) {
  const panel = document.getElementById("campaignSubSyncPanel");
  if (!panel) return;
  panel.hidden = !state.campaignSubSyncOpen;
  if (!state.campaignSubSyncOpen) {
    panel.innerHTML = "";
    return;
  }
  const rowNames = rows.map((campaign) => campaign.name);
  if (state.campaignSubSyncAll) {
    state.campaignSubSyncCampaigns = rowNames;
  } else {
    const visible = new Set(rowNames);
    state.campaignSubSyncCampaigns = (state.campaignSubSyncCampaigns || []).filter((name) => visible.has(name));
  }
  const selectedCampaigns = new Set(state.campaignSubSyncCampaigns || []);
  const selectedSubs = new Set(state.campaignSubSyncSubs || []);
  const subs = state.config.subchannels || [];
  panel.innerHTML = `
    <div class="campaign-sub-sync-head">
      <div>
        <h3>同步子渠道到营期</h3>
        <p class="muted">只把子渠道加入营期结构；已有或后续填写的接量期 Leads 会自动计入预算，不会覆盖已有 Leads。</p>
      </div>
      <div class="toolbar compact">
        <button class="primary-btn" id="saveCampaignSubSync" type="button">保存同步</button>
        <button class="ghost-btn" id="closeCampaignSubSync" type="button">关闭</button>
      </div>
    </div>
    <label class="sync-all-row">
      <input id="campaignSubSyncAll" type="checkbox" ${state.campaignSubSyncAll ? "checked" : ""} />
      同步到 ${month} 全部营期
    </label>
    <div class="campaign-sub-sync-grid">
      <section>
        <strong>将同步的营期</strong>
        <div class="campaign-sub-sync-list">
          ${rows.map((campaign) => {
            const subNames = (campaign.subchannelIds || []).map((subId) => subById[subId]?.name || subId).join("、") || "未选子渠道";
            return `
              <label>
                <input type="checkbox" data-sync-campaign="${campaign.name}" ${selectedCampaigns.has(campaign.name) ? "checked" : ""} />
                <span><b>${campaign.name}</b><small>${campaign.inferredFromActual ? "历史导入推测" : "在线建期"} · ${subNames}</small></span>
              </label>
            `;
          }).join("") || `<p class="muted">当前月份没有可同步的营期。</p>`}
        </div>
      </section>
      <section>
        <strong>选择要加入的子渠道</strong>
        <div class="campaign-sub-sync-list sub-list">
          ${subs.map((sub) => `
            <label>
              <input type="checkbox" data-sync-sub="${sub.id}" ${selectedSubs.has(sub.id) ? "checked" : ""} />
              <span><b>${sub.name}</b><small>${sub.id}</small></span>
            </label>
          `).join("") || `<p class="muted">还没有子渠道配置。</p>`}
        </div>
      </section>
    </div>
  `;
}

function mutableCampaignsByName(name) {
  const planned = (state.config.campaigns || []).filter((campaign) => campaign.name === name);
  if (planned.length) return planned;
  return (state.config.actualCampaigns || []).filter((campaign) => campaign.name === name);
}

function addSubchannelsToCampaign(campaign, subIds) {
  const current = new Set(campaign.subchannelIds || []);
  let changed = 0;
  subIds.forEach((subId) => {
    if (current.has(subId)) return;
    current.add(subId);
    changed += 1;
  });
  campaign.subchannelIds = [...current];
  return changed;
}

async function saveCampaignSubSync() {
  const campaignNames = state.campaignSubSyncCampaigns || [];
  const subIds = state.campaignSubSyncSubs || [];
  if (!campaignNames.length) {
    alert("请先选择要同步的营期。");
    return;
  }
  if (!subIds.length) {
    alert("请先选择要加入的子渠道。");
    return;
  }
  let campaignCount = 0;
  let addedCount = 0;
  campaignNames.forEach((name) => {
    const targets = mutableCampaignsByName(name);
    targets.forEach((campaign) => {
      const added = addSubchannelsToCampaign(campaign, subIds);
      if (added) {
        campaignCount += 1;
        addedCount += added;
      }
    });
  });
  if (!addedCount) {
    setHint("选择的子渠道已经在这些营期里，无需同步。");
    return;
  }
  await saveConfig();
  state.campaignSubSyncOpen = false;
  state.campaignSubSyncAll = false;
  state.campaignSubSyncCampaigns = [];
  state.campaignSubSyncSubs = [];
  render();
  setHint(`已同步 ${addedCount} 个子渠道归属，涉及 ${campaignCount} 个营期。`);
}

function campaignShellStatus(campaign, context) {
  const chips = [];
  const severity = { kind: "normal", label: "正常" };
  if (campaign.inferredFromActual) {
    chips.push({ kind: "warn", label: "历史推测" });
    severity.kind = "warn";
    severity.label = "历史推测";
  }
  if (context.overlapNames.has(campaign.name)) {
    chips.push({ kind: "danger", label: "接量重叠" });
    severity.kind = "danger";
    severity.label = "接量重叠";
  }
  if (campaign.teacherCode && !context.teacherCodes.has(campaign.teacherCode)) {
    chips.push({ kind: "danger", label: "缺讲师" });
    severity.kind = "danger";
    severity.label = "缺讲师";
  }
  const missingSubs = (campaign.subchannelIds || []).filter((subId) => !context.subById[subId]);
  if (missingSubs.length) {
    chips.push({ kind: "danger", label: "缺子渠道" });
    severity.kind = "danger";
    severity.label = "缺子渠道";
  }
  if (campaign.intakeRuleId && !context.ruleById.has(campaign.intakeRuleId)) {
    chips.push({ kind: "warn", label: "规则缺失" });
    if (severity.kind === "normal") {
      severity.kind = "warn";
      severity.label = "规则缺失";
    }
  }
  return { severity, chips: chips.length ? chips : [severity] };
}

function campaignIntakeOverlapNames(campaigns) {
  const names = new Set();
  campaigns.forEach((campaign, index) => {
    if (!campaign.intakeStart || !campaign.intakeEnd) return;
    if (campaign.inferredFromActual) return;
    const leftStart = campaign.intakeStartDateTime || dateTimeValue(campaign.intakeStart, "00:00");
    const leftEnd = campaign.intakeEndDateTime || dateTimeValue(campaign.intakeEnd, "23:59");
    const leftSubs = new Set(campaign.subchannelIds || []);
    campaigns.slice(index + 1).forEach((other) => {
      if (!other.intakeStart || !other.intakeEnd) return;
      if (other.inferredFromActual) return;
      const rightStart = other.intakeStartDateTime || dateTimeValue(other.intakeStart, "00:00");
      const rightEnd = other.intakeEndDateTime || dateTimeValue(other.intakeEnd, "23:59");
      const sameMajorCampaign = Number(campaign.baseNo || 0) > 0
        && Number(campaign.baseNo || 0) === Number(other.baseNo || 0)
        && campaign.openDate
        && campaign.openDate === other.openDate;
      if (sameMajorCampaign) return;
      const shareSub = (other.subchannelIds || []).some((subId) => leftSubs.has(subId));
      if (shareSub && leftStart < rightEnd && rightStart < leftEnd) {
        names.add(campaign.name);
        names.add(other.name);
      }
    });
  });
  return names;
}

function dayGridLine(day, days) {
  const index = days.indexOf(day);
  if (index >= 0) return index + 1;
  return day < days[0] ? 1 : days.length + 1;
}

function segmentStyle(startDay, endDay, days) {
  const start = dayGridLine(startDay, days);
  const end = Math.max(start + 1, dayGridLine(addDays(endDay, 1), days));
  return `grid-column:${start}/${Math.min(end, days.length + 1)};`;
}

function renderCampaignShellRow(item, context) {
  const { days, selectedNames, subById, ruleById } = context;
  const status = campaignShellStatus(item, context);
  const d13 = item.openDate ? addDays(item.openDate, 12) : "";
  const hasIntake = item.intakeStart && item.intakeEnd && item.intakeEnd >= days[0] && item.intakeStart <= days.at(-1);
  const hasActive = item.openDate && d13 >= days[0] && item.openDate <= days.at(-1);
  const subNames = (item.subchannelIds || []).map((subId) => subById[subId]?.name || subId).join("、") || "未选子渠道";
  const ruleName = ruleById.get(item.intakeRuleId)?.name || (item.intakeRuleId ? item.intakeRuleId : "自定义接量日期");
  const intakeLabel = item.intakeStartDateTime
    ? `${compactDateTimeLabel(item.intakeStartDateTime)}-${compactDateTimeLabel(item.intakeEndDateTime)}`
    : `${withWeekday(item.intakeStart)} 至 ${withWeekday(item.intakeEnd)}`;
  return `
    <div class="campaign-shell-row ${status.severity.kind}">
      <div class="campaign-shell-status">${status.chips.map((chip) => `<span class="shell-chip ${chip.kind}">${chip.label}</span>`).join("")}</div>
      <div class="campaign-shell-name" tabindex="0">
        <strong>${item.name}</strong>
        <span>${item.inferredFromActual ? "历史导入推测" : "在线建期"}</span>
        <div class="campaign-shell-tooltip">
          <b>${item.name}</b>
          <span>接量：${intakeLabel}</span>
          <span>开课：${withWeekday(item.openDate)}</span>
          <span>封板：${withWeekday(d13)}</span>
          <span>子渠道：${subNames}</span>
          <span>接量规则：${ruleName}</span>
        </div>
      </div>
      <div class="campaign-shell-teacher">${item.teacherCode || "-"}</div>
      <div class="campaign-shell-actions">
        ${item.inferredFromActual ? `<span class="tag">历史导入</span>` : `<label class="shell-select"><input type="checkbox" data-select-campaign="${item.name}" ${selectedNames.has(item.name) ? "checked" : ""} />选择</label><button class="delete-btn" type="button" data-delete-campaign="${item.name}">删除</button>`}
      </div>
      <div class="campaign-shell-lane timeline-grid">
        ${hasIntake ? `<div class="timeline-segment intake" style="${segmentStyle(item.intakeStart, item.intakeEnd, days)}" title="${intakeLabel}"><span>接量</span></div>` : ""}
        ${hasActive ? `<div class="timeline-segment active" style="${segmentStyle(item.openDate, d13, days)}" title="开课 ${withWeekday(item.openDate)} 至 封板 ${withWeekday(d13)}"><span>D1-D13</span></div>` : ""}
        ${item.openDate && days.includes(item.openDate) ? `<i class="open-marker" style="grid-column:${dayGridLine(item.openDate, days)};"></i>` : ""}
      </div>
    </div>
  `;
}

function compactDateTimeLabel(value) {
  const [day, time = ""] = String(value || "").split("T");
  return `${String(day || "").slice(5)} ${time.slice(0, 5)}`;
}

function shortDayWithWeekday(day) {
  return `${String(day || "").slice(5)}（${weekdayLabel(day)}）`;
}

function renderCampaigns() {
  const source = campaignSource();
  const search = document.getElementById("campaignSearch").value.trim().toLowerCase();
  const mode = document.getElementById("campaignModeFilter")?.value || "abnormal";
  const stage = document.getElementById("stageFilter").value;
  const stages = LIFECYCLE_STAGES.filter((item) => source.some((x) => (x.lifecycleStage || lifecycleStage(x)) === item));
  document.getElementById("stageFilter").innerHTML = `<option value="">全部阶段</option>${stages.map((x) => `<option ${x === stage ? "selected" : ""}>${x}</option>`).join("")}`;
  const rows = source.filter((item) => {
    const currentStage = item.lifecycleStage || lifecycleStage(item);
    const haystack = `${item.name} ${currentStage} ${item.stage} ${item.categories || ""}`.toLowerCase();
    const targetGmv = Number(item.targetGmv || 0);
    const actualGmv = Number(item.actualGmv ?? item.gmv ?? 0);
    const targetLeads = Number(item.targetLeads || 0);
    const actualLeads = Number(item.actualLeads ?? item.leads ?? 0);
    const hasActual = item.actualImported || Number(item.actualGmv ?? item.gmv ?? item.actualLeads ?? item.leads ?? 0) > 0;
    const abnormal = item.unmatchedPlan
      || currentStage === "未匹配"
      || (hasActual && targetGmv > 0 && actualGmv / targetGmv < 0.8)
      || (hasActual && targetLeads > 0 && (actualLeads / targetLeads < 0.8 || actualLeads / targetLeads > 1.2));
    return (!search || haystack.includes(search)) && (!stage || currentStage === stage) && (mode === "all" || abnormal);
  });
  document.getElementById("campaignRows").innerHTML = rows.map((item) => `
    <tr>
      <td><strong>${item.name}</strong><br><span class="muted">${item.openDate || "-"} · 接量 ${item.intakeStart || "-"} 至 ${item.intakeEnd || "-"}</span></td>
      <td><span class="status ${item.unmatchedPlan || item.lifecycleStage === "未匹配" ? "warn" : "good"}">${item.unmatchedPlan ? "未匹配规划" : (item.lifecycleStage || lifecycleStage(item))}</span></td>
      <td>${displayDx(item.stage)}</td>
      <td class="num">${fmtNumber(item.actualLeads ?? item.leads ?? item.targetLeads)}<span class="planned-value">规划 ${fmtNumber(item.targetLeads || 0)}</span></td>
      <td class="num">${fmtMoney(item.actualGmv ?? item.gmv ?? 0)}<span class="planned-value">规划 ${fmtMoney(item.targetGmv || 0)}</span></td>
      <td class="num">${fmtNumber(item.fullPriceStudents)}</td>
      <td class="num">${fmtPct(item.conversionRate)}</td>
      <td class="num">${fmtNumber(item.roi, 2)}</td>
      <td class="num">${fmtNumber(item.rValue, 2)}<br><span class="muted">目标 ${fmtNumber(item.targetR, 2)}</span></td>
      <td><div class="r-strip">${
        item.actualSubchannels?.length
          ? item.actualSubchannels.map((x) => `<span class="tag ${x.actualGmv ? "good" : "empty"}">${x.category}: ${fmtNumber(x.actualLeads)} / ${fmtMoney(x.actualGmv)}</span>`).join("")
          : (item.subTargets || []).map((x) => `<span class="tag ${x.targetR ? "good" : "empty"}">${x.subchannelName}: ${fmtNumber(x.targetR, 2)}</span>`).join("") || "<span class='muted'>暂无拆解</span>"
      }</div></td>
    </tr>
  `).join("") || `<tr><td colspan="10" class="empty-cell">当前筛选下没有营期。可以切换为“全部营期”查看完整列表。</td></tr>`;
}

function campaignLeadsBySubchannel(campaign, targetShare = 1) {
  const intakeDays = campaignIntakeDays(campaign);
  return (campaign.subchannelIds || []).map((subId) => ({
    subchannelId: subId,
    leads: intakeDays.reduce((sum, item) => sum + getTarget(item.day, subId) * item.weight, 0) * targetShare,
  }));
}

function addDailyBucket(map, date) {
  if (!map.has(date)) {
    map.set(date, {
      date,
      targetLeads: 0,
      actualLeads: 0,
      targetGmv: 0,
      actualGmv: 0,
      fullPriceStudents: 0,
      subchannels: [],
    });
  }
  return map.get(date);
}

function addDailySubchannel(row, subchannelId) {
  let sub = row.subchannels.find((item) => item.subchannelId === subchannelId);
  if (!sub) {
    sub = {
      subchannelId,
      targetLeads: 0,
      actualLeads: 0,
      targetGmv: 0,
      actualGmv: 0,
    };
    row.subchannels.push(sub);
  }
  return sub;
}

function computeDailyRows() {
  if (state.data?.daily?.length) return state.data.daily;
  const daily = new Map();
  const actuals = actualCampaignMap();
  const campaigns = planningCampaigns();
  const shareByName = campaignTargetShareMap(campaigns);
  for (const target of state.config.leadTargets || []) {
    const row = addDailyBucket(daily, target.date);
    const leads = Number(target.leads || 0);
    row.targetLeads += leads;
    addDailySubchannel(row, target.subchannelId).targetLeads += leads;
  }
  for (const campaign of campaigns) {
    const subLeads = campaignLeadsBySubchannel(campaign, shareByName.get(campaign.name) || 1);
    const totalLeads = subLeads.reduce((sum, item) => sum + item.leads, 0);
    const campaignR = rMap(campaign);
    D_STAGES.forEach((stage) => {
      const date = addDays(campaign.openDate, Number(stage.slice(1)) - 1);
      const row = addDailyBucket(daily, date);
      subLeads.forEach((item) => {
        const targetGmv = item.leads * Number(campaignR.get(`${item.subchannelId}|${stage}`) || 0);
        row.targetGmv += targetGmv;
        addDailySubchannel(row, item.subchannelId).targetGmv += targetGmv;
      });
    });
    const actual = actuals.get(campaign.name);
    if (actual?.actualLeads && campaign.intakeStart && campaign.intakeEnd) {
      const days = campaignIntakeDays(campaign);
      const totalWeight = days.reduce((sum, item) => sum + item.weight, 0) || days.length || 1;
      days.forEach(({ day: date, weight }) => {
        const dayLeads = actual.actualLeads * (weight / totalWeight);
        const row = addDailyBucket(daily, date);
        row.actualLeads += dayLeads;
        (campaign.subchannelIds || []).forEach((subId) => {
          addDailySubchannel(row, subId).actualLeads += dayLeads / Math.max((campaign.subchannelIds || []).length, 1);
        });
      });
    }
    if (actual?.rBreakdown) {
      D_STAGES.forEach((stage) => {
        const rValue = Number(actual.rBreakdown[`${stage}-R值`] || 0);
        if (!rValue) return;
        const date = addDays(actual.openDate || campaign.openDate, Number(stage.slice(1)) - 1);
        const row = addDailyBucket(daily, date);
        const actualGmv = Number(actual.actualLeads || totalLeads || 0) * rValue;
        row.actualGmv += actualGmv;
        (campaign.subchannelIds || []).forEach((subId) => {
          addDailySubchannel(row, subId).actualGmv += actualGmv / Math.max((campaign.subchannelIds || []).length, 1);
        });
      });
    }
  }
  return [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)).map((row) => ({
    ...row,
    leadsRate: pct(row.actualLeads, row.targetLeads),
    gmvRate: pct(row.actualGmv, row.targetGmv),
    subchannels: row.subchannels.map((sub) => ({
      ...sub,
      leadsRate: pct(sub.actualLeads, sub.targetLeads),
      gmvRate: pct(sub.actualGmv, sub.targetGmv),
    })),
  }));
}

function renderDaily() {
  const monthFilter = document.getElementById("dailyMonthFilter");
  const selectedSub = document.getElementById("dailySubchannelFilter").value;
  const options = (state.config.subchannels || []).map((sub) => `<option value="${sub.id}" ${selectedSub === sub.id ? "selected" : ""}>${sub.name}</option>`).join("");
  document.getElementById("dailySubchannelFilter").innerHTML = `<option value="">全部子渠道</option>${options}`;
  let rows = computeDailyRows();
  const months = [...new Set(rows.map((row) => row.date.slice(0, 7)).filter(Boolean))].sort();
  if (!state.dailyMonth && months.length) state.dailyMonth = months.at(-1);
  monthFilter.innerHTML = `<option value="">全部月份</option>${months.map((month) => `<option value="${month}" ${state.dailyMonth === month ? "selected" : ""}>${month}</option>`).join("")}`;
  if (state.dailyMonth) rows = rows.filter((row) => row.date.startsWith(state.dailyMonth));
  if (selectedSub) {
    rows = rows.map((row) => {
      const sub = (row.subchannels || []).find((x) => x.subchannelId === selectedSub) || {};
      return {
        ...row,
        targetLeads: sub.targetLeads || 0,
        actualLeads: sub.actualLeads || 0,
        leadsRate: sub.leadsRate || 0,
        targetGmv: sub.targetGmv || 0,
        actualGmv: sub.actualGmv || 0,
        gmvRate: sub.gmvRate || 0,
      };
    });
  }
  rows = rows.slice(-45);
  document.getElementById("dailyBars").innerHTML = renderMonthlyProgressChart(rows);
  document.getElementById("dailyRows").innerHTML = rows.map((item) => `
    <tr>
      <td>${item.date}</td>
      <td class="num">${fmtNumber(item.targetLeads)}</td>
      <td class="num">${fmtNumber(item.actualLeads)}</td>
      <td class="num"><span class="status ${rateStatus(item.leadsRate, "leads")}">${fmtPct(item.leadsRate)}</span></td>
      <td class="num">${fmtMoney(item.targetGmv)}</td>
      <td class="num">${fmtMoney(item.actualGmv)}</td>
      <td class="num"><span class="status ${rateStatus(item.gmvRate, "gmv")}">${fmtPct(item.gmvRate)}</span></td>
      <td class="num">${fmtNumber(item.fullPriceStudents)}</td>
    </tr>
  `).join("");
}

function renderMonthlyProgressChart(rows) {
  if (!rows.length) return `<p class="muted">暂无月度进度数据。</p>`;
  const totalTarget = rows.reduce((sum, row) => sum + Number(row.targetGmv || 0), 0);
  if (!totalTarget) return `<p class="muted">当前月份暂无 GMV 规划，无法生成预计达成线。</p>`;
  let cumulativeTarget = 0;
  let cumulativeActual = 0;
  const points = rows.map((row, index) => {
    cumulativeTarget += Number(row.targetGmv || 0);
    cumulativeActual += Number(row.actualGmv || 0);
    return {
      date: row.date,
      index,
      actualRate: cumulativeActual / totalTarget,
      planRate: cumulativeTarget / totalTarget,
      cumulativeActual,
      cumulativeTarget,
    };
  });
  const maxRate = Math.max(1, ...points.map((item) => Math.max(item.actualRate, item.planRate))) * 1.08;
  const width = 1000;
  const height = 260;
  const left = 54;
  const right = 24;
  const top = 24;
  const bottom = 42;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const xFor = (index) => left + (points.length === 1 ? 0 : (index / (points.length - 1)) * chartWidth);
  const yFor = (rate) => top + chartHeight - (rate / maxRate) * chartHeight;
  const lineFor = (key) => points.map((item) => `${xFor(item.index).toFixed(1)},${yFor(item[key]).toFixed(1)}`).join(" ");
  const tickRates = [0, 0.25, 0.5, 0.75, 1].filter((rate) => rate <= maxRate);
  const latest = points.at(-1);
  const dateLabels = points.filter((_, index) => index === 0 || index === points.length - 1 || index % 5 === 0);
  return `
    <div class="line-chart-wrap">
      <svg class="line-chart" viewBox="0 0 ${width} ${height}" role="img" aria-label="月度GMV达成趋势">
        ${tickRates.map((rate) => `
          <line x1="${left}" y1="${yFor(rate)}" x2="${width - right}" y2="${yFor(rate)}" class="grid-line" />
          <text x="12" y="${yFor(rate) + 4}" class="axis-label">${fmtPct(rate)}</text>
        `).join("")}
        ${dateLabels.map((item) => `
          <text x="${xFor(item.index)}" y="${height - 12}" text-anchor="middle" class="axis-label">${item.date.slice(5)}</text>
        `).join("")}
        <polyline class="progress-line plan" points="${lineFor("planRate")}" />
        <polyline class="progress-line actual" points="${lineFor("actualRate")}" />
        ${points.map((item) => `
          <circle class="progress-dot plan" cx="${xFor(item.index)}" cy="${yFor(item.planRate)}" r="3" />
          <circle class="progress-dot actual" cx="${xFor(item.index)}" cy="${yFor(item.actualRate)}" r="3" />
        `).join("")}
      </svg>
      <div class="chart-summary">
        <span>实际累计 ${fmtMoney(latest.cumulativeActual)} · ${fmtPct(latest.actualRate)}</span>
        <span>预计累计 ${fmtMoney(latest.cumulativeTarget)} · ${fmtPct(latest.planRate)}</span>
      </div>
    </div>
  `;
}

function aggregateActualChannels(level, month = "") {
  const groups = new Map();
  for (const actual of actualCampaignMap().values()) {
    if (month && !(actual.openDate || "").startsWith(month)) continue;
    const source = level === "studios" ? (actual.studioTotals || []) : (actual.actualSubchannels || []);
    for (const item of source) {
      const key = level === "studios" ? item.studio : item.category;
      if (!key) continue;
      if (!groups.has(key)) {
        groups.set(key, { scope: level === "studios" ? "工作室汇总" : "子渠道明细", category: key, leads: 0, gmv: 0, spend: 0, fullPriceStudents: 0 });
      }
      const group = groups.get(key);
      group.leads += Number(item.actualLeads || 0);
      group.gmv += Number(item.actualGmv || 0);
      group.spend += Number(item.spend || 0);
    }
  }
  return [...groups.values()].map((item) => ({
    ...item,
    conversionRate: pct(item.fullPriceStudents, item.leads),
    roi: pct(item.gmv, item.spend),
    rValue: pct(item.gmv, item.leads),
  })).sort((a, b) => b.gmv - a.gmv);
}

function renderChannels() {
  const level = document.getElementById("channelLevelFilter")?.value || "subchannels";
  const rows = aggregateActualChannels(level).length ? aggregateActualChannels(level) : (state.data?.channels || []);
  document.getElementById("channelRows").innerHTML = rows.map((item) => `
    <tr>
      <td>${item.scope}</td>
      <td><strong>${item.category}</strong></td>
      <td class="num">${fmtNumber(item.leads)}</td>
      <td class="num">${fmtMoney(item.gmv)}</td>
      <td class="num">${fmtMoney(item.spend)}</td>
      <td class="num">${fmtNumber(item.fullPriceStudents)}</td>
      <td class="num">${fmtPct(item.conversionRate)}</td>
      <td class="num"><span class="status ${item.roi >= 1 ? "good" : item.roi ? "warn" : "empty"}">${fmtNumber(item.roi, 2)}</span></td>
      <td class="num">${fmtNumber(item.rValue, 2)}</td>
    </tr>
  `).join("") || `<tr><td colspan="9" class="muted">导入结果 CSV 后显示渠道分类分析。</td></tr>`;
}

const CHANNEL_ANALYSIS_METRICS = {
  rows: { label: "行数", format: fmtNumber },
  leads: { label: "Leads", format: fmtNumber },
  spend: { label: "消耗", format: fmtMoney },
  income: { label: "收入", format: fmtMoney },
  gmv: { label: "成交额", format: fmtMoney },
  cpl: { label: "CPL", format: (value) => fmtMoney(value) },
  roi: { label: "ROI", format: (value) => fmtNumber(value, 2) },
  incomePerLead: { label: "每 Lead 收入", format: (value) => fmtMoney(value) },
  wechatRate: { label: "加微率", format: fmtPct },
  groupRate: { label: "入群率", format: fmtPct },
  d1AttendRate: { label: "D1 到课率", format: fmtPct },
  d8AttendRate: { label: "D8 到课率", format: fmtPct },
};

function metricFormat(metric, value) {
  return (CHANNEL_ANALYSIS_METRICS[metric]?.format || fmtNumber)(Number(value || 0));
}

function selectedChannelMetrics() {
  const metrics = Array.isArray(state.channelAnalysisMetrics) && state.channelAnalysisMetrics.length
    ? state.channelAnalysisMetrics
    : [state.channelAnalysisMetric || "leads"];
  return metrics.filter((metric) => CHANNEL_ANALYSIS_METRICS[metric]).slice(0, 4);
}

function renderChannelMetricPicker() {
  const selected = new Set(selectedChannelMetrics());
  const metrics = ["leads", "roi", "spend", "income", "incomePerLead", "d1AttendRate", "d8AttendRate"];
  const picker = document.getElementById("channelAnalysisMetricPicker");
  if (!picker) return;
  picker.innerHTML = metrics.map((metric) => `
    <label class="${selected.has(metric) ? "active" : ""}">
      <input type="checkbox" data-channel-metric="${metric}" ${selected.has(metric) ? "checked" : ""} />
      ${CHANNEL_ANALYSIS_METRICS[metric].label}
    </label>
  `).join("");
}

function escapeAttr(value) {
  return String(value ?? "").replace(/[&"]/g, (ch) => ({ "&": "&amp;", '"': "&quot;" }[ch]));
}

function validStudioName(value) {
  const text = String(value || "").trim();
  return text && !["待填写", "未校准工作室", "未校准团队"].includes(text) ? text : "";
}

function configuredStudioMappings() {
  const map = new Map(DEFAULT_TEAM_MAPPINGS.map((item) => [item.ownerName, item.teamName]));
  (state.config.studioMappings || []).forEach((item) => {
    if (item.ownerName) map.set(item.ownerName, item.teamName || "");
  });
  return [...map.entries()].map(([ownerName, teamName]) => ({ ownerName, teamName }));
}

function studioForOwner(owner) {
  const mapping = configuredStudioMappings().find((item) => item.ownerName === owner);
  return validStudioName(mapping?.teamName) || "未校准工作室";
}

function normalizePlatformName(value) {
  const text = String(value || "").trim();
  if (text === "其他") return "其他平台";
  return text && text !== "未填写" ? text : "未标平台";
}

function deriveBusinessCategory(row, studio) {
  const bookType = String(row.bookType || row.productType || "").trim();
  const channelType = String(row.channel || "").trim();
  if (bookType === "图书") return "图书";
  if (bookType === "非图书" && channelType === "KOL") return "0元";
  if (bookType === "非图书" && channelType === "短信/cps") return "短信";
  return validStudioName(studio) ? studio : "其他";
}

function derivePlatformSegment(row, businessCategory) {
  const platform = normalizePlatformName(row.platform);
  if (businessCategory === "图书") return `${platform}图书`;
  if (businessCategory === "0元") return `${platform}0元`;
  if (businessCategory === "短信") return "短信渠道";
  return businessCategory;
}

function channelAnalysisRows() {
  return (state.channelAnalysis?.rows || []).map((row) => {
    const studio = studioForOwner(row.owner);
    const businessCategory = deriveBusinessCategory(row, studio);
    return {
      ...row,
      teamName: studio,
      studioName: studio,
      businessCategory,
      platformSegment: derivePlatformSegment(row, businessCategory),
    };
  });
}

function aggregateChannelRows(rows, keyFields = []) {
  const numeric = ["spend", "leads", "wechatAdds", "activeWechatAdds", "groups", "d1Attend", "d1Complete", "d4Attend", "d4Complete", "d8Attend", "d8Complete", "gmv", "income", "channelIncome", "totalCost"];
  const map = new Map();
  rows.forEach((row) => {
    const key = keyFields.map((field) => row[field] || "").join("||") || "all";
    if (!map.has(key)) {
      const item = Object.fromEntries(keyFields.map((field) => [field, row[field] || ""]));
      item.rows = 0;
      item.campaigns = new Set();
      item.owners = new Set();
      item.channelIds = new Set();
      item.rawStudios = new Set();
      numeric.forEach((field) => { item[field] = 0; });
      map.set(key, item);
    }
    const item = map.get(key);
    item.rows += 1;
    item.campaigns.add(row.campaignName);
    item.owners.add(row.owner);
    item.channelIds.add(row.channelId);
    item.rawStudios.add(row.rawStudio);
    numeric.forEach((field) => { item[field] += Number(row[field] || 0); });
  });
  return [...map.values()].map((item) => {
    item.campaignCount = item.campaigns.size;
    item.ownerCount = item.owners.size;
    item.channelIdCount = item.channelIds.size;
    item.rawStudioDistribution = [...item.rawStudios].filter(Boolean).sort().join("、");
    delete item.campaigns;
    delete item.owners;
    delete item.channelIds;
    delete item.rawStudios;
    item.cpl = pct(item.spend, item.leads);
    item.roi = pct(item.income, item.spend);
    item.incomePerLead = pct(item.income, item.leads);
    item.gmvPerLead = pct(item.gmv, item.leads);
    item.wechatRate = pct(item.wechatAdds, item.leads);
    item.groupRate = pct(item.groups, item.leads);
    item.d1AttendRate = pct(item.d1Attend, item.leads);
    item.d4AttendRate = pct(item.d4Attend, item.leads);
    item.d8AttendRate = pct(item.d8Attend, item.leads);
    return item;
  });
}

function channelAnalysisSelectionLabel(selection = state.channelAnalysisSelected) {
  if (!selection || selection.level === "all") return "全部";
  return selection.label || selection.key || "全部";
}

function encodeChannelNode(node) {
  return encodeURIComponent(JSON.stringify(node));
}

function decodeChannelNode(value) {
  try {
    return JSON.parse(decodeURIComponent(value || ""));
  } catch {
    return { level: "all", key: "全部", label: "全部", filters: {} };
  }
}

function channelPerspectiveLevels() {
  const studio = [
    { level: "studio", field: "teamName", title: "工作室" },
    { level: "business", field: "businessCategory", title: "业务分类" },
    { level: "platformSegment", field: "platformSegment", title: "平台细分" },
    { level: "owner", field: "owner", title: "负责人" },
    { level: "channelId", field: "channelId", title: "渠道号" },
  ];
  const channel = [
    { level: "business", field: "businessCategory", title: "业务分类" },
    { level: "studio", field: "teamName", title: "工作室" },
    { level: "platformSegment", field: "platformSegment", title: "平台细分" },
    { level: "owner", field: "owner", title: "负责人" },
    { level: "channelId", field: "channelId", title: "渠道号" },
  ];
  return state.channelAnalysisPerspective === "channel" ? channel : studio;
}

function filtersForSelection(selection = state.channelAnalysisSelected) {
  return selection?.filters || {};
}

function rowsForFilters(rows, filters = {}) {
  return rows.filter((row) => Object.entries(filters).every(([field, value]) => String(row[field] || "") === String(value || "")));
}

function selectedChannelRows() {
  const rows = channelAnalysisRows();
  return rowsForFilters(rows, filtersForSelection());
}

function setChannelAnalysisSelection(selection) {
  state.channelAnalysisSelected = selection || { level: "all", key: "全部", label: "全部", filters: {} };
  state.channelAnalysisBreakdownSelection = null;
  pushChannelBotLog("select", { label: channelAnalysisSelectionLabel(state.channelAnalysisSelected), level: state.channelAnalysisSelected.level || "all" });
  renderChannelAnalysis();
}

function channelSelectionPath(selection = state.channelAnalysisSelected) {
  const levels = channelPerspectiveLevels();
  const filters = filtersForSelection(selection);
  const result = [{ level: "all", key: "全部", label: "全部", filters: {} }];
  const labels = [];
  const nextFilters = {};
  for (const level of levels) {
    const value = filters[level.field];
    if (!value) break;
    nextFilters[level.field] = value;
    labels.push(value);
    result.push({
      level: level.level,
      key: labels.join(" / "),
      label: labels.join(" / "),
      filters: { ...nextFilters },
    });
  }
  return result;
}

function parentChannelSelection(selection = state.channelAnalysisSelected) {
  const path = channelSelectionPath(selection);
  return path.length > 1 ? path[path.length - 2] : path[0];
}

function nextChannelOptions(selection = state.channelAnalysisSelected) {
  const rows = channelAnalysisRows();
  const levels = channelPerspectiveLevels();
  const currentLevelIndex = selection?.level === "all" ? -1 : levels.findIndex((item) => item.level === selection?.level);
  const next = levels[currentLevelIndex + 1];
  if (!next) return { next: null, options: [] };
  const scopeRows = rowsForFilters(rows, filtersForSelection(selection));
  const options = aggregateChannelRows(scopeRows, [next.field])
    .filter((item) => item[next.field])
    .sort((a, b) => b.leads - a.leads || b.spend - a.spend || String(a[next.field]).localeCompare(String(b[next.field])))
    .map((item) => {
      const value = item[next.field];
      const filters = { ...filtersForSelection(selection), [next.field]: value };
      const label = [channelAnalysisSelectionLabel(selection), value].filter((part, idx) => idx || part !== "全部").join(" / ") || value;
      return {
        total: item,
        node: {
          level: next.level,
          key: label,
          label,
          filters,
        },
      };
    });
  return { next, options };
}

function renderChannelAnalysisTree() {
  const rows = channelAnalysisRows();
  if (!rows.length) {
    document.getElementById("channelAnalysisTree").innerHTML = `<p class="muted">导入投放数据后显示层级。</p>`;
    return;
  }
  const selected = state.channelAnalysisSelected || { level: "all", key: "全部", label: "全部", filters: {} };
  const compareKeys = new Set(state.channelAnalysisCompareKeys || []);
  const path = channelSelectionPath(selected);
  const { next, options } = nextChannelOptions(selected);
  const compareSelections = (state.channelAnalysisCompareKeys || []).map(decodeChannelNode);
  const breadcrumb = path.map((node, index) => {
    const encoded = encodeChannelNode(node);
    const active = index === path.length - 1 ? " active" : "";
    return `${index ? "<i>/</i>" : ""}<button class="${active}" type="button" data-channel-node="${escapeAttr(encoded)}">${escapeHtml(index ? node.label.split(" / ").at(-1) : node.label)}</button>`;
  }).join("");
  const optionHtml = options.slice(0, 80).map(({ node, total }) => {
    const encoded = encodeChannelNode(node);
    const active = encodeChannelNode(selected) === encoded ? " active" : "";
    const checked = compareKeys.has(encoded) ? "checked" : "";
    const shortLabel = node.label.split(" / ").at(-1);
    return `
      <div class="analysis-chip${active}">
        <button class="analysis-chip-main" type="button" data-channel-node="${escapeAttr(encoded)}">
          <b>${escapeHtml(shortLabel)}</b>
          <span>${fmtNumber(total.leads || 0)} Leads · ${fmtNumber(total.channelIdCount || 0)} 个号</span>
        </button>
        <label title="加入对比">
          <input type="checkbox" data-channel-compare="${escapeAttr(encoded)}" ${checked} />
        </label>
      </div>
    `;
  }).join("");
  const compareHtml = compareSelections.length
    ? compareSelections.map((node) => {
      const encoded = encodeChannelNode(node);
      return `<div class="analysis-compare-chip"><span>${escapeHtml(channelAnalysisSelectionLabel(node))}</span><button type="button" data-channel-compare-remove="${escapeAttr(encoded)}">×</button></div>`;
    }).join("")
    : `<p class="analysis-empty">未选择对比。勾选下方对象后，折线图会切换为多对象对比。</p>`;
  const parts = [
    `<div class="analysis-control-grid">
      <div class="analysis-control-top">
        <div class="analysis-control-block">
          <span>分析视角</span>
          <div class="analysis-perspective-toggle">
            <button type="button" data-channel-perspective="studio" class="${state.channelAnalysisPerspective !== "channel" ? "active" : ""}">按工作室</button>
            <button type="button" data-channel-perspective="channel" class="${state.channelAnalysisPerspective === "channel" ? "active" : ""}">按渠道</button>
          </div>
        </div>
        <div class="analysis-control-block">
          <span>当前路径</span>
          <div class="analysis-breadcrumb">${breadcrumb}</div>
        </div>
      </div>
      <div class="analysis-control-block">
        <div class="analysis-option-head">
          <strong>${next ? `下一层：${next.title}` : "已经到最细层级"}</strong>
          <span>${next ? `点击进入，勾选加入对比 · 显示前 ${Math.min(options.length, 80)} / ${options.length} 项` : "可以从上方路径返回上一层"}</span>
        </div>
        <div class="analysis-chip-row">${optionHtml || `<p class="analysis-empty">当前切片没有可继续拆解的数据。</p>`}</div>
      </div>
      <div class="analysis-control-block">
        <span>自选对比</span>
        <div class="analysis-compare-row">${compareHtml}</div>
      </div>
    </div>`,
  ];
  document.getElementById("channelAnalysisTree").innerHTML = parts.join("");
}

function renderChannelAnalysisKpis(rows) {
  const total = aggregateChannelRows(rows, [])[0] || {};
  const label = channelAnalysisSelectionLabel();
  document.getElementById("channelAnalysisKpis").innerHTML = [
    kpi("当前切片", label, `${fmtNumber(total.rows || 0)} 行 · ${fmtNumber(total.campaignCount || 0)} 个营期`, rows.length ? "good" : "empty"),
    kpi("Leads / 消耗", `${fmtNumber(total.leads || 0)} / ${fmtMoney(total.spend || 0)}`, `CPL ${fmtMoney(total.cpl || 0)}`, "good"),
    kpi("收入 / 成交额", `${fmtMoney(total.income || 0)} / ${fmtMoney(total.gmv || 0)}`, `每Lead收入 ${fmtMoney(total.incomePerLead || 0)}`, "good"),
    kpi("ROI / 到课", `${fmtNumber(total.roi || 0, 2)} / ${fmtPct(total.d1AttendRate || 0)}`, `D8 ${fmtPct(total.d8AttendRate || 0)} · 加微 ${fmtPct(total.wechatRate || 0)}`, total.roi ? "warn" : "empty"),
  ].join("");
}

function channelSeriesFromSelection(selection, allRows, index = 0) {
  const groupRows = rowsForFilters(allRows, filtersForSelection(selection));
  return {
    key: encodeChannelNode(selection),
    label: channelAnalysisSelectionLabel(selection),
    rows: groupRows,
    index,
  };
}

function nextLevelSeries(selection, allRows) {
  const levels = channelPerspectiveLevels();
  const levelIndex = selection?.level === "all" ? -1 : levels.findIndex((item) => item.level === selection?.level);
  const next = levels[levelIndex + 1];
  if (!next) return [];
  const scopeRows = rowsForFilters(allRows, filtersForSelection(selection));
  return aggregateChannelRows(scopeRows, [next.field])
    .filter((item) => item[next.field])
    .sort((a, b) => b.leads - a.leads || b.spend - a.spend || String(a[next.field]).localeCompare(String(b[next.field])))
    .map((item, index) => {
      const value = item[next.field];
      const filters = { ...filtersForSelection(selection), [next.field]: value };
      const label = [channelAnalysisSelectionLabel(selection), value].filter((part, idx) => idx || part !== "全部").join(" / ") || value;
      return {
        key: `${next.field}:${value}`,
        label,
        rows: rowsForFilters(scopeRows, { [next.field]: value }),
        index,
      };
    });
}

function manualBreakdownOptions() {
  const rows = channelAnalysisRows();
  const selected = state.channelAnalysisSelected || { level: "all", key: "全部", label: "全部", filters: {} };
  const options = new Map();
  const add = (selection) => {
    const encoded = encodeChannelNode(selection);
    if (!options.has(encoded)) options.set(encoded, selection);
  };
  channelSelectionPath(selected).forEach(add);
  nextChannelOptions({ level: "all", key: "全部", label: "全部", filters: {} }).options.forEach((item) => add(item.node));
  nextChannelOptions(selected).options.forEach((item) => add(item.node));
  const scopeRows = rowsForFilters(rows, filtersForSelection(selected));
  if (scopeRows.length && selected.level !== "all") {
    const levels = channelPerspectiveLevels();
    const currentIndex = levels.findIndex((item) => item.level === selected.level);
    const siblingLevel = levels[currentIndex];
    const parent = parentChannelSelection(selected);
    if (siblingLevel) {
      const parentRows = rowsForFilters(rows, filtersForSelection(parent));
      aggregateChannelRows(parentRows, [siblingLevel.field]).forEach((item) => {
        const value = item[siblingLevel.field];
        if (!value) return;
        const filters = { ...filtersForSelection(parent), [siblingLevel.field]: value };
        const label = [channelAnalysisSelectionLabel(parent), value].filter((part, idx) => idx || part !== "全部").join(" / ") || value;
        add({ level: siblingLevel.level, key: label, label, filters });
      });
    }
  }
  return [...options.values()];
}

function renderBreakdownControls(selection, isManual) {
  const options = manualBreakdownOptions();
  const current = encodeChannelNode(selection);
  return `
    <div class="breakdown-controls">
      <span>${isManual ? "手动范围" : "自动跟随"}</span>
      <select data-channel-breakdown-selection title="修改第二张图的拆解范围">
        <option value="__auto__" ${isManual ? "" : "selected"}>自动跟随当前路径</option>
        ${options.map((item) => {
          const encoded = encodeChannelNode(item);
          return `<option value="${escapeAttr(encoded)}" ${isManual && encoded === current ? "selected" : ""}>${escapeHtml(channelAnalysisSelectionLabel(item))}</option>`;
        }).join("")}
      </select>
      ${isManual ? `<button type="button" data-channel-breakdown-auto>恢复跟随</button>` : ""}
    </div>
  `;
}

function renderChannelLineChart({ title, emptyText, baseRows, seriesSource, extraControls = "" }) {
  const metrics = selectedChannelMetrics();
  const allRows = channelAnalysisRows();
  const grouped = aggregateChannelRows(allRows, ["openDate"]).filter((item) => Number(item.leads || 0) > 0).sort((a, b) => (a.openDate || "").localeCompare(b.openDate || ""));
  if (!grouped.length) {
    return `<p class="muted">${emptyText || "当前切片没有趋势数据。"}</p>`;
  }
  const campaigns = grouped.map((item) => ({
    key: item.openDate || "未校准日期",
    label: item.openDate ? item.openDate.slice(5) : "未校准日期",
    shortLabel: item.openDate ? item.openDate.slice(5) : item.campaignName,
    dateCalibrated: Boolean(item.openDate),
  }));
  if (!seriesSource.length) {
    return `<section class="channel-trend-panel">
      <div class="channel-trend-title"><h3>${title}</h3>${extraControls}</div>
      <p class="muted">${emptyText || "已经到最细层级，没有下一级拆解。"}</p>
    </section>`;
  }
  const palette = ["#16a3b8", "#16845b", "#d97706", "#6b5bd6", "#b42318", "#0f766e", "#be185d", "#475569", "#0ea5e9", "#65a30d"];
  const series = seriesSource.flatMap((group, groupIndex) => {
    const groupRows = Array.isArray(group.rows) ? group.rows : [];
    const byDate = new Map(aggregateChannelRows(groupRows, ["openDate"]).map((item) => [item.openDate || "未校准日期", item]));
    const total = aggregateChannelRows(groupRows, [])[0] || {};
    return metrics.map((metric, metricIndex) => ({
      label: metrics.length > 1 ? `${group.label || channelAnalysisSelectionLabel()} · ${CHANNEL_ANALYSIS_METRICS[metric].label}` : group.label || channelAnalysisSelectionLabel(),
      rawLabel: group.label || channelAnalysisSelectionLabel(),
      metric,
      color: palette[(groupIndex * metrics.length + metricIndex) % palette.length],
      total,
      values: campaigns.map((campaign) => Number(byDate.get(campaign.key)?.[metric] || 0)),
    }));
  });
  const metricScales = new Map(metrics.map((metric) => {
    const values = series
      .filter((item) => item.metric === metric)
      .flatMap((item) => item.values)
      .map((value) => Number(value || 0))
      .filter((value) => Number.isFinite(value));
    let max = Math.max(...values, 0);
    let min = Math.min(...values, 0);
    if (min > 0) min = 0;
    if (max === min) max = min + 1;
    return [metric, { min, max, range: max - min || 1 }];
  }));
  const normalizedSeries = series.map((item) => {
    const scale = metricScales.get(item.metric) || { min: 0, max: 1, range: 1 };
    const seriesKey = `${item.rawLabel || item.label}||${item.metric}`;
    return {
      ...item,
      seriesKey,
      scale,
      normalizedValues: item.values.map((value) => ((Number(value || 0) - scale.min) / scale.range) * 100),
    };
  });
  const max = 100;
  const min = 0;
  const range = 100;
  const zoom = Math.min(Math.max(Number(state.channelAnalysisChartZoom || 1), 1), 4);
  const pointGap = 58 * zoom;
  const baseWidth = 1280;
  const width = Math.max(baseWidth, 56 + 26 + Math.max(campaigns.length - 1, 1) * pointGap);
  const height = 454;
  const left = 56;
  const right = 26;
  const top = 34;
  const bottom = 42;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const xFor = (index) => left + (campaigns.length === 1 ? chartWidth / 2 : (index / (campaigns.length - 1)) * chartWidth);
  const yFor = (value) => top + chartHeight - ((Number(value || 0) - min) / range) * chartHeight;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => min + range * ratio);
  const metricLabel = metrics.map((metric) => CHANNEL_ANALYSIS_METRICS[metric]?.label || metric).join(" / ");
  const singleMetric = metrics.length === 1 ? metrics[0] : "";
  const singleScale = singleMetric ? metricScales.get(singleMetric) : null;
  const tickLabel = (tick) => {
    if (!singleMetric || !singleScale) return `${fmtNumber(tick, 0)}%`;
    const rawValue = singleScale.min + singleScale.range * (tick / 100);
    return metricFormat(singleMetric, rawValue);
  };
  const scaleNote = singleMetric
    ? `${CHANNEL_ANALYSIS_METRICS[singleMetric]?.label || singleMetric} 使用同一真实纵轴，对比线高度可直接比较。`
    : "多指标展示时，各指标分别共用自己的纵轴后归一到同一画布；同一指标之间高度可直接比较。";
  const highlights = Array.isArray(state.channelAnalysisHighlights) ? state.channelAnalysisHighlights : [];
  const activeHighlight = state.channelAnalysisActiveHighlight;
  const highlightColor = state.channelAnalysisHighlightColor || "#e11d48";
  const activeSeriesKey = state.channelAnalysisHighlightSeriesKey || activeHighlight?.seriesKey || normalizedSeries[0]?.seriesKey || "";
  const legend = normalizedSeries.map((item) => `
    <button type="button" class="channel-line-legend-item ${activeSeriesKey === item.seriesKey ? "active" : ""}" data-channel-legend-series="${escapeAttr(item.seriesKey)}"><i style="background:${item.color}"></i>${item.label}<b>${metricFormat(item.metric, item.total?.[item.metric])}</b></button>
  `).join("");
  const seriesOptions = normalizedSeries.map((item) => `<option value="${escapeAttr(item.seriesKey)}" ${activeSeriesKey === item.seriesKey ? "selected" : ""}>${item.label}</option>`).join("");
  return `
    <section class="channel-trend-panel">
      <div class="channel-trend-title">
        <h3>${title}</h3>
        ${extraControls}
        <div class="chart-zoom-controls" aria-label="折线图缩放">
          <button type="button" data-channel-chart-zoom="out" ${zoom <= 1 ? "disabled" : ""}>−</button>
          <span>${Math.round(zoom * 100)}%</span>
          <button type="button" data-channel-chart-zoom="in" ${zoom >= 4 ? "disabled" : ""}>＋</button>
          <button type="button" data-channel-chart-zoom="reset">重置</button>
          <select data-channel-highlight-series title="重合点时选择要标记的线">${seriesOptions}</select>
          <input type="color" value="${highlightColor}" data-channel-highlight-color title="选择波段颜色" />
          <button type="button" data-channel-highlight-apply-color>确定颜色</button>
          <button type="button" data-channel-highlight-new ${activeHighlight?.points?.length ? "" : "disabled"}>新建波段</button>
          <button type="button" data-channel-highlight-clear ${highlights.length || activeHighlight ? "" : "disabled"}>清除波段</button>
        </div>
      </div>
      <p class="channel-trend-scale-note">${scaleNote}</p>
    <div class="channel-trend-layout">
      <div class="channel-line-legend">${legend}</div>
      <div class="channel-line-chart-wrap">
        <svg class="channel-line-chart" style="width:${width}px" viewBox="0 0 ${width} ${height}" role="img" aria-label="${metricLabel}营期趋势">
          ${ticks.map((tick) => `
            <line x1="${left}" y1="${yFor(tick)}" x2="${width - right}" y2="${yFor(tick)}" class="grid-line" />
            <text x="10" y="${yFor(tick) + 4}" class="axis-label">${tickLabel(tick)}</text>
          `).join("")}
          ${campaigns.map((item, index) => `
            <text x="${xFor(index)}" y="${height - 16}" text-anchor="middle" class="axis-label">${item.shortLabel}</text>
          `).join("")}
          ${normalizedSeries.map((item) => {
            const points = item.normalizedValues.map((value, index) => `${xFor(index).toFixed(1)},${yFor(value).toFixed(1)}`).join(" ");
            const itemHighlights = [
              ...highlights.filter((segment) => segment.seriesKey === item.seriesKey),
              ...(activeHighlight?.seriesKey === item.seriesKey ? [activeHighlight] : []),
            ];
            const selectedIndexSet = new Set(itemHighlights.flatMap((segment) => segment.points || []));
            const highlightLines = itemHighlights.map((segment) => {
              const selectedIndexes = [...new Set(segment.points || [])].sort((a, b) => a - b);
              if (selectedIndexes.length < 2) return "";
              const segmentPoints = selectedIndexes.map((selectedIndex) => `${xFor(selectedIndex).toFixed(1)},${yFor(item.normalizedValues[selectedIndex]).toFixed(1)}`).join(" ");
              return `<polyline class="channel-trend-highlight" points="${segmentPoints}" style="stroke:${segment.color || highlightColor}" />`;
            }).join("");
            return `
              <polyline class="channel-trend-line" points="${points}" style="stroke:${item.color}" />
              ${highlightLines}
              ${item.values.map((value, index) => `
                <text x="${xFor(index)}" y="${Math.max(14, yFor(item.normalizedValues[index]) - 12)}" text-anchor="middle" class="point-value" style="fill:${item.color}">${metricFormat(item.metric, value)}</text>
                <circle class="channel-trend-dot ${selectedIndexSet.has(index) ? "selected" : ""}" cx="${xFor(index)}" cy="${yFor(item.normalizedValues[index])}" r="4.2" style="stroke:${selectedIndexSet.has(index) ? highlightColor : item.color}">
                  <title>${item.label} · ${campaigns[index].label}：${metricFormat(item.metric, value)}</title>
                </circle>
                <circle class="channel-trend-hit-dot ${activeSeriesKey && activeSeriesKey !== item.seriesKey ? "inactive" : ""}" cx="${xFor(index)}" cy="${yFor(item.normalizedValues[index])}" r="14" data-trend-point="${escapeAttr(item.seriesKey)}" data-trend-index="${index}">
                  <title>点击选择：${item.label} · ${campaigns[index].label}</title>
                </circle>
              `).join("")}
            `;
          }).join("")}
        </svg>
      </div>
    </div>
    </section>
  `;
}

function renderChannelTrend(rows) {
  const allRows = channelAnalysisRows();
  const selected = state.channelAnalysisSelected || { level: "all", key: "全部", label: "全部", filters: {} };
  const compareSelections = (state.channelAnalysisCompareKeys || []).map(decodeChannelNode);
  const topSeries = compareSelections.length
    ? compareSelections.map((selection, index) => channelSeriesFromSelection(selection, allRows, index))
    : [channelSeriesFromSelection(selected, allRows, 0)];
  const breakdownSelection = state.channelAnalysisBreakdownSelection || selected;
  const breakdownSeries = nextLevelSeries(breakdownSelection, allRows);
  const breakdownManual = Boolean(state.channelAnalysisBreakdownSelection);
  document.getElementById("channelAnalysisTrend").innerHTML = [
    renderChannelLineChart({
    title: compareSelections.length ? "自选对比" : "当前链路趋势",
    emptyText: "当前选择没有趋势数据。",
    baseRows: rows,
    seriesSource: topSeries,
    }),
    renderChannelLineChart({
      title: `下一级拆解 · ${breakdownManual ? "手动范围" : "自动跟随"}`,
      emptyText: `${channelAnalysisSelectionLabel(breakdownSelection)} 已经到最细层级，或没有下一级可拆解数据。`,
      baseRows: rowsForFilters(allRows, filtersForSelection(breakdownSelection)),
      seriesSource: breakdownSeries,
      extraControls: renderBreakdownControls(breakdownSelection, breakdownManual),
    }),
  ].join("");
}

function applyChannelHighlightColor(color) {
  state.channelAnalysisHighlightColor = color || state.channelAnalysisHighlightColor || "#e11d48";
  if (state.channelAnalysisActiveHighlight?.points?.length) {
    state.channelAnalysisActiveHighlight = { ...state.channelAnalysisActiveHighlight, color: state.channelAnalysisHighlightColor };
    return true;
  }
  if ((state.channelAnalysisHighlights || []).length) {
    state.channelAnalysisHighlights = state.channelAnalysisHighlights.map((segment, index, list) => (
      index === list.length - 1 ? { ...segment, color: state.channelAnalysisHighlightColor } : segment
    ));
    return true;
  }
  return false;
}

function renderTeamCalibration() {
  const rows = channelAnalysisRows();
  const owners = aggregateChannelRows(rows, ["owner"]).sort((a, b) => b.spend - a.spend);
  const teams = [...new Set(configuredStudioMappings().map((item) => item.teamName).filter(validStudioName))].sort();
  const uncalibrated = owners.filter((owner) => !validStudioName(configuredStudioMappings().find((item) => item.ownerName === owner.owner)?.teamName));
  document.getElementById("teamCalibrationRows").innerHTML = `
    ${uncalibrated.length ? `<p class="warn-text">待校准负责人：${uncalibrated.map((item) => item.owner).join("、")}</p>` : ""}
    <table>
      <thead><tr><th>渠道归属</th><th>来源/场景分布</th><th>渠道号</th><th>Leads</th><th>消耗</th><th>收入</th><th>工作室分类</th></tr></thead>
      <tbody>${owners.map((owner) => `
        <tr>
          <td><strong>${owner.owner}</strong></td>
          <td>${owner.rawStudioDistribution || "-"}</td>
          <td class="num">${fmtNumber(owner.channelIdCount)}</td>
          <td class="num">${fmtNumber(owner.leads)}</td>
          <td class="num">${fmtMoney(owner.spend)}</td>
          <td class="num">${fmtMoney(owner.income)}</td>
          <td><input list="teamNameOptions" data-studio-owner="${owner.owner}" value="${validStudioName(configuredStudioMappings().find((item) => item.ownerName === owner.owner)?.teamName) || ""}" placeholder="填写工作室" /></td>
        </tr>
      `).join("") || `<tr><td colspan="7" class="empty-cell">导入投放数据后可校准工作室。</td></tr>`}</tbody>
    </table>
    <datalist id="teamNameOptions">${teams.map((team) => `<option value="${team}"></option>`).join("")}</datalist>
  `;
}

async function saveTeamCalibration() {
  const visibleOwners = new Set();
  const mappingMap = new Map(configuredStudioMappings().map((item) => [item.ownerName, item.teamName]));
  document.querySelectorAll("[data-studio-owner]").forEach((input) => {
    visibleOwners.add(input.dataset.studioOwner);
    const teamName = input.value.trim();
    if (teamName) mappingMap.set(input.dataset.studioOwner, teamName);
    else mappingMap.delete(input.dataset.studioOwner);
  });
  const mappings = [...mappingMap.entries()]
    .filter(([ownerName, teamName]) => ownerName && (teamName || visibleOwners.has(ownerName)))
    .map(([ownerName, teamName]) => ({ ownerName, teamName }));
  state.config.studioMappings = mappings;
  await saveConfig();
  setHint(`已保存 ${mappings.length} 个负责人工作室归属。`);
  renderChannelAnalysis();
}

async function importChannelAnalysisFile(file) {
  if (!file) return;
  if (IS_STANDALONE) {
    alert("双击体验版不能直接解析投放 Excel，请使用本地服务版或局域网版。");
    return;
  }
  try {
    logOperation("import_channel_analysis_start", { file: file.name });
    const form = new FormData();
    form.append("file", file);
    const payload = await fetchJson("/api/import-channel-analysis", { method: "POST", body: form });
    state.channelAnalysis = payload;
    state.channelAnalysisSelected = { level: "all", key: "全部", label: "全部", filters: {} };
    state.channelAnalysisCompareKeys = [];
    state.channelAnalysisBreakdownSelection = null;
    state.channelAnalysisTab = "analysis";
    logOperation("import_channel_analysis_done", {
      file: file.name,
      rows: payload.summary?.rowCount || 0,
      campaigns: payload.summary?.campaignCount || 0,
      channelIds: payload.summary?.channelIdCount || 0,
    });
    pushChannelBotLog("import", {
      file: file.name,
      rows: payload.summary?.rowCount || 0,
      campaigns: payload.summary?.campaignCount || 0,
      channelIds: payload.summary?.channelIdCount || 0,
    });
    setHint(`已导入投放数据：${fmtNumber(payload.summary?.rowCount || 0)} 行，${fmtNumber(payload.summary?.channelIdCount || 0)} 个渠道号。`);
    renderChannelAnalysis();
  } catch (error) {
    logOperation("import_channel_analysis_failed", {
      file: file.name,
      message: error.message || String(error),
      selected: channelAnalysisSelectionLabel(),
      compareCount: (state.channelAnalysisCompareKeys || []).length,
      metrics: selectedChannelMetrics(),
    });
    setHint("投放数据导入失败");
    alert(error.message || "投放数据导入失败");
  }
}

function renderChannelAnalysis() {
  const hasData = Boolean(state.channelAnalysis?.rows?.length);
  const analysisPanel = document.getElementById("channelAnalysisPanel");
  const calibrationPanel = document.getElementById("teamCalibrationPanel");
  if (!analysisPanel || !calibrationPanel) return;
  document.querySelectorAll("[data-channel-analysis-tab]").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.channelAnalysisTab === state.channelAnalysisTab);
  });
  analysisPanel.hidden = state.channelAnalysisTab === "calibration";
  calibrationPanel.hidden = state.channelAnalysisTab !== "calibration";
  document.getElementById("channelAnalysisHint").textContent = hasData
    ? `当前数据：${fmtNumber(state.channelAnalysis.summary?.rowCount || 0)} 行 · ${fmtNumber(state.channelAnalysis.summary?.campaignCount || 0)} 个营期 · ${fmtNumber(state.channelAnalysis.summary?.channelIdCount || 0)} 个渠道号${state.channelAnalysis.summary?.uncalibratedOwnerCount ? ` · ${fmtNumber(state.channelAnalysis.summary.uncalibratedOwnerCount)} 个负责人待校准` : ""}`
    : "尚未导入投放数据。";
  renderChannelMetricPicker();
  if (!hasData) {
    document.getElementById("channelAnalysisTree").innerHTML = `<p class="muted">请先导入投放数据。</p>`;
    document.getElementById("channelAnalysisKpis").innerHTML = "";
    document.getElementById("channelAnalysisTrend").innerHTML = `<p class="muted">请先导入投放数据。</p>`;
    renderChannelBot();
    renderTeamCalibration();
    return;
  }
  renderChannelAnalysisTree();
  const rows = selectedChannelRows();
  renderChannelAnalysisKpis(rows);
  renderChannelTrend(rows);
  renderChannelBot();
  renderTeamCalibration();
}

function render() {
  if (!state.config) return;
  const safeRender = (label, fn) => {
    try {
      fn();
    } catch (error) {
      console.error(`${label} 渲染失败`, error);
      setHint(`${label} 渲染失败：${error.message || error}`);
    }
  };
  safeRender("顶部状态", updateMeta);
  safeRender("CRM更新按钮", renderRevenueSyncButton);
  document.getElementById("emptyState").classList.add("hidden");
  safeRender("总览", renderOverview);
  if (state.view === "plan") safeRender("计划中心", renderPlan);
  if (state.view === "prediction") safeRender("营收推演", renderPrediction);
  if (state.view === "config") {
    safeRender("配置中心", renderConfig);
    if (state.configTab === "campaigns") safeRender("营期管理", renderBuilder);
    if (state.configTab === "traffic") safeRender("流量规划", renderCalendarTargets);
    if (state.configTab === "conversion") safeRender("转化目标", renderRTemplates);
  }
  if (state.view === "campaigns") safeRender("营期监控", renderCampaigns);
  if (state.view === "channelAnalysis") safeRender("投放分析", renderChannelAnalysis);
  if (state.view === "daily") safeRender("每日进度", renderDaily);
  if (state.view === "channels") safeRender("渠道分类", renderChannels);
}

function downloadText(content, filename, type = "application/json;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, "\"\"")}"` : text;
}

function rowsToCsv(headers, rows) {
  return [
    headers.map(csvEscape).join(","),
    ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(",")),
  ].join("\n");
}

function setHint(text) {
  const target = document.getElementById("configSaveHint") || document.getElementById("pageSubtitle");
  if (target) target.textContent = text;
}

function setTargetHint(text) {
  const target = document.getElementById("targetSaveHint");
  if (target) target.textContent = text;
  setHint(text);
}

function exportConfigJson() {
  const filename = `${formatLocalDay(new Date())}-营期转化监控看板配置.json`;
  downloadText(JSON.stringify(normalizeConfig(state.config), null, 2), filename);
  setHint("已导出完整 JSON 备份");
}

function parseCsv(text) {
  const rows = [];
  let current = "";
  let row = [];
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      i += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current.trim());
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(current.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      current = "";
    } else {
      current += char;
    }
  }
  row.push(current.trim());
  if (row.some(Boolean)) rows.push(row);
  const headers = rows.shift() || [];
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ""])));
}

function subchannelByNameOrId(value) {
  const text = String(value || "").trim();
  return (state.config.subchannels || []).find((sub) => sub.id === text || sub.name === text);
}

function inferSubchannelIdsFromActual(actual) {
  if (actual.subchannelIds?.length) return [...new Set(actual.subchannelIds)];
  const ids = (actual.actualSubchannels || [])
    .map((item) => subchannelByNameOrId(item.category)?.id)
    .filter(Boolean);
  return [...new Set(ids)];
}

function inferredCampaignFromActual(actual) {
  const parts = campaignPartsFromName(actual.name);
  const openDate = actual.openDate || "";
  const subchannelIds = inferSubchannelIdsFromActual(actual);
  const inferredIntake = inferredIntakeRange(openDate);
  return {
    id: `actual_${actual.name}`,
    baseNo: parts.baseNo || 0,
    subNo: parts.subNo || 1,
    teacherCode: parts.teacherCode || "",
    openDate,
    intakeStart: actual.intakeStart || inferredIntake.intakeStart,
    intakeEnd: actual.intakeEnd || inferredIntake.intakeEnd,
    days: 14,
    subchannelIds,
    name: actual.name,
    rOverrides: actual.rOverrides || [],
    inferredFromActual: true,
  };
}

function planningCampaigns() {
  const plannedNames = new Set((state.config.campaigns || []).map((campaign) => campaign.name));
  const inferred = [...actualCampaignMap().values()]
    .filter((actual) => !plannedNames.has(actual.name) && actual.openDate)
    .map(inferredCampaignFromActual);
  return [...(state.config.campaigns || []), ...inferred];
}

function downloadLeadTargetTemplate() {
  const month = document.getElementById("targetMonth")?.value || state.targetMonth;
  const headers = ["date", ...(state.config.subchannels || []).map((sub) => sub.name)];
  const rows = monthDays(month).map((date) => {
    const row = { date };
    (state.config.subchannels || []).forEach((sub) => {
      row[sub.name] = getTarget(date, sub.id) || "";
    });
    return row;
  });
  downloadText(rowsToCsv(headers, rows), `${month}-日历Leads目标模板.csv`, "text/csv;charset=utf-8");
}

async function importLeadTargetCsv(file) {
  if (!file) return;
  logOperation("import_lead_target_start", { file: file.name });
  const rows = parseCsv(await file.text());
  let count = 0;
  for (const row of rows) {
    const date = toDay(row.date || row["日期"]);
    if (!date) continue;
    if (row.subchannel || row["子渠道"]) {
      const sub = subchannelByNameOrId(row.subchannel || row["子渠道"]);
      if (!sub) continue;
      setTarget(date, sub.id, metricNumber(row.targetLeads ?? row["目标Leads"] ?? row.leads));
      count += 1;
    } else {
      (state.config.subchannels || []).forEach((sub) => {
        if (Object.prototype.hasOwnProperty.call(row, sub.name) || Object.prototype.hasOwnProperty.call(row, sub.id)) {
          setTarget(date, sub.id, metricNumber(row[sub.name] ?? row[sub.id]));
          count += 1;
        }
      });
    }
  }
  await saveConfig();
  render();
  logOperation("import_lead_target_done", { file: file.name, count });
  setTargetHint(`已导入 Leads 目标：${count} 个单元格，并已同步营期目标。`);
}

function collectTargetInputs() {
  let count = 0;
  document.querySelectorAll("[data-target-date]").forEach((input) => {
    setTarget(input.dataset.targetDate, input.dataset.targetSub, input.value);
    count += 1;
  });
  return count;
}

function copyFirstFilledTargetToMonth() {
  const inputs = [...document.querySelectorAll("[data-target-date]")];
  const subs = state.config.subchannels || [];
  let changed = 0;
  subs.forEach((sub) => {
    const subInputs = inputs.filter((input) => input.dataset.targetSub === sub.id);
    const source = subInputs.find((input) => input.value !== "");
    if (!source) return;
    subInputs.forEach((input) => {
      input.value = source.value;
      changed += 1;
    });
  });
  setTargetHint(changed ? `已按每个子渠道首个填写值复制到本月每日：${changed} 个单元格，记得保存。` : "请先至少填写一天的目标，再复制到每日。");
}

function downloadRTemplateCsv() {
  const headers = ["subchannel", ...D_STAGES];
  const rows = (state.config.subchannels || []).map((sub) => {
    const row = { subchannel: sub.name };
    D_STAGES.forEach((stage) => {
      row[stage] = getRValue(sub.id, stage) || "";
    });
    return row;
  });
  downloadText(rowsToCsv(headers, rows), "R值目标.csv", "text/csv;charset=utf-8");
}

async function importRTemplateCsv(file) {
  if (!file) return;
  logOperation("import_r_template_start", { file: file.name });
  const rows = parseCsv(await file.text());
  let count = 0;
  for (const row of rows) {
    const sub = subchannelByNameOrId(row.subchannel || row["子渠道"]);
    if (!sub) continue;
    D_STAGES.forEach((stage) => {
      setRValue(sub.id, stage, metricNumber(row[stage] ?? row[`${stage}_R值`] ?? row[`${stage}-R值`]));
      count += 1;
    });
  }
  await saveConfig();
  logOperation("import_r_template_done", { file: file.name, count });
  setHint(`已导入 R值目标：${count} 个单元格`);
  render();
}

function downloadCampaignPlanCsv() {
  const rows = [{
    baseNo: "894",
    subNo: "1",
    teacherCode: (state.config.teachers || [])[0]?.code || "BZ",
    openDate: formatLocalDay(new Date()),
    intakeRule: (state.config.intakeRules || [])[0]?.name || "标准3.5天切量",
    intakeStart: "",
    intakeEnd: "",
    subchannels: (state.config.subchannels || []).slice(0, 2).map((sub) => sub.name).join("、"),
  }];
  downloadText(rowsToCsv(["baseNo", "subNo", "teacherCode", "openDate", "intakeRule", "intakeStart", "intakeEnd", "subchannels"], rows), "建期计划模板.csv", "text/csv;charset=utf-8");
}

async function importCampaignPlanCsv(file) {
  if (!file) return;
  logOperation("import_campaign_plan_start", { file: file.name });
  const rows = parseCsv(await file.text());
  const byName = new Map((state.config.campaigns || []).map((campaign) => [campaign.name, campaign]));
  let count = 0;
  for (const row of rows) {
    const baseNo = Number(row.baseNo || row["大营期编号"] || 0);
    const subNo = Number(row.subNo || row["小营期编号"] || 1);
    const teacherCode = row.teacherCode || row["老师"] || "";
    const openDate = toDay(row.openDate || row["开课日期"]);
    const ruleText = String(row.intakeRule || row["接量规则"] || "").trim();
    const rule = (state.config.intakeRules || []).find((item) => item.id === ruleText || item.name === ruleText);
    const ruleRange = openDate && rule ? ruleBasedIntakeRange(openDate, rule.id) : null;
    const intakeStart = toDay(row.intakeStart || row["接量开始"]) || ruleRange?.intakeStart;
    const intakeEnd = toDay(row.intakeEnd || row["接量结束"]) || ruleRange?.intakeEnd;
    const intakeStartDateTime = row.intakeStartDateTime || row["接量开始时间"] || ruleRange?.intakeStartDateTime || dateTimeValue(intakeStart, "00:00");
    const intakeEndDateTime = row.intakeEndDateTime || row["接量结束时间"] || ruleRange?.intakeEndDateTime || dateTimeValue(intakeEnd, "23:59");
    const subchannelIds = String(row.subchannels || row["子渠道"] || "")
      .split(/[、|;/，,]/)
      .map((item) => subchannelByNameOrId(item)?.id)
      .filter(Boolean);
    if (!baseNo || !teacherCode || !openDate || !intakeStart || !intakeEnd || !subchannelIds.length) continue;
    const name = campaignName(baseNo, subNo, teacherCode, openDate);
    byName.set(name, {
      ...(byName.get(name) || {}),
      id: byName.get(name)?.id || id("camp"),
      baseNo,
      subNo,
      teacherCode,
      openDate,
      intakeStart,
      intakeEnd,
      intakeRuleId: ruleRange?.intakeRuleId || "",
      intakeStartDateTime,
      intakeEndDateTime,
      days: 14,
      subchannelIds,
      name,
      rOverrides: byName.get(name)?.rOverrides || [],
    });
    count += 1;
  }
  state.config.campaigns = [...byName.values()];
  await saveConfig();
  logOperation("import_campaign_plan_done", { file: file.name, count });
  setHint(`已导入建期计划：${count} 条`);
  render();
}

async function importActualFileData(file) {
  if (!file) return;
  try {
    logOperation("import_actual_start", { file: file.name });
    const filename = file.name.toLowerCase();
    let rows = [];
    if (filename.endsWith(".json")) {
      const payload = JSON.parse(await file.text());
      if (!Array.isArray(payload) && (payload.via || payload.trace)) {
        const message = payload.via?.[0]?.message || "未知错误";
        throw new Error(`这个文件不是有效数据文件，而是导出系统返回的错误信息：${message}`);
      }
      rows = Array.isArray(payload) ? payload : payload.campaigns || payload.actualCampaigns || [];
    } else if (filename.endsWith(".csv")) {
      rows = groupNativeActualRows(parseCsv(await file.text()));
    } else if (filename.endsWith(".xlsx") || filename.endsWith(".xlsm") || filename.endsWith(".xls")) {
      if (IS_STANDALONE) {
        throw new Error("双击版不能直接解析 Excel。请导出 CSV 后导入，或使用局域网/服务版导入 XLSX。");
      }
      const form = new FormData();
      form.append("file", file);
      const payload = await fetchJson("/api/import-actual", { method: "POST", body: form });
      rows = groupNativeActualRows(payload.actualCampaigns || []);
    } else {
      throw new Error("暂不支持该文件格式。请使用 JSON、CSV，或在服务版使用 XLSX。");
    }
    const actuals = rows.map(normalizeActualCampaign).filter(Boolean);
    if (!actuals.length) throw new Error("没有识别到营期数据。请至少包含 name/营期、actualLeads/leads、actualGmv/gmv 字段。");
    const byName = new Map((state.config.actualCampaigns || [])
      .map(normalizeActualCampaign)
      .filter(Boolean)
      .map((actual) => [actual.name, actual]));
    let created = 0;
    let updated = 0;
    actuals.forEach((actual) => {
      if (byName.has(actual.name)) updated += 1;
      else created += 1;
      byName.set(actual.name, {
        ...(byName.get(actual.name) || {}),
        ...actual,
      });
    });
    state.config.actualCampaigns = [...byName.values()];
    await saveConfig();
    logOperation("import_actual_done", { file: file.name, created, updated, total: state.config.actualCampaigns.length });
    setHint(`已增量导入结果数据：新增 ${created} 个，更新 ${updated} 个，当前共 ${state.config.actualCampaigns.length} 个营期`);
    render();
  } catch (error) {
    setHint("结果数据导入失败");
    alert(error.message || "已发生营期数据读取失败");
  }
}

async function importConfigJson(file) {
  if (!file) return;
  try {
    const text = await file.text();
    state.config = normalizeConfig(JSON.parse(text));
    await saveConfig();
    setHint(`已导入完整备份：${file.name}`);
    render();
  } catch (error) {
    setHint("完整备份导入失败");
    alert(error.message || "JSON 配置读取失败");
  }
}

async function copyRTemplatesToCampaigns() {
  collectRTemplateInputs();
  const selected = [...document.querySelectorAll("[data-copy-campaign-name]:checked")].map((input) => input.dataset.copyCampaignName);
  if (!selected.length) {
    alert("请先选择要复制到的营期。");
    return;
  }
  const overrides = (state.config.rTemplates || []).map((item) => ({ ...item }));
  selected.forEach((name) => {
    const planned = (state.config.campaigns || []).find((campaign) => campaign.name === name);
    if (planned) {
      planned.rOverrides = clone(overrides);
      return;
    }
    const actual = (state.config.actualCampaigns || []).find((campaign) => campaign.name === name);
    if (actual) actual.rOverrides = clone(overrides);
  });
  await saveConfig();
  alert(`已复制到 ${selected.length} 个营期。`);
  renderRTemplates();
}

function collectEditors() {
  document.querySelectorAll("[data-channel-field]").forEach((input) => {
    state.config.channels[Number(input.dataset.index)][input.dataset.channelField] = input.value.trim();
  });
  document.querySelectorAll("[data-sub-field]").forEach((input) => {
    state.config.subchannels[Number(input.dataset.index)][input.dataset.subField] = input.value.trim();
  });
  document.querySelectorAll("[data-teacher-field]").forEach((input) => {
    state.config.teachers[Number(input.dataset.index)][input.dataset.teacherField] = input.value.trim();
  });
  document.querySelectorAll("[data-rule-field]").forEach((input) => {
    const rule = state.config.intakeRules[Number(input.dataset.ruleIndex)];
    if (!rule) return;
    if (input.dataset.ruleField === "isDefault") rule.isDefault = input.checked;
    else rule[input.dataset.ruleField] = input.value.trim();
  });
  document.querySelectorAll("[data-rule-entry-field]").forEach((input) => {
    const rule = state.config.intakeRules[Number(input.dataset.ruleIndex)];
    const entry = rule?.entries?.[Number(input.dataset.entryIndex)];
    if (!entry) return;
    const field = input.dataset.ruleEntryField;
    entry[field] = field.includes("Weekday") ? Number(input.value) : input.value;
  });
  const defaultRules = (state.config.intakeRules || []).filter((rule) => rule.isDefault);
  if (defaultRules.length > 1) {
    defaultRules.slice(1).forEach((rule) => {
      rule.isDefault = false;
    });
  }
}

function buildCampaignDrafts() {
  const baseNo = Number(document.getElementById("baseNo").value || 0);
  const subNo = Number(document.getElementById("subNo").value || 1);
  const teacherCode = document.getElementById("teacherCode").value;
  const intakeRuleId = document.getElementById("intakeRuleSelect").value;
  const openDate = document.getElementById("openDate").value;
  const intakeStart = document.getElementById("intakeStart").value;
  const intakeEnd = document.getElementById("intakeEnd").value;
  const batchCount = Number(document.getElementById("batchCount").value || 1);
  const openWeekdays = [...document.querySelectorAll("#openWeekdays input:checked")].map((input) => Number(input.value));
  const subchannelIds = [...document.querySelectorAll("#builderSubchannels input:checked")].map((input) => input.value);
  if (!openDate) throw new Error("请先填写开课日期。");
  if (intakeRuleId === "custom" && (!intakeStart || !intakeEnd)) throw new Error("自定义接量日期需要填写接量开始和接量结束。");
  if (!openWeekdays.length) throw new Error("请至少选择一个批量开课周几。");
  if (!subchannelIds.length) throw new Error("请至少选择一个子渠道。");
  const openDates = nextOpenDatesByWeekdays(openDate, batchCount, openWeekdays);
  const intakeStartOffset = dayDiff(openDate, intakeStart);
  const intakeEndOffset = dayDiff(openDate, intakeEnd);
  const drafts = [];
  for (let i = 0; i < openDates.length; i += 1) {
    const nextOpen = openDates[i];
    const ruleRange = intakeRuleId === "custom" ? null : ruleBasedIntakeRange(nextOpen, intakeRuleId);
    if (intakeRuleId !== "custom" && !ruleRange) throw new Error(`接量规则没有配置 ${weekdayLabel(nextOpen)} 开课的时间。`);
    const nextIntakeStart = ruleRange?.intakeStart || addDays(nextOpen, intakeStartOffset);
    const nextIntakeEnd = ruleRange?.intakeEnd || addDays(nextOpen, intakeEndOffset);
    drafts.push({
      id: id("camp"),
      baseNo: baseNo + i,
      subNo,
      teacherCode,
      openDate: nextOpen,
      intakeStart: nextIntakeStart,
      intakeEnd: nextIntakeEnd,
      intakeRuleId: ruleRange?.intakeRuleId || "",
      intakeStartDateTime: ruleRange?.intakeStartDateTime || dateTimeValue(nextIntakeStart, "00:00"),
      intakeEndDateTime: ruleRange?.intakeEndDateTime || dateTimeValue(nextIntakeEnd, "23:59"),
      days: 14,
      subchannelIds,
      name: campaignName(baseNo + i, subNo, teacherCode, nextOpen),
      rOverrides: [],
    });
  }
  return drafts;
}

function buildMonthlyCampaignDrafts() {
  const month = document.getElementById("oneClickMonth").value || state.targetMonth;
  const { start, end } = monthBounds(month);
  const baseNo = Number(document.getElementById("baseNo").value || 0);
  const subNo = Number(document.getElementById("subNo").value || 1);
  const teacherCode = document.getElementById("teacherCode").value;
  const intakeRuleId = document.getElementById("intakeRuleSelect").value;
  const openDate = document.getElementById("openDate").value;
  const intakeStart = document.getElementById("intakeStart").value;
  const intakeEnd = document.getElementById("intakeEnd").value;
  const openWeekdays = [...document.querySelectorAll("#openWeekdays input:checked")].map((input) => Number(input.value));
  const subchannelIds = [...document.querySelectorAll("#builderSubchannels input:checked")].map((input) => input.value);
  if (!month) throw new Error("请先选择一键建期月份。");
  if (!openDate) throw new Error("请先填写开课日期。");
  if (intakeRuleId === "custom" && (!intakeStart || !intakeEnd)) throw new Error("自定义接量日期需要填写接量开始和接量结束。");
  if (!openWeekdays.length) throw new Error("请至少选择一个批量开课周几。");
  if (!subchannelIds.length) throw new Error("请至少选择一个子渠道。");
  const intakeStartOffset = dayDiff(openDate, intakeStart);
  const intakeEndOffset = dayDiff(openDate, intakeEnd);
  const openDates = [];
  let cursor = start;
  while (cursor <= end) {
    if (openWeekdays.includes(weekdayOf(cursor))) openDates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return openDates.map((nextOpen, index) => {
    const ruleRange = intakeRuleId === "custom" ? null : ruleBasedIntakeRange(nextOpen, intakeRuleId);
    if (intakeRuleId !== "custom" && !ruleRange) throw new Error(`接量规则没有配置 ${weekdayLabel(nextOpen)} 开课的时间。`);
    const nextIntakeStart = ruleRange?.intakeStart || addDays(nextOpen, intakeStartOffset);
    const nextIntakeEnd = ruleRange?.intakeEnd || addDays(nextOpen, intakeEndOffset);
    return {
      id: id("camp"),
      baseNo: baseNo + index,
      subNo,
      teacherCode,
      openDate: nextOpen,
      intakeStart: nextIntakeStart,
      intakeEnd: nextIntakeEnd,
      intakeRuleId: ruleRange?.intakeRuleId || "",
      intakeStartDateTime: ruleRange?.intakeStartDateTime || dateTimeValue(nextIntakeStart, "00:00"),
      intakeEndDateTime: ruleRange?.intakeEndDateTime || dateTimeValue(nextIntakeEnd, "23:59"),
      days: 14,
      subchannelIds,
      name: campaignName(baseNo + index, subNo, teacherCode, nextOpen),
      rOverrides: [],
    };
  });
}

async function saveBudgetSnapshot() {
  collectTargetInputs();
  const analysis = computeBudgetAnalysis(state.targetMonth, { useActuals: false });
  state.config.budgetSnapshots = state.config.budgetSnapshots || [];
  state.config.budgetSnapshots.push({
    id: id("budget"),
    month: state.targetMonth,
    createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    createdAtMs: Date.now(),
    monthTargetLeads: analysis.monthTargetLeads,
    availableLeads: analysis.availableLeads,
    targetGmv: analysis.targetGmv,
    campaignCount: analysis.campaignCount,
    rTargetTotal: analysis.rTargetTotal,
    breakdown: clone(analysis.breakdown),
    integrity: clone(analysis.integrity),
  });
  await saveConfig();
  render();
  setTargetHint(`已固定 ${state.targetMonth} 规划快照。`);
}

async function exportPonyBudget() {
  if (IS_STANDALONE) {
    alert("双击体验版不能生成 Excel 文件，请使用本地服务版或局域网版。");
    return;
  }
  collectTargetInputs();
  await saveConfig();
  const month = document.getElementById("budgetMonth")?.value || state.targetMonth;
  logOperation("export_pony_budget_start", { month });
  const response = await fetch(`/api/export-pony-budget?month=${encodeURIComponent(month)}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "生成 Pony 营期规划失败");
  }
  const blob = await response.blob();
  const disposition = response.headers.get("Content-Disposition") || "";
  const matched = disposition.match(/filename\*=UTF-8''([^;]+)/);
  const filename = matched
    ? decodeURIComponent(matched[1])
    : `Pony表营期规划-系统预算填充版-${month}.xlsx`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  logOperation("export_pony_budget_done", { month, filename });
  setTargetHint(`已生成 ${month} Pony营期规划。`);
}

function collectScenarioInputs() {
  state.predictionScenario = {};
  document.querySelectorAll("[data-scenario-sub]").forEach((input) => {
    const subId = input.dataset.scenarioSub;
    const field = input.dataset.scenarioField;
    const value = Number(input.value || 0);
    if (!state.predictionScenario[subId]) state.predictionScenario[subId] = {};
    if (value) state.predictionScenario[subId][field] = value;
  });
}

async function savePredictionSnapshot() {
  collectScenarioInputs();
  const month = selectedPredictionMonth();
  const machine = dxDayPrediction(month);
  const scenario = dxDayPrediction(month, scenarioAdjustments());
  state.config.predictionSnapshots = state.config.predictionSnapshots || [];
  state.config.predictionSnapshots.push({
    id: id("prediction"),
    month,
    createdAt: new Date().toLocaleString("zh-CN", { hour12: false }),
    createdAtMs: Date.now(),
    machineGmv: machine.totalGmv,
    scenarioGmv: scenario.totalGmv,
    machineRows: machine.rows,
    scenarioRules: clone(state.predictionScenario),
  });
  await saveConfig();
  renderPrediction();
  setHint(`已保存 ${month} 推演快照。`);
}

function predictionReportMarkdown() {
  const month = selectedPredictionMonth();
  collectScenarioInputs();
  const machine = dxDayPrediction(month);
  const scenario = dxDayPrediction(month, scenarioAdjustments());
  const overview = derivedOverview(month);
  const actualGmv = Number(overview.monthActualGmv || 0);
  const machineError = actualGmv ? (machine.totalGmv - actualGmv) / actualGmv : 0;
  const scenarioError = actualGmv ? (scenario.totalGmv - actualGmv) / actualGmv : 0;
  const topSub = machine.subDetails[0];
  const verdict = actualGmv
    ? (Math.abs(machineError) <= 0.05 ? "系统推演整体较准确" : Math.abs(machineError) <= 0.1 ? "系统推演存在轻微偏差" : "系统推演偏差较大，需要检查渠道和D阶段假设")
    : "当前月实际GMV尚未完整，报告以推演过程复盘为主";
  const lines = [
    `# ${month} 月度推演复盘报告`,
    "",
    "## 1. 月度摘要",
    `- 实际GMV：${fmtGmvPlain(actualGmv)}`,
    `- 系统推演GMV：${fmtGmvPlain(machine.totalGmv)}`,
    `- 业务模拟GMV：${fmtGmvPlain(scenario.totalGmv)}`,
    `- 系统推演误差：${actualGmv ? fmtPct(machineError) : "暂无完整实际"}`,
    `- 业务模拟误差：${actualGmv ? fmtPct(scenarioError) : "暂无完整实际"}`,
    `- 核心结论：${verdict}。`,
    "",
    "## 2. 推演拆解",
    `- 已发生实际GMV：${fmtGmvPlain(machine.historyActualGmv)}`,
    `- 未来系统推演GMV：${fmtGmvPlain(machine.futureGmv)}`,
    `- 待推演营期数：${fmtNumber(machine.rows.length)}`,
    `- 主要贡献渠道：${topSub ? `${topSub.subchannelName}，贡献 ${fmtGmvPlain(topSub.gmv)}` : "暂无"}`,
    "",
    "## 3. 未来营期推演",
    ...machine.rows.slice(0, 12).map((row) => `- ${row.name}（${row.openDate}）：${row.status}，未来${row.dxRange}推演GMV ${fmtGmvPlain(row.predictedGmv)}，主要贡献：${row.subTop.slice(0, 3).map((item) => `${item.subchannelName}${fmtGmvPlain(item.gmv)}`).join("；") || "暂无"}`),
    "",
    "## 4. 业务模拟",
    `- 业务模拟相对系统推演：${scenario.totalGmv - machine.totalGmv >= 0 ? "+" : ""}${fmtGmvPlain(scenario.totalGmv - machine.totalGmv)}`,
    `- 已设置规则数：${Object.values(state.predictionScenario || {}).filter((rule) => rule.leadsRate || rule.rLift).length}`,
    "",
    "## 5. 下月校准建议",
    "- 持续补齐子渠道实际Leads和D阶段R值，减少推演依据使用粗口径估算。",
    "- 对贡献最高且误差较大的子渠道，优先复核Leads满足率和D4-D8 R值。",
    "- 如果业务模拟连续两个月优于系统推演，可以把常用人工调整沉淀为默认推演规则。",
  ];
  state.lastPredictionReport = lines.join("\n");
  return state.lastPredictionReport;
}

function bindEvents() {
  window.addEventListener("error", (event) => {
    logOperation("frontend_error", {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    logOperation("frontend_unhandled_rejection", {
      reason: String(event.reason?.message || event.reason || ""),
    });
  });
  document.addEventListener("click", (event) => {
    const target = event.target.closest("button, .nav-item");
    if (!target) return;
    logOperation("click", {
      id: target.id || "",
      view: target.dataset?.view || "",
      text: target.textContent.trim().slice(0, 40),
    });
  }, true);
  document.addEventListener("change", (event) => {
    const target = event.target;
    if (target.dataset?.selectCampaign) {
      const selected = new Set(state.selectedBuilderCampaigns || []);
      if (target.checked) selected.add(target.dataset.selectCampaign);
      else selected.delete(target.dataset.selectCampaign);
      state.selectedBuilderCampaigns = [...selected];
      renderCampaignConfigRows();
    }
    if (!target?.id && !target?.name && target.type !== "file") return;
    logOperation("change", {
      id: target.id || "",
      type: target.type || target.tagName,
      value: target.type === "file" ? [...(target.files || [])].map((file) => file.name).join("、") : String(target.value || "").slice(0, 60),
    });
  }, true);
  document.querySelectorAll(".nav-item").forEach((item) => item.addEventListener("click", () => setView(item.dataset.view)));
  document.querySelectorAll("[data-config-tab]").forEach((item) => item.addEventListener("click", () => {
    collectEditors();
    state.configTab = item.dataset.configTab || "campaigns";
    render();
  }));
  document.querySelectorAll("[data-plan-tab]").forEach((item) => item.addEventListener("click", () => {
    state.planTab = item.dataset.planTab || "analysis";
    renderPlan();
  }));
  document.getElementById("campaignBudgetCalendar").addEventListener("click", (event) => {
    const button = event.target.closest("[data-toggle-campaign-budget]");
    if (!button) return;
    const name = button.dataset.toggleCampaignBudget;
    const expanded = new Set(state.expandedCampaignBudgetRows || []);
    if (expanded.has(name)) expanded.delete(name);
    else expanded.add(name);
    state.expandedCampaignBudgetRows = [...expanded];
    renderCampaignBudgetCalendar();
  });
  document.getElementById("campaignBudgetCalendar").addEventListener("change", (event) => {
    const target = event.target;
    if (target.dataset?.selectBudgetCampaign) {
      const selected = new Set(state.selectedBudgetCampaigns || []);
      if (target.checked) selected.add(target.dataset.selectBudgetCampaign);
      else selected.delete(target.dataset.selectBudgetCampaign);
      state.selectedBudgetCampaigns = [...selected];
    }
    if (target.dataset?.selectBudgetSub) {
      const selected = new Set(state.selectedBudgetSubRows || []);
      if (target.checked) selected.add(target.dataset.selectBudgetSub);
      else selected.delete(target.dataset.selectBudgetSub);
      state.selectedBudgetSubRows = [...selected];
    }
    if (target.dataset?.budgetRCampaign) {
      setCampaignBudgetDraftValue(target.dataset.budgetRCampaign, target.dataset.budgetRSub, target.dataset.budgetRStage, target.value);
      renderCampaignBudgetCalendar();
    }
  });
  document.getElementById("campaignBudgetCalendar").addEventListener("input", (event) => {
    const target = event.target;
    if (!target.dataset?.budgetRCampaign) return;
    setCampaignBudgetDraftValue(target.dataset.budgetRCampaign, target.dataset.budgetRSub, target.dataset.budgetRStage, target.value);
  });
  document.getElementById("editCampaignBudgetR").addEventListener("click", enterCampaignBudgetEditMode);
  document.getElementById("batchFillCampaignBudgetR").addEventListener("click", batchFillCampaignBudgetR);
  document.getElementById("copyCampaignBudgetR").addEventListener("click", copyCampaignBudgetR);
  document.getElementById("saveCampaignBudgetR").addEventListener("click", () => {
    saveCampaignBudgetROverrides().catch((error) => alert(error.message));
  });
  document.getElementById("cancelCampaignBudgetR").addEventListener("click", cancelCampaignBudgetEditMode);
  document.getElementById("goConfig").addEventListener("click", () => setView("config"));
  document.getElementById("importConfigFile").addEventListener("click", () => document.getElementById("configFileInput").click());
  document.getElementById("configFileInput").addEventListener("change", (event) => {
    importConfigJson(event.target.files?.[0]);
    event.target.value = "";
  });
  document.getElementById("exportConfigFile").addEventListener("click", exportConfigJson);
  document.getElementById("importActualFile").addEventListener("click", () => document.getElementById("actualFileInput").click());
  document.getElementById("actualFileInput").addEventListener("change", (event) => {
    importActualFileData(event.target.files?.[0]);
    event.target.value = "";
  });
  document.getElementById("importChannelAnalysisFile").addEventListener("click", () => document.getElementById("channelAnalysisFileInput").click());
  document.getElementById("channelAnalysisFileInput").addEventListener("change", (event) => {
    importChannelAnalysisFile(event.target.files?.[0]);
    event.target.value = "";
  });
  document.getElementById("showTeamCalibration").addEventListener("click", () => {
    state.channelAnalysisTab = "calibration";
    renderChannelAnalysis();
  });
  document.querySelectorAll("[data-channel-analysis-tab]").forEach((item) => item.addEventListener("click", () => {
    state.channelAnalysisTab = item.dataset.channelAnalysisTab || "analysis";
    renderChannelAnalysis();
  }));
  document.getElementById("channelAnalysisPanel").addEventListener("click", (event) => {
    const perspective = event.target.closest("[data-channel-perspective]");
    if (perspective) {
      state.channelAnalysisPerspective = perspective.dataset.channelPerspective === "channel" ? "channel" : "studio";
      state.channelAnalysisSelected = { level: "all", key: "全部", label: "全部", filters: {} };
      state.channelAnalysisCompareKeys = [];
      state.channelAnalysisBreakdownSelection = null;
      pushChannelBotLog("perspective", { perspective: state.channelAnalysisPerspective });
      renderChannelAnalysis();
      return;
    }
    if (event.target.closest("[data-channel-reset]")) {
      state.channelAnalysisSelected = { level: "all", key: "全部", label: "全部", filters: {} };
      state.channelAnalysisBreakdownSelection = null;
      pushChannelBotLog("select", { label: "全部", level: "all" });
      renderChannelAnalysis();
      return;
    }
    if (event.target.closest("[data-channel-clear-compare]")) {
      state.channelAnalysisCompareKeys = [];
      pushChannelBotLog("compare", { labels: [], count: 0 });
      renderChannelAnalysis();
      return;
    }
    const removeCompare = event.target.closest("[data-channel-compare-remove]");
    if (removeCompare) {
      const selected = new Set(state.channelAnalysisCompareKeys || []);
      selected.delete(removeCompare.dataset.channelCompareRemove);
      state.channelAnalysisCompareKeys = [...selected];
      pushChannelBotLog("compare", {
        labels: state.channelAnalysisCompareKeys.map((key) => channelAnalysisSelectionLabel(decodeChannelNode(key))),
        count: state.channelAnalysisCompareKeys.length,
      });
      renderChannelAnalysis();
      return;
    }
    if (event.target.closest("[data-channel-breakdown-auto]")) {
      state.channelAnalysisBreakdownSelection = null;
      pushChannelBotLog("breakdown_auto", { label: channelAnalysisSelectionLabel() });
      renderChannelAnalysis();
    }
  });
  document.getElementById("channelAnalysisTree").addEventListener("click", (event) => {
    if (event.target.closest("[data-channel-compare], [data-channel-compare-remove]")) return;
    const button = event.target.closest("[data-channel-node]");
    if (!button) return;
    setChannelAnalysisSelection(decodeChannelNode(button.dataset.channelNode));
  });
  document.getElementById("channelAnalysisTree").addEventListener("change", (event) => {
    const target = event.target;
    if (target.id === "channelAnalysisPerspective") {
      state.channelAnalysisPerspective = target.value === "channel" ? "channel" : "studio";
      state.channelAnalysisSelected = { level: "all", key: "全部", label: "全部", filters: {} };
      state.channelAnalysisCompareKeys = [];
      pushChannelBotLog("perspective", { perspective: state.channelAnalysisPerspective });
      renderChannelAnalysis();
      return;
    }
    if (!target.dataset?.channelCompare) return;
    const selected = new Set(state.channelAnalysisCompareKeys || []);
    if (target.checked) selected.add(target.dataset.channelCompare);
    else selected.delete(target.dataset.channelCompare);
    state.channelAnalysisCompareKeys = [...selected];
    pushChannelBotLog("compare", {
      labels: state.channelAnalysisCompareKeys.map((key) => channelAnalysisSelectionLabel(decodeChannelNode(key))),
      count: state.channelAnalysisCompareKeys.length,
    });
    renderChannelAnalysis();
  });
  document.getElementById("channelAnalysisTrend").addEventListener("change", (event) => {
    const target = event.target;
    if (target.dataset && "channelBreakdownSelection" in target.dataset) {
      if (target.value === "__auto__") {
        state.channelAnalysisBreakdownSelection = null;
        pushChannelBotLog("breakdown_auto", { label: channelAnalysisSelectionLabel() });
      } else {
        state.channelAnalysisBreakdownSelection = decodeChannelNode(target.value);
        pushChannelBotLog("breakdown_manual", { label: channelAnalysisSelectionLabel(state.channelAnalysisBreakdownSelection) });
      }
      renderChannelAnalysis();
      return;
    }
  });
  document.getElementById("channelAnalysisMetricPicker").addEventListener("change", (event) => {
    const target = event.target;
    if (!target.dataset?.channelMetric) return;
    const selected = new Set(selectedChannelMetrics());
    if (target.checked) selected.add(target.dataset.channelMetric);
    else selected.delete(target.dataset.channelMetric);
    if (!selected.size) selected.add("leads");
    state.channelAnalysisMetrics = [...selected].slice(0, 4);
    state.channelAnalysisMetric = state.channelAnalysisMetrics[0] || "leads";
    pushChannelBotLog("metric", {
      metrics: state.channelAnalysisMetrics.map((metric) => CHANNEL_ANALYSIS_METRICS[metric]?.label || metric),
    });
    renderChannelAnalysis();
  });
  document.getElementById("channelAnalysisTrend").addEventListener("click", (event) => {
    const legendSeries = event.target.closest("[data-channel-legend-series]");
    if (legendSeries) {
      state.channelAnalysisHighlightSeriesKey = legendSeries.dataset.channelLegendSeries || "";
      pushChannelBotLog("highlight_series", { series: legendSeries.textContent.trim().replace(/\s+/g, " ").slice(0, 80) });
      if (state.channelAnalysisActiveHighlight?.points?.length) {
        state.channelAnalysisHighlights = [...(state.channelAnalysisHighlights || []), state.channelAnalysisActiveHighlight];
        state.channelAnalysisActiveHighlight = null;
      }
      renderChannelAnalysis();
      return;
    }
    const point = event.target.closest("[data-trend-point]");
    if (point) {
      const seriesKey = state.channelAnalysisHighlightSeriesKey || point.dataset.trendPoint;
      const index = Number(point.dataset.trendIndex || 0);
      const current = state.channelAnalysisActiveHighlight;
      state.channelAnalysisHighlightSeriesKey = seriesKey;
      if (!current || current.seriesKey !== seriesKey) {
        state.channelAnalysisActiveHighlight = { seriesKey, color: state.channelAnalysisHighlightColor || "#e11d48", points: [index] };
      } else {
        const selected = new Set(current.points || []);
        if (selected.has(index)) selected.delete(index);
        else selected.add(index);
        state.channelAnalysisActiveHighlight = { ...current, color: state.channelAnalysisHighlightColor || current.color || "#e11d48", points: [...selected].sort((a, b) => a - b) };
      }
      pushChannelBotLog("highlight_point", { series: seriesKey.split("||")[0] || seriesKey, index });
      renderChannelAnalysis();
      return;
    }
    const newSegment = event.target.closest("[data-channel-highlight-new]");
    if (newSegment) {
      const active = state.channelAnalysisActiveHighlight;
      if (active?.points?.length) {
        state.channelAnalysisHighlights = [...(state.channelAnalysisHighlights || []), active];
        state.channelAnalysisActiveHighlight = null;
      }
      renderChannelAnalysis();
      return;
    }
    const clear = event.target.closest("[data-channel-highlight-clear]");
    if (clear) {
      state.channelAnalysisHighlights = [];
      state.channelAnalysisActiveHighlight = null;
      renderChannelAnalysis();
      return;
    }
    const applyColor = event.target.closest("[data-channel-highlight-apply-color]");
    if (applyColor) {
      const colorInput = document.querySelector("[data-channel-highlight-color]");
      applyChannelHighlightColor(colorInput?.value || state.channelAnalysisHighlightColor);
      pushChannelBotLog("highlight_color", { color: state.channelAnalysisHighlightColor });
      renderChannelAnalysis();
      return;
    }
    const button = event.target.closest("[data-channel-chart-zoom]");
    if (!button) return;
    const action = button.dataset.channelChartZoom;
    const current = Number(state.channelAnalysisChartZoom || 1);
    if (action === "in") state.channelAnalysisChartZoom = Math.min(4, Number((current + 0.25).toFixed(2)));
    if (action === "out") state.channelAnalysisChartZoom = Math.max(1, Number((current - 0.25).toFixed(2)));
    if (action === "reset") state.channelAnalysisChartZoom = 1;
    pushChannelBotLog("zoom", { zoom: `${Math.round(state.channelAnalysisChartZoom * 100)}%` });
    renderChannelAnalysis();
  });
  document.getElementById("channelAnalysisTrend").addEventListener("input", (event) => {
    const target = event.target;
    if (!target.dataset || !("channelHighlightColor" in target.dataset)) return;
    state.channelAnalysisHighlightColor = target.value || "#e11d48";
  });
  document.getElementById("channelAnalysisTrend").addEventListener("change", (event) => {
    const target = event.target;
    if (!target.dataset || !("channelHighlightSeries" in target.dataset)) return;
    state.channelAnalysisHighlightSeriesKey = target.value || "";
    if (state.channelAnalysisActiveHighlight?.points?.length) {
      state.channelAnalysisHighlights = [...(state.channelAnalysisHighlights || []), state.channelAnalysisActiveHighlight];
      state.channelAnalysisActiveHighlight = null;
    }
    renderChannelAnalysis();
  });
  let channelChartDrag = null;
  document.getElementById("channelAnalysisTrend").addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, select, input, label, [data-trend-point]")) return;
    const wrap = event.target.closest(".channel-line-chart-wrap");
    if (!wrap) return;
    channelChartDrag = { wrap, x: event.clientX, scrollLeft: wrap.scrollLeft };
    wrap.classList.add("dragging");
    wrap.setPointerCapture?.(event.pointerId);
  });
  document.getElementById("channelAnalysisTrend").addEventListener("pointermove", (event) => {
    if (!channelChartDrag) return;
    channelChartDrag.wrap.scrollLeft = channelChartDrag.scrollLeft - (event.clientX - channelChartDrag.x);
  });
  const stopChannelChartDrag = (event) => {
    if (!channelChartDrag) return;
    channelChartDrag.wrap.classList.remove("dragging");
    channelChartDrag.wrap.releasePointerCapture?.(event.pointerId);
    channelChartDrag = null;
  };
  document.getElementById("channelAnalysisTrend").addEventListener("pointerup", stopChannelChartDrag);
  document.getElementById("channelAnalysisTrend").addEventListener("pointercancel", stopChannelChartDrag);
  document.getElementById("channelAnalysisTrend").addEventListener("pointerleave", stopChannelChartDrag);
  document.getElementById("channelAnalysisTrend").addEventListener("wheel", (event) => {
    const wrap = event.target.closest(".channel-line-chart-wrap");
    if (!wrap || wrap.scrollWidth <= wrap.clientWidth) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    wrap.scrollLeft += delta;
    event.preventDefault();
  }, { passive: false });
  document.getElementById("saveTeamCalibration").addEventListener("click", () => {
    saveTeamCalibration().catch((error) => alert(error.message));
  });
  document.getElementById("campaignSearch").addEventListener("input", renderCampaigns);
  document.getElementById("campaignModeFilter").addEventListener("change", renderCampaigns);
  document.getElementById("stageFilter").addEventListener("change", renderCampaigns);
  document.getElementById("dailyMonthFilter").addEventListener("change", (event) => {
    state.dailyMonth = event.target.value;
    renderDaily();
  });
  document.getElementById("overviewMonthFilter").addEventListener("change", (event) => {
    state.overviewMonth = event.target.value;
    renderOverview();
    updateMeta();
  });
  document.getElementById("revenueSyncButton").addEventListener("click", () => {
    syncRevenueFromCrm();
  });
  document.getElementById("predictionMonth").addEventListener("change", (event) => {
    state.predictionMonth = event.target.value;
    state.selectedRevenueDate = "";
    state.selectedRevenueCampaign = "";
    renderPrediction();
  });
  document.getElementById("revenueCalendar").addEventListener("click", (event) => {
    const cell = event.target.closest("[data-revenue-date]");
    if (!cell) return;
    state.selectedRevenueDate = cell.dataset.revenueDate;
    state.selectedRevenueCampaign = cell.dataset.revenueCampaign || "";
    const calendar = revenueCalendarData(selectedPredictionMonth(), scenarioAdjustments());
    document.querySelectorAll(".revenue-calendar-table .selected").forEach((item) => item.classList.remove("selected"));
    document.querySelectorAll(`[data-revenue-date="${state.selectedRevenueDate}"]`).forEach((item) => {
      if (!state.selectedRevenueCampaign || item.dataset.revenueCampaign === state.selectedRevenueCampaign || !item.dataset.revenueCampaign) {
        item.classList.add("selected");
      }
    });
    renderRevenueCalendarDetail(calendar, state.selectedRevenueDate, state.selectedRevenueCampaign);
  });
  document.getElementById("refreshPrediction").addEventListener("click", renderPrediction);
  document.getElementById("savePredictionSnapshot").addEventListener("click", () => {
    savePredictionSnapshot().catch((error) => alert(error.message));
  });
  document.getElementById("generatePredictionReport").addEventListener("click", () => {
    document.querySelector(".report-collapse")?.setAttribute("open", "");
    document.getElementById("predictionReport").textContent = predictionReportMarkdown();
  });
  document.getElementById("copyPredictionReport").addEventListener("click", () => {
    document.querySelector(".report-collapse")?.setAttribute("open", "");
    const text = state.lastPredictionReport || predictionReportMarkdown();
    navigator.clipboard?.writeText(text);
    document.getElementById("predictionReport").textContent = text;
  });
  document.getElementById("exportPredictionMarkdown").addEventListener("click", () => {
    const month = selectedPredictionMonth();
    downloadText(state.lastPredictionReport || predictionReportMarkdown(), `${month}-月度推演复盘报告.md`, "text/markdown;charset=utf-8");
  });
  document.getElementById("exportPredictionHtml").addEventListener("click", () => {
    const month = selectedPredictionMonth();
    const md = state.lastPredictionReport || predictionReportMarkdown();
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>${month} 月度推演复盘报告</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;line-height:1.7;max-width:920px;margin:40px auto;color:#12202b}pre{white-space:pre-wrap}</style></head><body><pre>${md.replace(/[&<>]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]))}</pre></body></html>`;
    downloadText(html, `${month}-月度推演复盘报告.html`, "text/html;charset=utf-8");
  });
  document.getElementById("dailySubchannelFilter").addEventListener("change", renderDaily);
  document.getElementById("channelLevelFilter").addEventListener("change", renderChannels);
  document.getElementById("builderMonthFilter").addEventListener("change", (event) => {
    state.builderMonth = event.target.value;
    state.selectedBuilderCampaigns = [];
    state.campaignSubSyncAll = false;
    state.campaignSubSyncCampaigns = [];
    renderCampaignConfigRows();
  });
  document.getElementById("toggleBuilderSort").addEventListener("click", () => {
    state.builderSort = state.builderSort === "asc" ? "desc" : "asc";
    renderCampaignConfigRows();
  });
  document.getElementById("selectAllCampaignRows").addEventListener("change", (event) => {
    const visible = [...document.querySelectorAll("[data-select-campaign]")].map((input) => input.dataset.selectCampaign);
    state.selectedBuilderCampaigns = event.target.checked ? visible : [];
    renderCampaignConfigRows();
  });
  document.getElementById("selectVisibleCampaigns").addEventListener("click", () => {
    state.selectedBuilderCampaigns = [...document.querySelectorAll("[data-select-campaign]")].map((input) => input.dataset.selectCampaign);
    renderCampaignConfigRows();
  });
  document.getElementById("clearVisibleCampaigns").addEventListener("click", () => {
    state.selectedBuilderCampaigns = [];
    renderCampaignConfigRows();
  });
  document.getElementById("toggleCampaignSubSync").addEventListener("click", () => {
    state.campaignSubSyncOpen = !state.campaignSubSyncOpen;
    if (!state.campaignSubSyncOpen) {
      state.campaignSubSyncAll = false;
      state.campaignSubSyncCampaigns = [];
      state.campaignSubSyncSubs = [];
    }
    renderCampaignConfigRows();
  });
  document.getElementById("campaignSubSyncPanel").addEventListener("change", (event) => {
    const target = event.target;
    if (target.id === "campaignSubSyncAll") {
      state.campaignSubSyncAll = target.checked;
      if (!target.checked) state.campaignSubSyncCampaigns = [];
      renderCampaignConfigRows();
      return;
    }
    if (target.dataset?.syncCampaign) {
      const selected = new Set(state.campaignSubSyncCampaigns || []);
      if (target.checked) selected.add(target.dataset.syncCampaign);
      else {
        selected.delete(target.dataset.syncCampaign);
        state.campaignSubSyncAll = false;
      }
      state.campaignSubSyncCampaigns = [...selected];
      renderCampaignConfigRows();
      return;
    }
    if (target.dataset?.syncSub) {
      const selected = new Set(state.campaignSubSyncSubs || []);
      if (target.checked) selected.add(target.dataset.syncSub);
      else selected.delete(target.dataset.syncSub);
      state.campaignSubSyncSubs = [...selected];
      renderCampaignConfigRows();
    }
  });
  document.getElementById("campaignSubSyncPanel").addEventListener("click", (event) => {
    if (event.target.id === "closeCampaignSubSync") {
      state.campaignSubSyncOpen = false;
      state.campaignSubSyncAll = false;
      state.campaignSubSyncCampaigns = [];
      state.campaignSubSyncSubs = [];
      renderCampaignConfigRows();
    }
    if (event.target.id === "saveCampaignSubSync") {
      saveCampaignSubSync().catch((error) => alert(error.message));
    }
  });
  document.getElementById("bulkDeleteCampaigns").addEventListener("click", async () => {
    const names = new Set(state.selectedBuilderCampaigns || []);
    const matched = (state.config.campaigns || []).filter((campaign) => names.has(campaign.name));
    if (!matched.length) {
      alert("请先勾选要删除的在线建期。历史导入营期不能在建期中心删除。");
      return;
    }
    if (!confirm(`确认删除选中的 ${matched.length} 个在线建期？\n\n不会删除历史导入的实际结果数据，系统保存时也会自动生成配置备份。`)) return;
    state.config.campaigns = (state.config.campaigns || []).filter((campaign) => !names.has(campaign.name));
    state.selectedBuilderCampaigns = [];
    logOperation("bulk_delete_campaigns", { count: matched.length, names: matched.map((campaign) => campaign.name) });
    await saveConfig();
    render();
  });
  document.getElementById("downloadLeadTargetTemplate").addEventListener("click", downloadLeadTargetTemplate);
  document.getElementById("importLeadTargetCsv").addEventListener("click", () => document.getElementById("leadTargetCsvInput").click());
  document.getElementById("leadTargetCsvInput").addEventListener("change", (event) => {
    importLeadTargetCsv(event.target.files?.[0]).catch((error) => alert(error.message));
    event.target.value = "";
  });
  document.getElementById("copyTargetToMonth").addEventListener("click", copyFirstFilledTargetToMonth);
  document.getElementById("downloadRTemplateCsv").addEventListener("click", downloadRTemplateCsv);
  document.getElementById("importRTemplateCsv").addEventListener("click", () => document.getElementById("rTemplateCsvInput").click());
  document.getElementById("rTemplateCsvInput").addEventListener("change", (event) => {
    importRTemplateCsv(event.target.files?.[0]).catch((error) => alert(error.message));
    event.target.value = "";
  });
  document.getElementById("downloadCampaignPlanCsv").addEventListener("click", downloadCampaignPlanCsv);
  document.getElementById("importCampaignPlanCsv").addEventListener("click", () => document.getElementById("campaignPlanCsvInput").click());
  document.getElementById("campaignPlanCsvInput").addEventListener("change", (event) => {
    importCampaignPlanCsv(event.target.files?.[0]).catch((error) => alert(error.message));
    event.target.value = "";
  });

  document.getElementById("addChannel").addEventListener("click", () => {
    collectEditors();
    state.config.channels.push({ id: id("channel"), name: "新渠道" });
    renderConfig();
  });
  document.getElementById("addSubchannel").addEventListener("click", () => {
    collectEditors();
    state.config.subchannels.push({ id: id("sub"), channelId: state.config.channels[0]?.id || "", name: "新子渠道" });
    renderConfig();
  });
  document.getElementById("addTeacher").addEventListener("click", () => {
    collectEditors();
    state.config.teachers.push({ code: "XX", name: "新老师" });
    renderConfig();
  });
  document.getElementById("addIntakeRule").addEventListener("click", () => {
    collectEditors();
    state.config.intakeRules.push({
      id: id("rule"),
      name: "新接量规则",
      allocation: "hourly",
      isDefault: false,
      entries: [
        { openWeekday: 1, startWeekday: 3, startTime: "10:00", endWeekday: 6, endTime: "22:00" },
      ],
    });
    renderConfig();
  });
  document.addEventListener("click", async (event) => {
    const target = event.target;
    if (target.dataset?.deleteChannel) {
      state.config.channels.splice(Number(target.dataset.deleteChannel), 1);
      renderConfig();
    }
    if (target.dataset?.deleteSubchannel) {
      state.config.subchannels.splice(Number(target.dataset.deleteSubchannel), 1);
      renderConfig();
    }
    if (target.dataset?.deleteTeacher) {
      state.config.teachers.splice(Number(target.dataset.deleteTeacher), 1);
      renderConfig();
    }
    if (target.dataset?.addRuleEntry) {
      collectEditors();
      const rule = state.config.intakeRules[Number(target.dataset.addRuleEntry)];
      rule?.entries?.push({ openWeekday: 4, startWeekday: 6, startTime: "22:00", endWeekday: 3, endTime: "10:00" });
      renderConfig();
    }
    if (target.dataset?.deleteRuleEntry) {
      collectEditors();
      const [ruleIndex, entryIndex] = target.dataset.deleteRuleEntry.split(":").map(Number);
      state.config.intakeRules[ruleIndex]?.entries?.splice(entryIndex, 1);
      renderConfig();
    }
    if (target.dataset?.deleteIntakeRule) {
      collectEditors();
      state.config.intakeRules.splice(Number(target.dataset.deleteIntakeRule), 1);
      if (!state.config.intakeRules.length) state.config.intakeRules = defaultIntakeRules();
      renderConfig();
    }
    if (target.dataset?.deleteCampaign) {
      const name = target.dataset.deleteCampaign;
      const exists = (state.config.campaigns || []).some((campaign) => campaign.name === name);
      if (!exists) {
        alert("这是历史结果数据推测出来的营期，不能在建期中心删除。");
        return;
      }
      if (!confirm(`确认删除营期：${name}？\n\n只会删除在线建期规划，不会删除已导入的实际结果数据。`)) return;
      state.config.campaigns = (state.config.campaigns || []).filter((campaign) => campaign.name !== name);
      logOperation("delete_campaign", { name });
      await saveConfig();
      render();
    }
    if (target.dataset?.editTargetDate) {
      const date = target.dataset.editTargetDate;
      const subId = target.dataset.editTargetSub;
      state.targetMonth = date.slice(0, 7);
      renderCalendarTargets();
      requestAnimationFrame(() => {
        const input = document.querySelector(`[data-target-date="${date}"][data-target-sub="${subId}"]`);
        if (!input) return;
        input.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
        input.focus();
        input.select();
      });
    }
  });
  document.getElementById("saveConfig").addEventListener("click", async () => {
    collectEditors();
    await saveConfig();
    document.getElementById("configSaveHint").textContent = "已保存到本地 JSON";
    render();
  });
  document.getElementById("buildTargetGrid").addEventListener("click", () => {
    state.targetMonth = document.getElementById("targetMonth").value || state.targetMonth;
    renderCalendarTargets();
  });
  document.getElementById("budgetMonth").addEventListener("change", (event) => {
    state.targetMonth = event.target.value || state.targetMonth;
    renderPlan();
  });
  document.getElementById("targetMonth").addEventListener("change", (event) => {
    state.targetMonth = event.target.value || state.targetMonth;
    renderCalendarTargets();
  });
  document.getElementById("targetGrid").addEventListener("input", (event) => {
    if (!event.target.dataset?.targetDate) return;
    setTarget(event.target.dataset.targetDate, event.target.dataset.targetSub, event.target.value);
    renderBudgetAnalysis();
  });
  document.getElementById("saveBudgetSnapshot").addEventListener("click", () => {
    saveBudgetSnapshot().catch((error) => alert(error.message));
  });
  document.getElementById("exportPonyBudget").addEventListener("click", () => {
    exportPonyBudget().catch((error) => alert(error.message));
  });
  document.getElementById("saveTargets").addEventListener("click", async () => {
    const count = collectTargetInputs();
    await saveConfig();
    render();
    setTargetHint(`已保存 ${count} 个预算目标单元格，并已同步营期目标。`);
  });
  document.getElementById("saveRTemplates").addEventListener("click", async () => {
    collectRTemplateInputs();
    await saveConfig();
    render();
  });
  document.getElementById("selectAllCampaignCopies").addEventListener("click", () => {
    document.querySelectorAll("[data-copy-campaign-name]").forEach((input) => {
      input.checked = true;
    });
  });
  document.getElementById("clearCampaignCopies").addEventListener("click", () => {
    document.querySelectorAll("[data-copy-campaign-name]").forEach((input) => {
      input.checked = false;
    });
  });
  document.getElementById("copyRTemplatesToCampaigns").addEventListener("click", copyRTemplatesToCampaigns);
  document.getElementById("previewCampaigns").addEventListener("click", () => {
    try {
      const drafts = buildCampaignDrafts();
      alert(drafts.map((item) => item.name).join("\n") || "请先填写建期信息");
    } catch (error) {
      alert(error.message);
    }
  });
  document.getElementById("createCampaigns").addEventListener("click", async () => {
    try {
      const drafts = buildCampaignDrafts();
      state.config.campaigns.push(...drafts);
      await saveConfig();
      renderBuilder();
    } catch (error) {
      alert(error.message);
    }
  });
  document.getElementById("oneClickCreateMonth").addEventListener("click", async () => {
    try {
      const drafts = buildMonthlyCampaignDrafts();
      const existing = new Set((state.config.campaigns || []).map((campaign) => campaign.name));
      const created = drafts.filter((campaign) => !existing.has(campaign.name));
      state.config.campaigns.push(...created);
      await saveConfig();
      const month = document.getElementById("oneClickMonth").value || state.targetMonth;
      document.getElementById("oneClickHint").textContent = `${month} 已新增 ${created.length} 个，跳过 ${drafts.length - created.length} 个同名营期。`;
      renderBuilder();
    } catch (error) {
      alert(error.message);
    }
  });
}

(async function init() {
  mountPlanSections();
  bindEvents();
  if (IS_STANDALONE) {
    document.querySelector(".brand small").textContent = "双击版 · 本地 JSON";
    document.getElementById("pageSubtitle").textContent = "双击版可在线配置目标、导入CSV目标和结果数据。";
  }
  await loadConfig();
  const today = new Date();
  state.targetMonth = formatLocalDay(today).slice(0, 7);
  render();
})();
