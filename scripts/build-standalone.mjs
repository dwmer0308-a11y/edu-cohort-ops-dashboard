import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const htmlPath = resolve(root, "public/index.html");
const cssPath = resolve(root, "public/styles.css");
const jsPath = resolve(root, "public/app.js");
const configPath = resolve(root, "data/config.json");
const outputPath = resolve(root, "营期转化监控看板-双击体验版.html");

const [html, css, js, config] = await Promise.all([
  readFile(htmlPath, "utf8"),
  readFile(cssPath, "utf8"),
  readFile(jsPath, "utf8"),
  readFile(configPath, "utf8"),
]);

const standalone = html
  .replace('<link rel="stylesheet" href="/styles.css" />', `<style>\n${css}\n</style>`)
  .replace('<script src="/app.js"></script>', `<script>\nwindow.DASHBOARD_STANDALONE = true;\nwindow.DASHBOARD_INITIAL_CONFIG = ${config};\n${js}\n</script>`)
  .replace("目标配置 + Excel 实际", "双击版 · 本地 JSON")
  .replace("选择排期&营收规划表后自动生成看板。", "双击版可配置目标、建期、导入/导出 JSON。")
  .replace("上传 Excel 后查看今日达成、异常营期和渠道表现。", "双击版可配置目标、R值和营期，并导入/导出 JSON。");

await writeFile(outputPath, standalone, "utf8");
console.log(outputPath);
