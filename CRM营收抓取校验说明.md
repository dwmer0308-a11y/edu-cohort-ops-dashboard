# CRM营收抓取校验说明

这个步骤只用于确认 CRM 数据能不能稳定抓出来，不会改看板，也不会保存你的密码。

## 第一次怎么做

1. 把 CRM 登录网址准备好。
2. 在项目目录打开终端，运行：

```bash
node scripts/crm_revenue_check.mjs --url "这里换成CRM登录网址" --month 2026-06
```

3. 程序会打开一个浏览器窗口。
4. 你在浏览器里自己输入账号、密码、验证码或手机二次验证。
5. 登录成功后，进入 CRM 的营收、订单、回款、销售明细这一类页面。
6. 回到终端按 Enter。
7. 程序会生成抽样报告，路径在 `data/integration-checks/reports/`。

如果已经登录过，后续可以直接复用本机登录态抓取：

```bash
node scripts/crm_revenue_check.mjs --url "https://kkhc-admin.likeduoduiyi.cn/#/order" --month 2026-06 --capture-now --wait-ms 8000
```

## 你需要核对什么

打开最新的 `data/integration-checks/reports/crm-*.md`，看“你需要核对的样例”：

- 日期是否和 CRM 页面一致。
- 营期、项目、订单或客户信息是否对应。
- 金额是否正确。
- 状态是否正确。

如果报告里显示“未识别到日期和金额”，通常说明还没有进入明细表页面，或者 CRM 页面不是普通表格，需要改成抓网络接口。

## 本地会保存什么

- `.local/crm-browser-profile/`：浏览器登录态，让下次不用重复登录。
- `.local/crm-storage-state.json`：本机登录状态。
- `data/integration-checks/raw/`：少量脱敏页面样例。
- `data/integration-checks/normalized/`：标准化 JSON/CSV。
- `data/integration-checks/reports/`：人工抽样报告。

`.local/` 和原始样例目录已经加入 `.gitignore`，不要发给别人。
