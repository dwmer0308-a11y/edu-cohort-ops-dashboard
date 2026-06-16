# AGENTS.md

This file is the operating guide for Codex or any coding agent working in this repository.

## Project Goal

Build a local/LAN operating dashboard for cohort-based education businesses. The current v2 direction upgrades the original calligraphy dashboard into a broader operating system focused first on `书画/书法 + 朗诵`.

The system should help business owners answer:

- Are today and this month on track against revenue targets?
- Which SKU, campaign cohort, business segment, or channel is behind target?
- What are target, actual, gap, pace, and achievement rate?
- How do front-end and back-end businesses perform separately?
- Which data is stable, which is cached, and which still needs verification?

## Current Product Scope

Phase 1 includes only:

- `书画/书法`
- `朗诵`

Phase 1 core pages:

- 经营总览
- SKU 作战室
- 数据资产状态

Existing legacy pages may remain available:

- 总览
- 计划中心
- 营收日历
- 投放分析
- 营期监控
- 配置中心

Do not expand to all SKUs unless the user explicitly approves that scope.

## Product Principle

The v2 design principle is:

```text
数据是主视觉，分析是副视觉。
```

For overview and planning surfaces, prioritize:

- Revenue target
- Actual revenue
- Gap
- Time progress
- Achievement rate
- SKU split
- Front-end/back-end split
- Data freshness and confidence

Avoid decorative redesigns that do not improve business judgment.

## Tech Stack

- Backend: Python 3, `http.server`, local JSON files, `openpyxl`
- Frontend: vanilla HTML/CSS/JavaScript
- Local service port: `8765`
- Main server file: `server.py`
- Frontend files: `public/index.html`, `public/app.js`, `public/styles.css`
- Project docs: `项目档案/`
- Optional scripts: `scripts/`

## Data Sources and Caches

Important local caches:

- `data/config.json`: local configuration and planning data
- `data/revenue-targets.json`: Feishu revenue target cache
- `data/revenue-actuals.json`: CRM actual revenue cache
- `data/operation-log.jsonl`: local operation log

These files may contain real business data. Treat them as local-only unless a sanitized sample is created.

Known business segments:

- 书法前端
- 书法后端
- 朗诵后端

Known SKU mapping issue:

- Some order sources use `书画`
- Some cost sources use `书法`
- This mapping belongs in SKU master data, not scattered page logic.

## Security and Commit Rules

Never commit:

- `.local/`
- Browser storage state
- Feishu app secrets or webhook config
- CRM credentials or login state
- Runtime logs
- Raw CRM exports
- Real revenue caches
- Local backup snapshots
- Generated exports with real business data

Before staging, inspect:

```bash
git status --short
git diff --stat
git diff --cached --stat
```

Do not use `git add .` on this project until the sensitive-data cleanup is complete. Stage explicit paths instead.

## Service Diagnosis

When the user says the local dashboard cannot open or cannot log in, first check service state before changing app logic:

```bash
lsof -nP -iTCP:8765 -sTCP:LISTEN
curl -s http://127.0.0.1:8765/api/health
```

If launchd service state matters, inspect the dashboard launch agents before assuming a frontend bug.

## Development Guidelines

- Keep changes small and scoped.
- Read existing project docs before changing business structure.
- Preserve the legacy dashboard unless the user approves replacement.
- Prefer adding v2 surfaces beside the old system during transition.
- Use cached/sample data for prototypes unless the user asks to refresh live sources.
- When changing revenue logic, verify target source, actual source, sync timestamp, and metric definitions.
- For UI work, keep the interface dense, operational, and scan-friendly.
- Do not introduce a heavy framework unless the user approves a broader rewrite.

## Recommended First GitHub Cleanup

This repository already has local history. Before pushing to GitHub, remove local-only tracked files from the Git index while keeping them on disk:

```bash
git rm --cached -r data/backups data/integration-checks exports
git rm --cached data/config.json data/operation-log.jsonl data/revenue-actuals.json data/revenue-targets.json
git rm --cached -- '*.log' '*.err.log'
```

Review the staged removals carefully before committing.

If any sensitive data was committed in previous local commits and the GitHub repository will be public, create a fresh clean repository history instead of pushing the current history.
