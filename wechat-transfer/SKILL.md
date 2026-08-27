---
name: wechat-transfer
description: 微信支付商家转账 APIv3（/v3/fund-app/mch-transfer）接入。当要转账到用户微信零钱、发起或撤销转账单、查询转账单状态、处理 MCHTRANSFER 回调，或接入免确认收款授权（user-confirm-authorization、authorization_id）时使用。
metadata:
  version: "1.0.0"
---

# 微信支付商家转账

商户把资金转入微信用户零钱。全部接口位于 `https://api.mch.weixin.qq.com`（异地备用域名 `api2.mch.weixin.qq.com`），走 APIv3 签名认证。每个接口的完整参数表、错误码、应答示例在 `references/` 下，按「选接口」表取用。

## 换单号会重复转账

这是本接口族唯一会造成真实资金损失的操作，写任何重试逻辑之前先读完这一节。

`out_bill_no` 是转账的幂等键。同一个 `out_bill_no` 重发是**原单重试**，安全；换一个 `out_bill_no` 重发是**新的一笔转账**，钱会真的再付一次。

发起转账的 HTTP 状态码非 200 时（包括没见过的错误码、超时、连接失败）：

1. 不要换单号，也不要直接判定为失败。
2. 用原 `out_bill_no` 调查单接口确认真实状态。
3. 查到**明确 FAIL** 才允许换 `out_bill_no` 重发。
4. 查到非终态就用**原单**重试或继续等待。

`ALREADY_EXISTS`、`ORDER_CLOSED` 说明该单号已到终态，同样先查单确认结果，不要换号重发。

## 选接口

路径省略前缀 `/v3/fund-app/mch-transfer`。

| 要做的事 | 方法与路径 | 参考 |
| --- | --- | --- |
| 转账，由用户手动确认收款（默认模式） | POST `/transfer-bills` | [发起转账](references/发起转账.md) |
| 转账，并在用户确认收款时顺带申请免确认授权 | POST `/transfer-bills/pre-transfer-with-authorization` | [发起转账并完成免确认收款授权](references/发起转账并完成免确认收款授权.md) |
| 给已授权用户转账，无需用户确认 | POST `/transfer-bills/transfer` | [用户授权后转账](references/用户授权后转账.md) |
| 用户确认收款前撤销转账 | POST `/transfer-bills/out-bill-no/{out_bill_no}/cancel` | [撤销转账](references/撤销转账.md) |
| 按商户单号查转账单 | GET `/transfer-bills/out-bill-no/{out_bill_no}` | [商户单号查询转账单](references/商户单号查询转账单.md) |
| 按微信单号查转账单 | GET `/transfer-bills/transfer-bill-no/{transfer_bill_no}` | [微信单号查询转账单](references/微信单号查询转账单.md) |
| 单独发起免确认收款授权 | POST `/user-confirm-authorization` | [发起免确认收款授权](references/发起免确认收款授权.md) |
| 查授权结果 | GET `/user-confirm-authorization/out-authorization-no/{no}` | [商户单号查询授权结果](references/商户单号查询授权结果.md) |
| 解除授权 | POST `/user-confirm-authorization/out-authorization-no/{no}/close` | [解除免确认收款授权](references/解除免确认收款授权.md) |
| 接收转账终态回调 `MCHTRANSFER.BILL.FINISHED` | 商户自建 `notify_url` | [商家转账回调通知](references/商家转账回调通知.md) |
| 接收授权变更回调 `MCHTRANSFER.AUTHORIZATION.CONFIRMED` / `.CLOSED` | 商户自建 `authorization_notify_url` | [免确认收款授权结果通知](references/免确认收款授权结果通知.md) |

## 状态机

终态只有三个：`SUCCESS`、`FAIL`、`CANCELLED`。其余（`ACCEPTED`、`PROCESSING`、`WAIT_USER_CONFIRM`、`TRANSFERING`、`CANCELING`）都是非终态，可以原单重试。

- `PROCESSING` 长期不动 → 检查出资商户余额，充值后原单重试。
- `WAIT_USER_CONFIRM` → 用应答里的 `package_info` 拉起 JSAPI / APP 收款确认页。单据创建后 **24 小时**内用户不领取即过期关闭。重新拉起前先查单：仍是 `WAIT_USER_CONFIRM` 就复用旧 `package_info`；已到终态必须换单号重新发起转账。
- 撤销只在用户确认收款**之前**有效，且撤销接口返回成功只代表受理，需查单确认最终落到 `CANCELLED`。
- 免确认转账（`/transfer-bills/transfer`）同步返回结果：HTTP 200 且 `state` 为 `SUCCESS` 才算成功。HTTP 200 但状态非成功属非预期结果，联系微信支付客服确认，不要自行换单重试。
- 查单接口只覆盖最近 30 天的转账单，更早的单据走[申请资金账单](https://pay.weixin.qq.com/doc/v3/merchant/4013071235.md)。

## 每次请求都要做对的事

- **金额单位是分**，`transfer_amount` 为 integer。
- `out_bill_no`、`out_authorization_no` 只能由数字和大小写字母组成，且在商户系统内唯一。
- `user_name`（收款人真实姓名）**必须用微信支付公钥加密**后传入，并在 `Wechatpay-Serial` 头带上公钥 ID（或平台证书序列号）。**转账金额 ≥ 2000 元（200000 分）时该字段必填**；查单返回的 `user_name` 需用商户 API 证书私钥解密。
- `transfer_scene_id` 要先在「商户平台-产品中心-商家转账」申请开通；`transfer_scene_report_infos[].info_type` 是各场景下的固定值，按[转账场景报备信息字段说明](https://pay.weixin.qq.com/doc/v3/merchant/4013774588.md)填，不能自拟。
- `notify_url`、`authorization_notify_url` 必须是 HTTPS、公网可达、不带查询参数。
- 限频：转账与查单 100 QPS，授权类接口 50 QPS。`FREQUENCY_LIMIT`、`FREQUENCY_LIMIT_EXCEED`、`RATELIMIT_EXCEEDED` 都表示本次结果不明确 —— 降速后用**相同参数**重试。
- 错误码的 `message` 只供人工定位问题，自动化分支一律按 `code` 判断。

## 免确认收款授权

先授权、后转账，转账时用户无需再确认收款。

- 拿到授权有两条路：单独发起授权（`/user-confirm-authorization`），或在一次普通转账里顺带授权（`/transfer-bills/pre-transfer-with-authorization`）。后者只在用户收款成功**且**同意授权时才产生授权，否则查授权结果返回 `NOT_FOUND`。
- 授权成功后**长期有效**，直到用户或商户主动解除。商户系统必须持久化 `out_authorization_no` 和 `authorization_id` —— 丢失后无法再向该用户免确认转账。
- 授权申请有效期 **24 小时**，过期需换 `out_authorization_no` 重新发起。用户未确认的授权记录保留 30 天，超期后原单号可再次使用，再往后查询返回 `NOT_FOUND`。
- 同一微信号在同一商户的同一转账场景下，处于 `WAIT_USER_CONFIRM` 和 `TAKING_EFFECT` 的授权单合计最多 **5 个**。
- 转账时 `authorization_id` 与 `out_authorization_no` 二选一必填，且不传 `openid` —— 收款人由授权决定。
- 授权状态：`WAIT_USER_CONFIRM`（待确认）、`TAKING_EFFECT`（生效中，可转账）、`CLOSED`（已关闭，`close_info.close_reason` 区分商户关闭 / 用户关闭 / 超时未确认）。

## 回调

两类回调（转账终态、授权变更）的处理流程一致：

1. **验签**：用请求头 `Wechatpay-Timestamp`、`Wechatpay-Nonce` 与原始请求体构造验签串，按 `Wechatpay-Serial` 选证书 —— 序列号形如 `PUB_KEY_ID_数字串` 用微信支付公钥，否则用平台证书。微信会发送 `Wechatpay-Signature` 以 `WECHATPAY/SIGNTEST/` 开头的探测流量来检验商户是否真的验签，对它验签会失败，此时必须按验签失败应答，不能放行。
2. **应答**：5 秒内应答。验签通过返回 200 或 204、空包体；验签不通过返回 4XX 或 5XX 加 `{"code":"FAIL","message":"..."}`。**先应答，再异步处理业务**，避免业务耗时导致应答超时。
3. **解密**：`resource.ciphertext` 用 AEAD_AES_256_GCM 加密，以 APIv3 密钥配合 `resource.nonce`、`resource.associated_data` 解密得到业务 JSON。
4. **幂等**：同一通知会重复投递。先加锁，再检查业务数据状态：未处理则处理，已处理直接返回成功。
5. **不要只依赖回调**：重试策略为 0s / 15s×3 / 300s×3 / 1800s×3 / 1h×22，且微信不保证最终送达。必须有主动查单兜底，并校验回调内容与商户侧数据一致，防止假通知。
