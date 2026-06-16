# edu-cohort-ops-dashboard

营期制教育业务经营看板。当前项目从“书法项目管理看板”升级而来，一期聚焦 `书画/书法 + 朗诵`，用于跟踪营收目标、实际达成、营期健康、渠道/销售/课程交付表现，并逐步沉淀可复盘的数据资产。

## Current Scope

一期优先回答：

- 本月/今日营收目标是否达成
- 哪个业务线、SKU、营期落后于目标
- 目标、实际、差额和时间进度分别是多少
- 前端和后端业务分别表现如何
- 哪些数据已经可靠，哪些还只是临时缓存或样本

一期只展开：

- 书画/书法
- 朗诵

暂不展开：

- 全 SKU 页面
- 复杂权限系统
- 全自动 Loop 实现
- 全部课程视频复盘
- 大规模推倒重构

## Tech Stack

- Python 3 local HTTP service
- `openpyxl` for workbook parsing and export
- Vanilla HTML/CSS/JavaScript frontend
- Local JSON caches for configuration, revenue targets, and revenue actuals
- Optional Node.js scripts for CRM and Feishu workflows

## Run Locally

Install the Python dependency if needed:

```bash
pip3 install openpyxl
```

Start the local service:

```bash
python3 server.py
```

Open:

```text
http://127.0.0.1:8765
```

Health check:

```text
http://127.0.0.1:8765/api/health
```

## Project Structure

```text
server.py                  # Local HTTP service, API routes, imports, exports
public/index.html          # Page structure
public/app.js              # Frontend business logic and rendering
public/styles.css          # UI styles
scripts/                   # CRM, Feishu, export, and service helper scripts
templates/                 # Workbook templates
data/integration-sources.example.json
项目档案/                  # Planning, context, and project handoff docs
```

## Sensitive Local Files

Do not commit real credentials, browser sessions, logs, CRM exports, Feishu config, or real business caches.

Important local-only paths:

```text
.local/
data/config.json
data/revenue-actuals.json
data/revenue-targets.json
data/operation-log.jsonl
data/backups/
data/integration-checks/
exports/
*.log
*.err.log
```

Use example files or deliberately anonymized fixtures when sharing project state.

## AI Collaboration

The shared project context lives in:

```text
AGENTS.md
项目档案/ChatGPT同步物料.md
项目档案/v2项目推进导航.md
项目档案/营期制教育业务经营系统规划.md
```

The working principle for v2 is:

```text
数据是主视觉，分析是副视觉。
```

Before changing business logic, read the project docs and confirm the data source, metric definition, and affected page.
