#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const DEFAULT_CONFIG = path.join(ROOT, ".local", "feishu-notify.json");

function parseArgs(argv) {
  const args = {
    config: DEFAULT_CONFIG,
    message: "CRM 登录过期提醒测试：如果你看到这条消息，说明飞书机器人通知已经配置成功。",
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") args.help = true;
    else if (arg === "--config") args.config = argv[++index];
    else if (arg.startsWith("--config=")) args.config = arg.slice("--config=".length);
    else if (arg === "--message") args.message = argv[++index];
    else if (arg.startsWith("--message=")) args.message = arg.slice("--message=".length);
  }
  return args;
}

function printHelp() {
  console.log(`
Feishu notification test

Usage:
  node scripts/feishu_notify_test.mjs
  node scripts/feishu_notify_test.mjs --message "CRM 登录已过期，请重新登录"

Default config file:
  .local/feishu-notify.json

Config for a custom Feishu app:
  {
    "mode": "app",
    "app_id": "cli_xxx",
    "app_secret": "xxx",
    "receive_id_type": "email",
    "receive_id": "your-email@example.com"
  }

Config for a group webhook:
  {
    "mode": "webhook",
    "webhook_url": "https://open.feishu.cn/open-apis/bot/v2/hook/xxx"
  }
`);
}

async function readJson(filePath) {
  const text = await fs.readFile(filePath, "utf8");
  return JSON.parse(text);
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
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text}`);
  }
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

async function sendAppMessage(config, message) {
  const token = await tenantAccessToken(config);
  const receiveIdType = config.receive_id_type || "email";
  const receiveId = config.receive_id;
  if (!receiveId) throw new Error("缺少 receive_id。请在 .local/feishu-notify.json 里填写你的邮箱、open_id 或 chat_id。");
  const payload = await postJson(
    `https://open.feishu.cn/open-apis/im/v1/messages?receive_id_type=${encodeURIComponent(receiveIdType)}`,
    {
      receive_id: receiveId,
      msg_type: "text",
      content: JSON.stringify({ text: message }),
    },
    { Authorization: `Bearer ${token}` },
  );
  if (payload.code !== 0) {
    throw new Error(`发送飞书应用消息失败：${payload.code} ${payload.msg || ""}`.trim());
  }
  return payload;
}

async function sendWebhookMessage(config, message) {
  if (!config.webhook_url) throw new Error("缺少 webhook_url。");
  const payload = await postJson(config.webhook_url, {
    msg_type: "text",
    content: { text: message },
  });
  if (payload.code && payload.code !== 0) {
    throw new Error(`发送飞书群机器人消息失败：${payload.code} ${payload.msg || ""}`.trim());
  }
  return payload;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) {
    printHelp();
    return;
  }
  const config = await readJson(args.config);
  const mode = config.mode || "app";
  const payload = mode === "webhook"
    ? await sendWebhookMessage(config, args.message)
    : await sendAppMessage(config, args.message);
  console.log("飞书通知发送成功。");
  console.log(JSON.stringify({
    mode,
    receive_id_type: config.receive_id_type,
    code: payload.code ?? 0,
    msg: payload.msg || "ok",
    message_id: payload.data?.message_id || "",
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

