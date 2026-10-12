# 通用图解 Demo

内容来源：[brief.md](brief.md)。图稿与独立语义清单：[diagrams.json](diagrams.json)。它们只描述交付与运营关系，不依赖其他仓库的数据、脚本或预览页。

## 看结果

- [完整预览](output/preview.html)：内嵌渲染器、检查器、数据与样式，可直接打开，也可通过 HTTP 查看。
- [发布流水线 SVG](output/release-flow.svg)：横向流程。
- [异常恢复闭环 SVG](output/recovery-loop.svg)：循环、边标签与状态角标。
- [订单与仓储边界 SVG](output/service-boundaries.svg)：嵌套容器、跨服务双向关系、960×540 画布。
- [桌面审图表](output/sheet.png)、[390px 审图表](output/sheet-390.png)、[检查报告](output/report.json)。

三个 SVG 均内嵌样式，独立打开不加载外部 JS。高密度边界图以桌面细读为主要场景；390px 截图用于观察缩放效果，若任务要求手机舒适阅读，应放大 SVG 或针对手机拆图，不能只以几何检查通过代替可读性判断。

## 重现

以下使用全局技能软链接，也可将 `SKILL` 设为任何安装位置。依赖：Python 3、ego-browser；拼图还需 Pillow。使用浏览器工具前读取 ego-browser 技能。

```bash
SKILL="$HOME/.agents/skills/draw-diagram"
OUT="$SKILL/demo/output"
python3 "$SKILL/scripts/build.py" "$SKILL/demo/diagrams.json" --out "$OUT"
python3 -m http.server 8891 --bind 127.0.0.1 --directory "$OUT"
```

另一个终端执行；服务已存在时直接复用，端口被其他服务占用时选一个可用端口，并同步更改 URL：

```bash
SKILL="$HOME/.agents/skills/draw-diagram"
OUT="$SKILL/demo/output"
"$SKILL/scripts/shoot.sh" http://127.0.0.1:8891/preview.html "$OUT"
python3 "$SKILL/scripts/sheet.py" "$OUT"
python3 "$SKILL/scripts/sheet.py" "$OUT" 390
```

本次实际运行从 `/tmp` 通过全局软链接调用截图与导出工具。1200px 和 390px 都报告 3/3 已渲染、错误 0、提示 0、JS 报错无，最新两张审图表已查看。直接通过 `file:` 打开预览也得到 3/3、错误 0，页面无外部资源；独立打开嵌套边界 SVG 后确认其尺寸、业务标签、内嵌样式与零外部脚本。该 demo 证明工具与产物独立运行，不代表已测量不同模型遵循提示词的成功率。

## 给 agent 的示例任务

```text
使用 draw-diagram。以该技能 demo/brief.md 为语义来源，画出发布流水线、异常恢复闭环和订单与仓储边界三张图解。
先读取通用技能的流程及按分支需要的参考文件；保留来源中的全部节点、边标签与状态。
输出到一个独立目录，交付自包含 SVG、预览、检查报告和最新审图表。
以桌面细读为主要展示场景，同时提供 390px 截图并说明窄屏可读性限制。
```
