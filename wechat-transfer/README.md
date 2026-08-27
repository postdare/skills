# wechat-transfer

微信支付商家转账 APIv3（`/v3/fund-app/mch-transfer`）接入技能。把「转账到零钱」「免确认收款授权」「回调处理」的官方文档，整理成 agent 可直接取用的接口索引和避坑规则。

## 安装

```bash
# 装到当前项目
npx skills add postdare/skills --skill wechat-transfer

# 装到全局（用户级，所有项目可用）
npx skills add postdare/skills --skill wechat-transfer --global
```

其他命令：`npx skills list` 查看已安装技能，`npx skills update wechat-transfer` 更新，`npx skills remove wechat-transfer` 卸载。

## 使用

安装后由 agent 自动触发，需求涉及以下内容时会被调用：

- 转账到微信用户零钱，发起、撤销或查询转账单
- 处理 `MCHTRANSFER.BILL.FINISHED`、`MCHTRANSFER.AUTHORIZATION.*` 回调
- 接入免确认收款授权（`user-confirm-authorization`、`authorization_id`）

也可以直接说「用 wechat-transfer 技能……」。

## 结构

| 文件 | 内容 |
| --- | --- |
| `SKILL.md` | 接口索引、资金安全规则、状态机、回调流程 |
| `references/` | 11 份接口原始文档：参数表、错误码、应答示例 |

文档来源：[微信支付商家转账](https://pay.weixin.qq.com/doc/v3/merchant/4012711988.md)。`references/` 各文件首行标注了对应官方文档的更新时间。
