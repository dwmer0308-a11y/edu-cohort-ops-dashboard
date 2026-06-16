# GitHub 首版提交清单

生成日期：2026-06-16

## 当前判断

这个项目已经是一个真实 Git 仓库，不是全新的空目录。当前本地分支是 `main`，已有本地提交历史，但还没有配置远程仓库。

因此，GitHub 第一步不应该直接 `git add .` 或直接 push，而应该先清理首版仓库边界。

## 推荐仓库名

```text
edu-cohort-ops-dashboard
```

理由：

- 能覆盖教育业务，不局限于书法。
- 能表达“营期/cohort”这个核心经营对象。
- 能表达经营系统，而不是单纯展示页面。
- 未来接入朗诵和更多 SKU 时仍然合理。

## 适合提交的文件

首版可以提交：

```text
.gitignore
README.md
AGENTS.md
server.py
public/
scripts/
templates/
data/integration-sources.example.json
README-本地体验.md
README-局域网发布.md
CRM营收抓取校验说明.md
飞书机器人通知配置说明.md
已发生营期导入字段说明.md
已发生营期导入模板.csv
已发生营期导入模板.json
项目档案/
*.command
inspect_*.py
inspect_workbook.mjs
focused_extract.py
```

提交前需要人工复核：

- `scripts/` 里是否写死内部域名、账号、业务 token。
- `*.command` 里是否写死本机路径、用户名或敏感配置。
- 中文文档里是否包含不能公开的 CRM/飞书链接、密钥、个人账号。

## 不建议提交的文件

这些应该留在本地：

```text
.local/
data/config.json
data/operation-log.jsonl
data/revenue-actuals.json
data/revenue-targets.json
data/backups/
data/integration-checks/normalized/
data/integration-checks/raw/
data/integration-checks/reports/
exports/
*.log
*.err.log
*.zip
```

原因：

- 可能包含真实营收、订单、CRM、飞书目标数据。
- 可能包含本地运行日志和登录状态。
- 备份和导出文件会让仓库膨胀，也不适合作为项目事实源。

## 当前已发现的风险

当前 Git 跟踪列表里已经包含了不少本地数据文件，包括：

- `data/backups/`
- `data/integration-checks/normalized/`
- `data/integration-checks/reports/`
- `data/config.json`
- `data/revenue-actuals.json`
- `data/revenue-targets.json`
- `exports/`
- `*.log`
- `*.err.log`

`.gitignore` 只能阻止未来新增文件，不能自动取消这些已跟踪文件。

## 推荐清理命令

如果要保留当前 Git 历史，并从下一次提交开始清理索引，可以使用：

```bash
git rm --cached -r data/backups data/integration-checks exports
git rm --cached data/config.json data/operation-log.jsonl data/revenue-actuals.json data/revenue-targets.json
git rm --cached -- '*.log' '*.err.log'
```

这些命令只会从 Git 索引移除文件，不会删除本地文件。

执行后检查：

```bash
git status --short
git diff --cached --stat
```

确认无误后再提交：

```bash
git add .gitignore README.md AGENTS.md 项目档案/GitHub首版提交清单.md 项目档案/ChatGPT同步物料.md
git commit -m "chore: prepare repository for GitHub collaboration"
```

## 如果仓库要公开

如果 GitHub 仓库会设为 public，建议不要直接推送当前本地历史。

更稳妥的方式：

1. 新建一个干净目录。
2. 只复制适合公开的代码和文档。
3. 不复制真实数据、日志、缓存、导出、备份。
4. 在新目录 `git init`。
5. 首次提交干净版本。

这样可以避免历史提交里曾经出现过真实业务数据。

## 如果仓库设为 private

如果仓库是 private，可以保留当前历史，但仍建议先做索引清理。

Private 不等于可以提交密钥或登录态：

- `.local/` 必须继续排除。
- CRM 登录态不能提交。
- 飞书 app secret 不能提交。
- 真实客户/订单明细尽量不要提交。

## 建议下一步

1. 用户创建 GitHub 空仓库：`edu-cohort-ops-dashboard`。
2. 决定仓库是 public 还是 private。
3. 如果 private：在当前仓库清理索引后绑定 remote 并 push。
4. 如果 public：建议创建干净历史再 push。
