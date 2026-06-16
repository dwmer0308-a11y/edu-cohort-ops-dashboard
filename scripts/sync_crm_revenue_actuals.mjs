#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const STORAGE_STATE = path.join(ROOT, ".local", "crm-storage-state.json");
const OUTPUT_PATH = path.join(ROOT, "data", "revenue-actuals.json");
const BACKUP_DIR = path.join(ROOT, "data", "backups");
const REPORT_DIR = path.join(ROOT, "data", "integration-checks", "reports");
const ORDER_LIST_URL = "https://kapi.likeduoduiyi.cn/kk/cms/order/list";

const SEGMENTS = [
  { business: "书法", side: "前端", label: "书法前端", category: 3, type: "1", businessDepartId: 1, orderKind: "销转订单", crmBusiness: "书法" },
  { business: "书法", side: "后端", label: "书法后端", category: 3, type: "2", businessDepartId: 2, orderKind: "学管扩转续订单", crmBusiness: "书法" },
  { business: "朗诵", side: "后端", label: "朗诵后端", category: 14, type: "2", businessDepartId: 2, orderKind: "学管扩转续订单", crmBusiness: "朗诵" },
];

function parseArgs(argv) {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const args = { month, dryRun: false };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--month") args.month = argv[++index];
    else if (arg.startsWith("--month=")) args.month = arg.slice("--month=".length);
    else if (arg === "--end-date") args.endDate = argv[++index];
    else if (arg.startsWith("--end-date=")) args.endDate = arg.slice("--end-date=".length);
    else if (arg === "--dry-run") args.dryRun = true;
  }
  return args;
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

function todayLocal() {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function daysForMonth(month, endDate = "") {
  const [year, monthIndex] = month.split("-").map(Number);
  const end = endDate || todayLocal();
  const monthEnd = `${month}-${pad(new Date(year, monthIndex, 0).getDate())}`;
  const finalDay = end.startsWith(month) && end < monthEnd ? end : monthEnd;
  const days = [];
  for (let day = 1; day <= Number(finalDay.slice(-2)); day += 1) {
    days.push(`${month}-${pad(day)}`);
  }
  return days;
}

function amountFromText(value) {
  const text = String(value ?? "0").replace(/,/g, "").trim();
  const match = text.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

async function readToken() {
  const state = JSON.parse(await fs.readFile(STORAGE_STATE, "utf8"));
  const storage = state.origins?.find((item) => item.origin === "https://kkhc-admin.likeduoduiyi.cn")?.localStorage || [];
  const adminInfo = JSON.parse(storage.find((item) => item.name === "admin_info")?.value || "{}");
  if (!adminInfo.token) throw new Error("CRM 登录态里没有 token，请先运行 scripts/refresh_crm_login.mjs 重新登录。");
  return adminInfo.token;
}

function basePayload(day, segment) {
  return {
    category: segment.category,
    goodsId: "",
    nickName: "",
    orderTime: [`${day} 00:00:00`, `${day} 23:59:59`],
    payTime: [],
    payStatus: "",
    payType: "",
    campIds: [],
    empIds: [],
    orderNo: "",
    inClass: "",
    type: segment.type,
    addAst: "",
    classCampId: "",
    outNo: "",
    needJudge: "",
    isCombine: "",
    isUp: "",
    empNum: "",
    frontEnd: "",
    isSale: "",
    saleCampId: "",
    astId: "",
    handoverCampId: "",
    refundStatus: "",
    businessDepartId: segment.businessDepartId,
    invoiceStatus: "",
    redFlag: "",
    isHaveAddress: "",
    kkTeamId: "",
    kkGroupId: "",
    auditStatus: "",
    unionId: "",
    startTime: `${day} 00:00:00`,
    endTime: `${day} 23:59:59`,
    current: 1,
    size: 20,
  };
}

async function fetchSegmentDay(token, day, segment) {
  const response = await fetch(ORDER_LIST_URL, {
    method: "POST",
    headers: {
      accept: "application/json, text/plain, */*",
      "content-type": "application/json;charset=UTF-8",
      referer: "https://kkhc-admin.likeduoduiyi.cn/",
      token,
    },
    body: JSON.stringify(basePayload(day, segment)),
  });
  const payload = await response.json();
  if (!response.ok || payload.status !== 200) {
    throw new Error(`${segment.label} ${day} CRM请求失败：HTTP ${response.status} ${payload.status || ""} ${payload.message || ""}`.trim());
  }
  const data = payload.data || {};
  return {
    date: day,
    business: segment.business,
    side: segment.side,
    label: segment.label,
    amount: amountFromText(data.totalPriceString),
    orderKind: segment.orderKind,
    crmBusiness: segment.crmBusiness,
    rowCount: Number(data.total || 0),
    source: "crm",
    sourceField: "totalPriceString",
    timeField: "createTime",
  };
}

async function backupExisting() {
  try {
    await fs.access(OUTPUT_PATH);
  } catch {
    return "";
  }
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  const backupPath = path.join(BACKUP_DIR, `revenue-actuals-${stamp()}.json`);
  await fs.copyFile(OUTPUT_PATH, backupPath);
  return backupPath;
}

async function main() {
  const args = parseArgs(process.argv);
  const days = daysForMonth(args.month, args.endDate);
  const token = await readToken();
  const records = [];
  for (const day of days) {
    for (const segment of SEGMENTS) {
      records.push(await fetchSegmentDay(token, day, segment));
    }
  }
  const source = SEGMENTS.map((segment) => {
    const segmentRecords = records.filter((item) => item.label === segment.label);
    return {
      label: segment.label,
      business: segment.business,
      side: segment.side,
      orderKind: segment.orderKind,
      crmBusiness: segment.crmBusiness,
      totalAmount: segmentRecords.reduce((sum, item) => sum + Number(item.amount || 0), 0),
      rowCount: segmentRecords.reduce((sum, item) => sum + Number(item.rowCount || 0), 0),
    };
  });
  const output = {
    syncedAt: new Date().toISOString(),
    range: {
      start: days[0],
      end: days.at(-1),
      timeField: "createTime",
      payTime: "empty",
      sourceField: "totalPriceString",
    },
    records,
    source,
  };
  await fs.mkdir(REPORT_DIR, { recursive: true });
  const reportPath = path.join(REPORT_DIR, `crm-revenue-sync-${args.month}-${stamp()}.json`);
  await fs.writeFile(reportPath, JSON.stringify(output, null, 2), "utf8");
  let backupPath = "";
  if (!args.dryRun) {
    backupPath = await backupExisting();
    await fs.writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2), "utf8");
  }
  console.log(JSON.stringify({
    ok: true,
    dryRun: args.dryRun,
    month: args.month,
    range: output.range,
    source,
    reportPath,
    backupPath,
    outputPath: args.dryRun ? "" : OUTPUT_PATH,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
