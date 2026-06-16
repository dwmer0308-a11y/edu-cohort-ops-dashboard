#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const DEFAULT_CONFIG = path.join(ROOT, ".local", "feishu-notify.json");
const DEFAULT_REVENUE_SHEET_TOKEN = "SVa6s6c31hztbRt0XE0cjxkCnih";

function parseArgs(argv) {
  const args = {
    config: DEFAULT_CONFIG,
    sheetToken: DEFAULT_REVENUE_SHEET_TOKEN,
    folderToken: "",
    docxToken: "",
    bitableToken: "",
    wikiToken: "",
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const readValue = () => argv[++index] || "";
    if (arg === "--config") args.config = readValue();
    else if (arg.startsWith("--config=")) args.config = arg.slice("--config=".length);
    else if (arg === "--sheet-token") args.sheetToken = extractToken(readValue());
    else if (arg.startsWith("--sheet-token=")) args.sheetToken = extractToken(arg.slice("--sheet-token=".length));
    else if (arg === "--folder-token" || arg === "--folder-url") args.folderToken = extractToken(readValue());
    else if (arg.startsWith("--folder-token=") || arg.startsWith("--folder-url=")) args.folderToken = extractToken(arg.split("=").slice(1).join("="));
    else if (arg === "--docx-token" || arg === "--docx-url") args.docxToken = extractToken(readValue());
    else if (arg.startsWith("--docx-token=") || arg.startsWith("--docx-url=")) args.docxToken = extractToken(arg.split("=").slice(1).join("="));
    else if (arg === "--bitable-token" || arg === "--bitable-url") args.bitableToken = extractToken(readValue());
    else if (arg.startsWith("--bitable-token=") || arg.startsWith("--bitable-url=")) args.bitableToken = extractToken(arg.split("=").slice(1).join("="));
    else if (arg === "--wiki-token" || arg === "--wiki-url") args.wikiToken = extractWikiNodeToken(readValue());
    else if (arg.startsWith("--wiki-token=") || arg.startsWith("--wiki-url=")) args.wikiToken = extractWikiNodeToken(arg.split("=").slice(1).join("="));
    else if (arg === "--help" || arg === "-h") args.help = true;
  }
  return args;
}

function printHelp() {
  console.log(`
Feishu permission check

Usage:
  node scripts/feishu_permission_check.mjs
  node scripts/feishu_permission_check.mjs --folder-url "https://..."
  node scripts/feishu_permission_check.mjs --docx-url "https://..."
  node scripts/feishu_permission_check.mjs --bitable-url "https://..."

The script reads .local/feishu-notify.json and never prints app_secret.
`);
}

function extractToken(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    const parts = url.pathname.split("/").filter(Boolean);
    return parts[parts.length - 1] || text;
  } catch {
    return text;
  }
}

function extractWikiNodeToken(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  try {
    const url = new URL(text);
    const parts = url.pathname.split("/").filter(Boolean);
    const wikiIndex = parts.indexOf("wiki");
    if (wikiIndex >= 0 && parts[wikiIndex + 1]) return parts[wikiIndex + 1];
    return parts[parts.length - 1] || text;
  } catch {
    return text;
  }
}

function mask(value) {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= 10) return `${text.slice(0, 2)}...`;
  return `${text.slice(0, 6)}...${text.slice(-4)}`;
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }
  payload._httpStatus = response.status;
  return payload;
}

async function tenantAccessToken(config) {
  return requestJson("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal", {
    method: "POST",
    body: JSON.stringify({ app_id: config.app_id, app_secret: config.app_secret }),
  });
}

function summarize(payload) {
  return {
    http: payload?._httpStatus,
    code: payload?.code,
    msg: payload?.msg || "",
    request_id: payload?.request_id || "",
  };
}

function statusFrom(payload, predicate = () => true) {
  if (!payload) return "FAIL";
  if (payload._httpStatus >= 200 && payload._httpStatus < 300 && payload.code === 0 && predicate(payload)) return "OK";
  if (payload.code === 99991672 || payload.code === 99991663 || /permission|scope|权限|forbidden/i.test(payload.msg || "")) return "NO_PERMISSION";
  if (/not found|不存在|无访问权限/i.test(payload.msg || "")) return "NO_ACCESS_OR_NOT_FOUND";
  return "FAIL";
}

async function runCheck(name, fn, predicate) {
  try {
    const payload = await fn();
    return { name, status: statusFrom(payload, predicate), ...summarize(payload) };
  } catch (error) {
    return { name, status: "ERROR", error: error.message || String(error) };
  }
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }

  const config = await readJson(args.config);
  const configSummary = {
    mode: config.mode || "app",
    app_id: mask(config.app_id),
    has_app_secret: Boolean(config.app_secret),
    receive_id_type: config.receive_id_type || "",
    has_receive_id: Boolean(config.receive_id),
  };

  const tokenPayload = await tenantAccessToken(config);
  const checks = [
    { name: "auth.tenant_access_token", status: statusFrom(tokenPayload, (payload) => Boolean(payload.tenant_access_token)), ...summarize(tokenPayload) },
  ];
  const token = tokenPayload.tenant_access_token;

  if (token) {
    const auth = { Authorization: `Bearer ${token}` };
    checks.push(await runCheck(
      "sheets.query_known_revenue_spreadsheet",
      () => requestJson(`https://open.feishu.cn/open-apis/sheets/v3/spreadsheets/${encodeURIComponent(args.sheetToken)}/sheets/query`, { headers: auth }),
      (payload) => Array.isArray(payload.data?.sheets),
    ));
    checks.push(await runCheck(
      "drive.root_folder_meta",
      () => requestJson("https://open.feishu.cn/open-apis/drive/explorer/v2/root_folder/meta", { headers: auth }),
      (payload) => Boolean(payload.data),
    ));
    checks.push(await runCheck(
      "wiki.list_spaces",
      () => requestJson("https://open.feishu.cn/open-apis/wiki/v2/spaces?page_size=1", { headers: auth }),
      (payload) => Array.isArray(payload.data?.items),
    ));

    if (args.folderToken) {
      checks.push(await runCheck(
        "drive.list_folder_files",
        () => requestJson(`https://open.feishu.cn/open-apis/drive/v1/files?folder_token=${encodeURIComponent(args.folderToken)}&page_size=10`, { headers: auth }),
        (payload) => Array.isArray(payload.data?.files),
      ));
    } else {
      checks.push({ name: "drive.list_folder_files", status: "SKIPPED", reason: "未提供 --folder-url 或 --folder-token，无法验证指定文件夹访问。" });
    }

    if (args.docxToken) {
      checks.push(await runCheck(
        "docx.list_blocks",
        () => requestJson(`https://open.feishu.cn/open-apis/docx/v1/documents/${encodeURIComponent(args.docxToken)}/blocks?page_size=20`, { headers: auth }),
        (payload) => Array.isArray(payload.data?.items),
      ));
    } else {
      checks.push({ name: "docx.list_blocks", status: "SKIPPED", reason: "未提供 --docx-url 或 --docx-token，无法验证文档正文读取。" });
    }

    if (args.bitableToken) {
      checks.push(await runCheck(
        "bitable.list_tables",
        () => requestJson(`https://open.feishu.cn/open-apis/bitable/v1/apps/${encodeURIComponent(args.bitableToken)}/tables?page_size=20`, { headers: auth }),
        (payload) => Array.isArray(payload.data?.items),
      ));
    } else {
      checks.push({ name: "bitable.list_tables", status: "SKIPPED", reason: "未提供 --bitable-url 或 --bitable-token，无法验证多维表格读取。" });
    }

    if (args.wikiToken) {
      checks.push(await runCheck(
        "wiki.get_node",
        () => requestJson(`https://open.feishu.cn/open-apis/wiki/v2/spaces/get_node?token=${encodeURIComponent(args.wikiToken)}`, { headers: auth }),
        (payload) => Boolean(payload.data?.node),
      ));
    } else {
      checks.push({ name: "wiki.get_node", status: "SKIPPED", reason: "未提供 --wiki-url 或 --wiki-token，无法验证指定知识库节点访问。" });
    }
  }

  console.log(JSON.stringify({ config: configSummary, checks }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
