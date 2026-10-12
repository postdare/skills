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

本地开发可把单个技能链接到全局目录，让安装与维护共用源文件。将 `SKILLS_SOURCE` 设为本仓库的绝对路径，保留已有 `~/.agents/skills` 内容；目标链接已存在时先检查其指向，不覆盖：

```bash
mkdir -p "$HOME/.agents/skills"
ln -s "$SKILLS_SOURCE/draw-diagram" "$HOME/.agents/skills/draw-diagram"
```

项目适配可用 `@` 引用全局 `draw-diagram/SKILL.md`，同时明确要求先读取该文件；引用标记不保证自动加载。

新增链接后，若当前会话的技能列表未刷新，重新加载技能或开启新会话；也可直接引用全局路径的 `SKILL.md` 并明确要求读取。

## 技能

| 技能 | 用途 | 触发方式 |
| --- | --- | --- |
| [linear](linear/) | 用 GraphQL + curl 管理 Linear 的 issue、project、team | 自动，需 `LINEAR_API_KEY` |
| [draw-diagram](draw-diagram/) | 流程、循环、分组与状态图解，交付 SVG、预览和截图证据；[Demo](draw-diagram/demo/) | 自动 |
| [slow-think](slow-think/) | 派独立审查者对已有代码、方案或结论做对抗性复核 | 手动 `/slow-think` |
| [unravel](unravel/) | 只读审查某个功能是否过度设计，不改动代码 | 自动 |
| [wechat-transfer](wechat-transfer/) | 微信支付商家转账 APIv3：转账单、免确认收款授权、回调 | 自动 |
