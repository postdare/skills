# skills

Postdare 的 agent skills 集合。用 [`skills`](https://github.com/vercel-labs/skills) CLI 安装到 Claude Code 等 agent。

## 安装

```bash
# 安装单个
npx skills add postdare/skills --skill wechat-transfer

# 全部安装
npx skills add postdare/skills --skill '*'

# 加 --global 装到用户级；不加则装到当前项目
npx skills add postdare/skills --skill unravel --global
```

`npx skills list` 查看已安装，`npx skills update <name>` 更新，`npx skills remove <name>` 卸载。

## 技能

| 技能 | 用途 | 触发方式 |
| --- | --- | --- |
| [linear](linear/) | 用 GraphQL + curl 管理 Linear 的 issue、project、team | 自动，需 `LINEAR_API_KEY` |
| [slow-think](slow-think/) | 派独立审查者对已有代码、方案或结论做对抗性复核 | 手动 `/slow-think` |
| [unravel](unravel/) | 只读审查某个功能是否过度设计，不改动代码 | 自动 |
| [wechat-transfer](wechat-transfer/) | 微信支付商家转账 APIv3：转账单、免确认收款授权、回调 | 自动 |
