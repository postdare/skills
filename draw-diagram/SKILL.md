---
name: draw-diagram
description: 图解：绘制流程、时序（协议握手、OAuth2、请求/应答）、循环、分支、分组和状态关系图；修改已有图解；批量绘制多张图解。
---

# 图解

把关系画成可读的图：内容决定节点、方向和状态；标准时序由工具确定几何，其他图手工构图。本文件是通用流程、格式与验收的唯一依据；已有项目的集成约定由项目适配技能提供。

## 1. 锁定目标与语义

先选分支：
- **新画**：从用户要求与提供的文档提取内容，记录来源；资料缺失会影响结论时先查已有资料，仍不明确则报告具体疑点。
- **修改**：读取目标图、对应内容和已有样式，只改变用户要求的部分；未要求改变的节点、边、文字、状态和含义保持原样。
- **批量**：先读 [references/batch.md](references/batch.md)，按其中的目标分配与主验收安排执行本流程。

列出目标集：每张图的稳定 `id`、来源、期望读出的关系、允许改动的文件/帧、输出目录和展示场景。已有仓库优先沿用其输出位置与集成入口；独立任务使用下面的 JSON 工具链。只修改目标集内的内容及明确列出的集成文件；共享渲染能力不足时报告缺口，单独获得改动范围后处理。

为每帧建立独立的 `content`：所有主要节点的 `id/label/value/status` 与所有边的 `from/to/label/kind`。它是**语义真值**，不能从排好的图反推，也不能为通过检查而删改。新增图的推导与编辑图的差异都须能对照来源。

单帧任务把目标、来源和构图记在 `frame.note`，内容直接写入图稿；目标清楚即可进入构图，无需另建计划或说明文件。来源没有后续共同处理时，分支终点就表示结束；来源要求汇合、回流或共同步骤时完整保留，不为省时改变业务关系。

**完成门槛**：目标集和改动范围明确；每个目标都有完整内容、来源与展示场景；影响语义的疑点已解决或明确阻塞该目标。

## 2. 选构图、写图稿

### 阅读范围

- 标准时序：固定参与者、消息严格按时间顺序（如 OAuth2、协议握手、请求/应答）。只读本文件，使用下方「标准时序」；无需模板或参考。
- 简单图：单帧、主节点 ≤8 的直线链或主线加一个二分支。只读本文件，用下面骨架替换文字与关系；几何匹配时保留坐标、锚点、尺寸与走线，不再读模板或参考。
- 其他/高级构图：从 `assets/templates.js` 读取匹配的一个模板；手工/高级时序（激活条、Alt/Par、脚注、运行时创建对象、自定义几何）、泳道、嵌套容器、ER/类图、状态机、漏斗/矩阵、循环查 [references/layouts.md](references/layouts.md) 对应小节；骨架未覆盖的字段查 [references/frame-format.md](references/frame-format.md)。只读所需小节。
- [references/troubleshooting.md](references/troubleshooting.md) 仅检查报错且信息不足时读对应条目；[references/batch.md](references/batch.md) 仅批量任务读。
- 绘图只使用字段文档与检查输出。`assets/diagram.js`、`check.js`、`diagram.css` 是工具实现，仅排查工具本身故障才读。

### 标准时序

先对照来源锁定参与者与完整消息顺序，再写 `content.nodes`（数组顺序 = 从左到右的参与者列）和 `content.edges`（数组顺序 = 严格消息时间顺序）。节点用 `{id,label,value?,status?}`，边用 `{from,to,label?,kind?}`，端点为节点 id；`from == to` 表示自消息。请求默认 `flow`（实线实心），应答 `reply`（虚线开放），异步 `async`（实线开放），依来源区分，不把所有反向消息都当应答。需要编号时直接写入消息标签。

图稿只写 `"diagram": {"layout": "sequence"}`；工具自动计算画布、参与者框、生命线、消息间距、换行与自消息走线。**不手写 x/y、bend、at 或重复 boxes/arrows；默认不加图标、脚注、激活条或片段框。** 来源要求的登录/授权、重定向转交、检查和请求参数等必须保留在对应消息标签，或确有自消息时独立列出；不能为提速合并掉参与者、消息或协议步骤。

OAuth2 授权码 + PKCE（S256）还须核对协议事实：授权请求使用 `response_type=code`，发送 `code_challenge` 与 `code_challenge_method=S256`，不发送 `code_verifier`；令牌请求才发送 `code` 与 `code_verifier`。S256 的生成和服务端校验均是 `BASE64URL-ENCODE(SHA256(ASCII(code_verifier)))`，再与绑定授权码的 `code_challenge` 比较；只写 SHA256 比较是不完整的。[RFC 7636 §4.2/4.6](https://www.rfc-editor.org/rfc/rfc7636.html#section-4.2)

`state` 在客户端核对；授权服务器校验 PKCE 后才发令牌。以 HTTP 交互绘图时，授权服务器 302 是应答 `reply`，浏览器访问客户端回调是新请求 `flow`，不能因为携带返回参数而一律标成应答。公共客户端不假设持有 `client_secret`；只有来源明确使用 OIDC 才引入 `id_token`。参数可摘要，但不能给出错误等式或省略来源要求的登录、同意、回调转交等步骤。

```json
{
  "title": "请求与应答",
  "frames": [{
    "id": "request-sequence",
    "title": "请求与应答",
    "note": "来源：用户要求；固定参与者，消息自上而下。",
    "content": {
      "nodes": [{"id":"client","label":"客户端"},{"id":"server","label":"服务端"}],
      "edges": [
        {"from":"client","to":"server","label":"1 请求","kind":"flow"},
        {"from":"server","to":"client","label":"2 应答","kind":"reply"}
      ]
    },
    "diagram": {"layout":"sequence"}
  }]
}
```

完成后直接进入第 3 节，用同一条现有渲染命令；不为标准时序读取手工坐标骨架或构图基线。高级/自定义时序仍用参考中的手工生命线与箭头，不强行套自动模式。

每帧写一句「主要关系 + 采用的构图」。相邻状态帧保持同一概念的位置与颜色稳定，让变化本身可见。

### 最小骨架

下面是已验收的「纵向主线 + 二分支」坐标骨架，画布 720×560。先独立确定 `content`，再对应改 `boxes/arrows` 的 id、文字和业务状态。关系匹配时只替换文字与 id；短标签可保持全部几何。只有长文字或不同关系才改尺寸与走线。纯链使用左列、删去右侧判断和分支，并按剩余节点收紧画布；新增节点须扩大画布，不沿固定间距排出边界。

```json
{
  "title": "请求处理流程",
  "frames": [{
    "id": "request-flow",
    "title": "请求处理流程",
    "note": "左列依次处理，右列判断并分流；来源：用户要求。",
    "content": {
      "nodes": [
        { "id": "start", "label": "开始" },
        { "id": "receive", "label": "接收请求" },
        { "id": "validate", "label": "检查条件" },
        { "id": "process", "label": "执行操作" },
        { "id": "wait", "label": "等待结果" },
        { "id": "decision", "label": "处理成功？" },
        { "id": "success", "label": "完成" },
        { "id": "failure", "label": "失败处理" }
      ],
      "edges": [
        { "from": "start", "to": "receive" },
        { "from": "receive", "to": "validate" },
        { "from": "validate", "to": "process" },
        { "from": "process", "to": "wait" },
        { "from": "wait", "to": "decision" },
        { "from": "decision", "to": "success", "label": "成功" },
        { "from": "decision", "to": "failure", "label": "失败" }
      ]
    },
    "diagram": {
      "w": 720, "h": 560,
      "boxes": [
        { "id": "start", "x": 125, "y": 16, "w": 130, "h": 80, "fill": "sky", "shape": "ellipse", "label": "开始" },
        { "id": "receive", "x": 115, "y": 140, "w": 150, "h": 64, "fill": "mint", "label": "接收请求" },
        { "id": "validate", "x": 115, "y": 248, "w": 150, "h": 64, "fill": "mint", "label": "检查条件" },
        { "id": "process", "x": 115, "y": 356, "w": 150, "h": 64, "fill": "mint", "label": "执行操作" },
        { "id": "wait", "x": 115, "y": 464, "w": 150, "h": 64, "fill": "mint", "label": "等待结果" },
        { "id": "decision", "x": 420, "y": 190, "w": 200, "h": 120, "fill": "amber", "shape": "diamond", "label": "处理成功？" },
        { "id": "success", "x": 450, "y": 40, "w": 140, "h": 64, "fill": "mintSoft", "label": "完成" },
        { "id": "failure", "x": 450, "y": 400, "w": 140, "h": 64, "fill": "gray", "label": "失败处理" }
      ],
      "arrows": [
        { "from": "start@bottom", "to": "receive@top", "shape": "line" },
        { "from": "receive@bottom", "to": "validate@top", "shape": "line" },
        { "from": "validate@bottom", "to": "process@top", "shape": "line" },
        { "from": "process@bottom", "to": "wait@top", "shape": "line" },
        { "from": "wait@right", "to": "decision@left", "shape": "elbow", "via": [[340, 496], [340, 250]] },
        { "from": "decision@top", "to": "success@bottom", "shape": "line", "label": "成功", "at": [544, 147] },
        { "from": "decision@bottom", "to": "failure@top", "shape": "line", "label": "失败", "at": [544, 355] }
      ]
    }
  }]
}
```

字段速查：`boxes` 的 `x/y` 是左上角，`w/h` 是尺寸；`shape` 默认圆角矩形，`ellipse` 起止、`diamond` 判断、`pill` 状态标签。`arrows` 的 `from/to` 用 `id@top/bottom/left/right` 锚点；直线 `line`，折线 `elbow` 配 `via: [[x,y],…]`；标签 `label` 配 `at: [x,y]`。状态 `status: "ok"/"error"/"warn"/"muted"`、副文字 `value` 若使用，须同时写入 `content.nodes` 与对应框；样式颜色不必制造业务状态。分支标签同时写入 `content.edges` 与对应边。`content` 是来源语义，不从模板反推。

### 文档与图稿格式


独立输入为 `{title,frames:[{id,title,note?,content:{nodes,edges},diagram}]}`；标准时序画布由工具确定，手工图默认 720×450，可设 `diagram.w/h`。完整字段约定与示例在 [references/frame-format.md](references/frame-format.md)（按「阅读范围」决定是否读取）；已有项目按其适配技能写入。

### 手工构图基线

默认亮底、深色文字、圆角框，颜色按角色一致使用；可适配已有设计，并非固定品牌规范。内置 `mint/pink/violet/sky/amber` 有基础、`Soft`、`Pale` 三档，另有 `gray`。

- 以 720×450 为基线：四周留白至少 14；主要框高约 62–90，标签约 20px，副文字约 13px。长文字先合理换行/增宽；标签与状态角标各有独立空间。
- 主节点默认圆角矩形，可按语义选 `shape`：`diamond` 用于判断/分支，`ellipse` 用于起止，`pill` 用于状态标签，状态机起止圆点用 `initial`/`final`（无文字）。菱形与椭圆的可用区域是内接形状，尺寸要按 [references/frame-format.md](references/frame-format.md) 的内接规则预留，通常比同标签的矩形更大或需要更宽的画布。
- 框顶可加线条图标区分角色：`icon` 取 `database/queue/user/cloud/clock`；ER 一对多用 `kind: "many"`（鸦脚朝「多」侧），类图整体-部分用 `start: "compose"/"aggregate"`（菱形贴整体侧）。
- 主节点宜不超过 8 个；更复杂内容按可解释的子关系拆帧，并完整保留总语义。窄屏若仍须看全图，按实际显示尺寸决定是否拆图。
- 相邻框留约 60 的走线空间；同边多线用 `:0.3/:0.7` 错开，端点避开角标。曲线方向与出入边匹配，多节点环优先 `orbit`。
- 边标签用 `at` 手摆到线外，通常离线 3–30；线长至少容纳标签加两端留白，避免文字、框、标题和其他线相互遮挡。
- 容器先给标题留空间（可从 `titleY:17`、卡片从 `y+31` 开始），内部示意与外部主关系有清楚的视觉层级。

**完成门槛**：每个目标图稿完整；主要节点与边、标签、值、状态均对齐 `content`；示意元素与主语义分开；所有未请求的语义保持不变。

## 3. 生成与检查

`SKILL` 取本次加载的技能目录，`OUT` 取目标输出目录。技能资产/脚本按技能目录定位，输入和输出相对当前工作目录；从任何仓库都可运行，无需复制实现。

```bash
python3 "$SKILL/scripts/render.py" <document.json> --out "$OUT" [--widths 1200,390] [--check-only]
```

一条命令完成构建、截图与拼图：预览自包含，经 `file://` 直接渲染，无需起 HTTP 服务。默认只出 1200px 桌面证据；预定展示场景包含手机时才加 `--widths 1200,390`。**首轮直接全量渲染**，通过就审图；实际报错后才在修复循环使用 `--check-only`，按完整错误清单集中修复，收敛后全量渲染一次。仓库适配任务可对已有预览 URL 直接运行 `node "$SKILL/scripts/shoot.mjs" <preview-url> "$OUT"`，支持 `--widths=1200,390` 与 `--check-only`。

截图工具驱动本机无头 Chrome/Edge/Chromium（Node ≥ 22，无需额外安装；路径非标准时设 `BROWSER` 环境变量）；构建用 Python 3，拼图需 Pillow。依赖不可用时报告具体缺项，不能把未截图称为已审图。

输出：`$OUT/preview.html`、`report.json`、每帧 `<id>.svg`（自包含样式）与 `<id>-<宽度>.png`；两帧及以上才生成对应宽度的审图表（1200 为 `sheet.png`，其他为 `sheet-<宽度>.png`），单帧直接读对应宽度 PNG。

分开核对两类检查：
1. **几何**：`DiagramCheck.geometry(svg,diagram)` → `{errors,hints}`，检查文字/角标、框、线、标签、标题与边界的冲突；错误逐项修复，提示逐项判定。
2. **语义**：`DiagramCheck.semantic(diagram,content)` → `{errors,hints}`。独立模式严格核对节点与边的完整集合、空白/换行归一后的标签和值、`error/ok/warn/muted` 状态、边标签与阻塞类型；多余主节点/主边也是错误。容器标题映射为标签；内部小图与装饰不充当内容节点，不可把主要节点标成小图以绕过检查。

独立工具链已执行两份检查，`report.json` 的 `viewports[].items[]` 直接提供 `geometry: {errors,hints}` 与 `semantic: {errors,hints}`；命令行也分别显示数量。核对这两份实际结果及 `scriptErrors` 即可，`null` 表示未执行、不能通过。检查器的 `semantic` 只比较图稿与 `content`，来源到 `content` 的业务正确性仍须亲自核对。证据完整时直接审图交付，无需读渲染脚本或另写检查器来证明检查已执行。
检查报错时先用工具返回的错误清单定位；信息不足再查 [references/troubleshooting.md](references/troubleshooting.md) 对应条目。只修缺陷涉及的几何或字段；保留语义、已通过的布局和无关样式。

**完成门槛**：每个目标已渲染、JS 加载/运行无错；几何与语义错误分别为 0；每条提示都有保留理由或已修复；输出数量与目标集逐项对应。

## 4. 亲自审图并交付

打开最后一次修改之后生成的审图表（单帧直接读 `<id>-<宽度>.png`），并检查每个目标的截图；缩略图无法判断文字/交点时读单帧。对预定桌面和/或移动展示尺寸逐项核对：
- 第一眼能找到主线，所有箭头方向、循环回流、分支归属与分组边界清楚。
- 标签、值和状态可辨认；换行自然；无拥挤、遮挡、越界或误导性的视觉强调。
- 逐项对照来源核对 `content` 的参与者、关系、标签/参数、值、状态；时序还须核对消息先后与转交路径。报告通过不代替这一步，措辞无需照抄模板但含义必须完整；状态色/角标、阻塞边和示意层级表达准确。
- 同组图的颜色、尺寸和位置变化有理由；编辑图的未请求内容保持原意。

有实际问题就集中修复图稿，再生成检查与最新截图；来源核对、几何/语义/JS 检查和实际 PNG 审阅全部通过即交付。此后不再重排、配色、添加装饰，或追加产物、计时、证明链；新发现的真实缺陷仍须修复并重新检查受影响输出。**几何 0 错误只说明没有检测到几何冲突，不能代替来源核对或视觉判断。**

**交付门槛**：目标集内全部图完成，最新证据已亲自看过，适用展示尺寸均通过；仓库集成入口已更新且相关回归通过。汇报提供完成数量、产物路径（预览/SVG/审图表或单帧 PNG）、几何/语义/JS 检查结果与视觉结论，剩余提示给出理由；单帧简单图一两句即可。未解决的语义疑点、视觉问题或未执行项明示，不能计为通过。

用户要求耗时时，可用 `time` 包住首次渲染；模型阅读/构思阶段未独立计时就明确标为估算。使用现成计时结果，不为补分项耗时再次渲染、写计时脚本或读取实现。完整端到端速度由技能维护的独立基准记录，不是绘图子任务的额外步骤。
