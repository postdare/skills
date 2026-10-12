(() => {
  'use strict';
  // Fixed-geometry diagram renderer; routing uses explicit anchors and control points.
  // 连线写法：from/to 为「框id@边[:位置0~1]」，shape 为 arc（弧线连接）、elbow（直角折线）或 line（直线）。
  // 时序风格：diagram.lifelines 声明节点生命线（虚线，纯装饰），连线用「id@life:y」锚在生命线高度上；
  // 两条生命线之间的消息默认走直线，同一条生命线上的两端自动画成自调用环。
  // 进阶时序：diagram.activations 在生命线上加执行激活条，diagram.fragments 画 Alt/Opt/Loop/Par 组合片段框；
  // 片段框可用 sections 分若干 operands（段间虚线分隔、每段自带 guard），dashed 换虚线外框；
  // lifelines[].foot 把生命线收在脚注 y 上并放一个参与者盒子的视觉副本；box.icon: 'actor' 是火柴人参与者。
  // 以上都是装饰（不进 content、不参与语义比对与几何检查）。层级：泳道/生命线之上是激活条，再是箭头与节点；
  // 脚注副本与主盒同层（箭头之上）；片段框是底衬，排在泳道/生命线之前，这样框内的生命线、激活条与消息线都不会被半透明白底洗淡。
  // 分组边界：group.dashed 用虚线描边，group.titleAlign: 'left' 让标题左对齐（默认为居中）。
  // 节点写法：box.shape 为 rect（默认）、pill、diamond 或 ellipse；锚点与角标按该形状的边界计算。
  const svgNS = 'http://www.w3.org/2000/svg';
  // Bright fills keep black labels legible; assign colors consistently by concept.
  const fills = {
    mint: '#00e5cc', mintSoft: '#84f0dc', mintPale: '#c9f7ec',
    pink: '#ff3d9e', pinkSoft: '#ff80c4', pinkPale: '#ffd0e8',
    violet: '#a98bff', violetSoft: '#cbb9ff', violetPale: '#ebe4ff',
    sky: '#3fb8ff', skySoft: '#93d6ff', skyPale: '#d6efff',
    amber: '#ffb020', amberSoft: '#ffd27a', amberPale: '#ffefcc',
    gray: '#e4e8eb'
  };
  // dy 是字形墨迹中心相对圆心的修正量：`dominant-baseline: central` 对齐的是 em 盒中心，
  // 而 × ✓ ? 的墨迹在 em 盒里并不居中（800 13px PingFang/Helvetica 用 canvas measureText 实测：
  // 墨迹中心分别比 em 中心低 1.6 / 0.5 / 0.3px），不修正时 × 明显偏下。
  const badges = {
    error: { fill: '#e5484d', glyph: '×', ink: '#fff', dy: -1.6 },
    ok: { fill: '#18a058', glyph: '✓', ink: '#fff', dy: -0.5 },
    warn: { fill: '#f5a524', glyph: '?', ink: '#1a1a1a', dy: -0.3 }
  };
  // 关系线型按语义选：flow 同步/调用（实线实心箭头）、async 异步（实线开放箭头）、
  // reply 返回/响应（虚线开放箭头，虚线样式在 diagram.css）、blocked 阻断失败（红色虚线）。
  // 同步用实心三角、异步与返回用开放箭头，是 UML 交互图的通行画法。
  const heads = {
    flow: { color: '#111', open: false },
    async: { color: '#111', open: true },
    reply: { color: '#111', open: true },
    blocked: { color: '#e0245e', open: false },
    // many：ER 一对多的鸦脚，落在「多」的一侧（箭头端）；三爪从线尾处张开，与实心箭头共用 6px 落点约定
    many: { color: '#111', foot: true },
    // one：ER「一」侧的端部短杠；refX=11 让竖杠正好压在框边界上（route 中末端 gap 取 0）
    one: { color: '#111', bar: true, refX: 11 }
  };
  // 起点端标记：compose/aggregate 为 UML 类图菱形（贴着「整体」一侧的框边），
  // one/many 为 ER 起点端的短杠/鸦脚（扇向源头框）；每项自带 path 与样式，marker refX=0 沿路径向前铺开
  const startHeads = {
    compose: { d: 'M 6 0.9 L 11.1 6 L 6 11.1 L 0.9 6 Z', fill: '#111', stroke: 'none', width: 1.4 },
    aggregate: { d: 'M 6 0.9 L 11.1 6 L 6 11.1 L 0.9 6 Z', fill: '#fff', stroke: '#111', width: 1.4 },
    one: { d: 'M 0.8 0.8 L 0.8 11.2', fill: 'none', stroke: '#111', width: 2.4 },
    many: { d: 'M 11.2 6 L 0.8 1.8 M 11.2 6 L 0.8 6 M 11.2 6 L 0.8 10.2', fill: 'none', stroke: '#111', width: 1.7, linecap: 'round' }
  };
  const arrowKinds = new Set(Object.keys(heads));
  // 交互片段框（UML combined fragment）：字形沿用规范符号，标签文字用英文缩写；
  // 与生命线、泳道分隔线一样是装饰，不进 content、不参与语义比对，也不进几何判定。
  const fragmentKinds = {
    alt: { glyph: '◇', label: 'Alt' },
    opt: { glyph: '◇', label: 'Opt' },
    loop: { glyph: '↻', label: 'Loop' },
    par: { glyph: '=', label: 'Par' }
  };
  // 节点图标：24×24 网格的线条图标（stroke 风格，与文字同墨色），box.icon 选用；纯视觉，不进 content
  const icons = {
    database: [
      { d: 'M12 3C6.8 3 3.4 4.5 3.4 6.3v11.4C3.4 19.5 6.8 21 12 21s8.6-1.5 8.6-3.3V6.3C20.6 4.5 17.2 3 12 3Z' },
      { d: 'M3.4 6.3C3.4 8.1 6.8 9.6 12 9.6s8.6-1.5 8.6-3.3' },
      { d: 'M3.4 12c0 1.8 3.4 3.3 8.6 3.3s8.6-1.5 8.6-3.3' }
    ],
    queue: [
      { d: 'M3.5 6.5h10.5' }, { d: 'M3.5 12h10.5' }, { d: 'M3.5 17.5h10.5' },
      { d: 'M15.5 12h5M18.2 9.6 20.6 12l-2.4 2.4' }
    ],
    user: [
      { cx: 12, cy: 7.4, r: 3.6 },
      { d: 'M4.8 20.4c.6-4.4 3.4-6.6 7.2-6.6s6.6 2.2 7.2 6.6' }
    ],
    cloud: [
      { d: 'M7.2 18.6a4.3 4.3 0 0 1-.8-8.5 5.6 5.6 0 0 1 10.8-1.6 4.1 4.1 0 0 1 1.1 10.1Z' }
    ],
    // actor：时序图参与者火柴人（头 + 躯干 + 双臂 + 双腿）。五笔都在 24×24 网格内居中：
    // 头心 (12,4.6) r 3.4，躯干 8→15.4，双臂 y 11.2 横跨 4.6→19.4，双腿从胯 (12,15.4) 斜到脚跟 (6.8/17.2,21.4)
    actor: [
      { cx: 12, cy: 4.6, r: 3.4 },
      { d: 'M12 8v7.4' },
      { d: 'M4.6 11.2h14.8' },
      { d: 'M12 15.4 6.8 21.4' },
      { d: 'M12 15.4l5.2 6' }
    ],
    clock: [
      { cx: 12, cy: 12, r: 8.3 },
      { d: 'M12 6.6V12l3.6 2.2' }
    ]
  };
  const sides = { top: { x: 0, y: -1 }, right: { x: 1, y: 0 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 } };

  // 主节点外形：rect（默认，圆角由 r 控制）、pill（胶囊，两端半圆）、diamond（菱形，判断）、ellipse（椭圆，起止）。
  // 只有 rect 使用 r；其余形状的边界按解析几何求，锚点、角标与文字可用区域都以形状边界为准。
  const shapeOf = shape => shape.shape || 'rect';
  const centerOf = shape => ({ x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 });
  // 胶囊的脊线：横放时是水平线段，竖放时是垂直线段；形状 = 脊线 ⊕ 半径 R 的圆
  const spineOf = shape => shape.w >= shape.h
    ? { x1: shape.x + shape.h / 2, y1: shape.y + shape.h / 2, x2: shape.x + shape.w - shape.h / 2, y2: shape.y + shape.h / 2, r: shape.h / 2 }
    : { x1: shape.x + shape.w / 2, y1: shape.y + shape.w / 2, x2: shape.x + shape.w / 2, y2: shape.y + shape.h - shape.w / 2, r: shape.w / 2 };
  // 梯形的凸四边形顶点：上边缘全宽，下边缘两侧各内缩 12%（漏斗层级形状）
  const trapezoidOf = shape => [
    { x: shape.x, y: shape.y }, { x: shape.x + shape.w, y: shape.y },
    { x: shape.x + shape.w * 0.88, y: shape.y + shape.h }, { x: shape.x + shape.w * 0.12, y: shape.y + shape.h }
  ];
  function insideShape(shape, point, inset = 0) {
    const kind = shapeOf(shape);
    const c = centerOf(shape);
    const dx = point.x - c.x;
    const dy = point.y - c.y;
    if (kind === 'pill') {
      const spine = spineOf(shape);
      const u = Math.max(spine.x1, Math.min(point.x, spine.x2));
      const v = Math.max(spine.y1, Math.min(point.y, spine.y2));
      return Math.hypot(point.x - u, point.y - v) < spine.r - inset;
    }
    // 凸四边形逐边判定：点对每条有向边（顺时针）的叉积须同号，inset 换算成到边的垂直距离
    if (kind === 'trapezoid') {
      const vertices = trapezoidOf(shape);
      for (let index = 0; index < 4; index++) {
        const a = vertices[index];
        const b = vertices[(index + 1) % 4];
        const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
        const distance = -cross / Math.hypot(b.x - a.x, b.y - a.y);
        if (distance < inset) return false;
      }
      return true;
    }
    const half = { w: shape.w / 2 - inset, h: shape.h / 2 - inset };
    if (half.w <= 0 || half.h <= 0) return false;
    if (kind === 'diamond') return Math.abs(dx) / half.w + Math.abs(dy) / half.h <= 1;
    // initial/final 起止圆点与椭圆同算法（外接框即圆的外接框）
    if (kind !== 'rect') return (dx / half.w) ** 2 + (dy / half.h) ** 2 <= 1;
    return Math.abs(dx) < half.w && Math.abs(dy) < half.h;
  }
  // 把外接矩形上的目标点沿「中心→目标」方向推到形状边界：rect 的目标点本来就在边界上
  function boundary(shape, target) {
    const kind = shapeOf(shape);
    const c = centerOf(shape);
    const dx = target.x - c.x;
    const dy = target.y - c.y;
    if (kind === 'rect' || (!dx && !dy)) return { x: target.x, y: target.y };
    // 梯形：中心→目标射线与四条边求交，取参数 t 最小的正向交点
    if (kind === 'trapezoid') {
      const vertices = trapezoidOf(shape);
      let nearest = Infinity;
      for (let index = 0; index < 4; index++) {
        const a = vertices[index];
        const b = vertices[(index + 1) % 4];
        const ex = b.x - a.x;
        const ey = b.y - a.y;
        const denom = dx * ey - dy * ex;
        if (!denom) continue;
        const t = ((a.x - c.x) * ey - (a.y - c.y) * ex) / denom;
        const u = ((a.x - c.x) * dy - (a.y - c.y) * dx) / denom;
        if (t > 0 && u >= 0 && u <= 1 && t < nearest) nearest = t;
      }
      return nearest === Infinity ? { x: target.x, y: target.y } : { x: c.x + dx * nearest, y: c.y + dy * nearest };
    }
    if (kind === 'pill') {
      let near = 0;
      let far = 2;
      while (insideShape(shape, { x: c.x + dx * far, y: c.y + dy * far }) && far < 64) far *= 2;
      for (let step = 0; step < 24; step++) {
        const middle = (near + far) / 2;
        if (insideShape(shape, { x: c.x + dx * middle, y: c.y + dy * middle })) near = middle;
        else far = middle;
      }
      return { x: c.x + dx * near, y: c.y + dy * near };
    }
    const scale = kind === 'diamond'
      ? 1 / (Math.abs(dx) / (shape.w / 2) + Math.abs(dy) / (shape.h / 2))
      : 1 / Math.hypot(dx / (shape.w / 2), dy / (shape.h / 2));
    return { x: c.x + dx * scale, y: c.y + dy * scale };
  }
  // 角标落在形状内侧的右上方向，离边界约 15：rect 沿用原有的固定角落
  function badgeCenter(shape) {
    const kind = shapeOf(shape);
    const c = centerOf(shape);
    if (kind === 'diamond') return { x: c.x + shape.w * 0.15, y: c.y - shape.h * 0.15 };
    if (kind === 'ellipse') {
      const scale = Math.max(1 - 15 / Math.min(shape.w / 2, shape.h / 2), 0);
      return { x: c.x + shape.w / 2 * 0.707 * scale, y: c.y - shape.h / 2 * 0.707 * scale };
    }
    if (kind === 'pill') {
      const spine = spineOf(shape);
      const offset = Math.max(spine.r - 15, 0) * 0.707;
      const end = shape.w >= shape.h ? { x: spine.x2, y: spine.y1 } : { x: spine.x1, y: spine.y1 };
      return { x: end.x + offset, y: end.y - offset };
    }
    return { x: shape.x + shape.w - 17, y: shape.y + 17 };
  }

  function element(name, attributes = {}, parent) {
    const node = document.createElementNS(svgNS, name);
    for (const [key, value] of Object.entries(attributes)) if (value !== undefined && value !== null) node.setAttribute(key, value);
    if (parent) parent.append(node);
    return node;
  }
  function text(parent, x, y, content, attributes) {
    const node = element('text', { x, y, ...attributes }, parent);
    const lines = String(content).split('\n');
    lines.forEach((line, index) => {
      const span = element('tspan', { x, dy: index === 0 ? `${-(lines.length - 1) * 0.6}em` : '1.2em' }, node);
      span.textContent = line;
    });
    return node;
  }
  function anchor(shapes, reference, lifelines = new Map()) {
    const [id, rest = 'right'] = reference.split('@');
    const [side, ratioText] = rest.split(':');
    const shape = shapes.get(id);
    if (!shape) throw new Error(`连线引用了不存在的框：${id}`);
    // @life:<y>：落在该节点生命线的指定高度上。方向不固定，由 route 依另一端（或自调用）补齐。
    if (side === 'life') {
      const line = lifelines.get(id);
      if (!line) throw new Error(`节点没有声明生命线，无法用 @life 锚点：${reference}`);
      const y = Number(ratioText);
      if (!Number.isFinite(y)) throw new Error(`@life 锚点要写成 id@life:y：${reference}`);
      return { point: { x: line.x, y }, direction: null, life: true };
    }
    const ratio = ratioText === undefined ? 0.5 : Number(ratioText);
    const direction = sides[side];
    const target = side === 'top' || side === 'bottom'
      ? { x: shape.x + shape.w * ratio, y: side === 'top' ? shape.y : shape.y + shape.h }
      : { x: side === 'left' ? shape.x : shape.x + shape.w, y: shape.y + shape.h * ratio };
    return { point: boundary(shape, target), direction };
  }
  function roundedPath(points, radius) {
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let index = 1; index < points.length - 1; index++) {
      const previous = points[index - 1];
      const current = points[index];
      const next = points[index + 1];
      const inbound = Math.hypot(current.x - previous.x, current.y - previous.y) || 1;
      const outbound = Math.hypot(next.x - current.x, next.y - current.y) || 1;
      const trim = Math.min(radius, inbound / 2, outbound / 2);
      const entry = { x: current.x - (current.x - previous.x) / inbound * trim, y: current.y - (current.y - previous.y) / inbound * trim };
      const exit = { x: current.x + (next.x - current.x) / outbound * trim, y: current.y + (next.y - current.y) / outbound * trim };
      d += ` L ${entry.x} ${entry.y} Q ${current.x} ${current.y} ${exit.x} ${exit.y}`;
    }
    const last = points[points.length - 1];
    return `${d} L ${last.x} ${last.y}`;
  }
  // orbit：沿整帧共用的环轨（椭圆 ring）顺时针走，自动在两框边界处截断——任意节点数的环都顺
  function orbit(ring, from, to, gap, counter) {
    const angleOf = box => Math.atan2((box.y + box.h / 2 - ring.cy) / ring.ry, (box.x + box.w / 2 - ring.cx) / ring.rx);
    const start = angleOf(from);
    const sign = counter ? -1 : 1;
    let span = (angleOf(to) - start) * sign;
    while (span <= 0) span += Math.PI * 2;
    const steps = Math.ceil(span / (Math.PI / 720));
    const points = [];
    for (let index = 0; index <= steps; index++) {
      const angle = start + sign * span * index / steps;
      const point = { x: ring.cx + ring.rx * Math.cos(angle), y: ring.cy + ring.ry * Math.sin(angle) };
      if (!insideShape(from, point, 0) && !insideShape(to, point, gap)) points.push(point);
    }
    return `M ${points.filter((point, index) => index % 4 === 0 || index === points.length - 1).map(point => `${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' L ')}`;
  }
  // 箭头尖端贴合目标边界：线尾回退到三角内部（回退处三角半高 ≈ 0.458×回退量，须大于线半宽），出发端贴边
  // 激活条半宽：消息端点落在条的近侧边缘而不是中心线上，箭头不会扎进执行条
  const activationHalf = 7;
  // 命中的激活条边缘：返回该生命线上、覆盖 y 的条边缘 x（offset 让末端再退 gap，箭头尖正好落在边缘）
  function activationEdge(activations, lifelines, id, y, toward, offset) {
    const line = lifelines.get(id);
    if (!line) return null;
    const shape = null;
    let edge = null;
    for (const activation of activations) {
      if (activation.of !== id) continue;
      if (y < Number(activation.from) || y > Number(activation.to)) continue;
      const side = Math.sign(toward - line.x) || 1;
      const candidate = line.x + side * (activationHalf + offset);
      if (edge === null || Math.abs(candidate - toward) < Math.abs(edge - toward)) edge = candidate;
    }
    return edge;
  }
  function route(shapes, arrow, ring, lifelines = new Map(), activations = []) {
    if (arrow.shape === 'orbit') return orbit(ring, shapes.get(arrow.from), shapes.get(arrow.to), 6, arrow.counter);
    const start = anchor(shapes, arrow.from, lifelines);
    const end = anchor(shapes, arrow.to, lifelines);
    // 生命线锚点自身没有固定朝向：取「指向另一端」的水平方向；自调用（同一条生命线）向右出、向左回。
    const self = Boolean(start.life && end.life && start.point.x === end.point.x);
    if (!start.direction) start.direction = self ? { x: 1, y: 0 } : { x: Math.sign(end.point.x - start.point.x) || 1, y: 0 };
    if (!end.direction) end.direction = self ? { x: 1, y: 0 } : { x: Math.sign(start.point.x - end.point.x) || 1, y: 0 };
    // 与箭头标记 refX=8 对应：实心尖端越过线尾 (12−8)×1.5×scale，开放尖端 5.25×scale，刚好落到边界上
    // kind one 的短杠 refX=11 即线尾本身，gap 取 0 让短杠正好落在边界上
    const gap = arrow.kind === 'one' ? 0 : (arrow.size === 'sm' ? 3.3 : 6);
    const from = start.point;
    const to = { x: end.point.x + end.direction.x * gap, y: end.point.y + end.direction.y * gap };
    // 生命线锚点落在激活条覆盖范围内时，端点平移到条的近侧边缘：出发端贴外侧、到达端贴来向那一侧
    // 末端再多退 gap，让箭头尖正好落在条边缘（与 marker refX 的落点约定一致）
    if (start.life && !arrow.via) {
      const edge = activationEdge(activations, lifelines, arrow.from.split('@')[0], from.y, to.x, 0);
      if (edge !== null) from.x = edge;
    }
    if (end.life && !arrow.via) {
      const edge = activationEdge(activations, lifelines, arrow.to.split('@')[0], to.y, from.x, end.direction.x === 0 ? 0 : gap);
      if (edge !== null) to.x = edge;
    }
    const inward = { x: -end.direction.x, y: -end.direction.y };
    // 自调用：向右绕一个圆角矩形环再回到同一条生命线
    if (self && !arrow.via) {
      const reachX = from.x + (arrow.bend ?? 44);
      return roundedPath([from, { x: reachX, y: from.y }, { x: reachX, y: to.y }, to], 10);
    }
    // 两条生命线之间的消息默认走直线（时序风格），仍可用 elbow/arc 覆盖
    const kind = arrow.shape || (start.life && end.life ? 'line' : 'arc');
    if (kind === 'line') return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
    if (kind === 'elbow') {
      const points = [from, ...(arrow.via || []).map(([x, y]) => ({ x, y }))];
      if (!arrow.via) {
        const horizontalOut = start.direction.x !== 0;
        const horizontalIn = inward.x !== 0;
        if (horizontalOut && !horizontalIn) points.push({ x: to.x, y: from.y });
        else if (!horizontalOut && horizontalIn) points.push({ x: from.x, y: to.y });
        else if (horizontalOut) { const middle = (from.x + to.x) / 2; points.push({ x: middle, y: from.y }, { x: middle, y: to.y }); }
        else { const middle = (from.y + to.y) / 2; points.push({ x: from.x, y: middle }, { x: to.x, y: middle }); }
      }
      points.push(to);
      return roundedPath(points, arrow.radius ?? (arrow.size === 'sm' ? 8 : 18));
    }
    // arc：沿出发方向离开、沿进入方向到达的三次曲线（Keynote 曲线连接线的观感）。
    // 末端留一段直线给箭头头部；两端横向错开很远时加长控制柄，让弯转提前放缓，箭头不会「折」着进框
    const bend = arrow.bend ?? 1;
    const lead = arrow.size === 'sm' ? 0 : 16;
    const stem = { x: to.x - inward.x * lead, y: to.y - inward.y * lead };
    const delta = { x: stem.x - from.x, y: stem.y - from.y };
    const reach = direction => {
      const along = Math.abs(delta.x * direction.x + delta.y * direction.y);
      const across = Math.abs(delta.x * direction.y - delta.y * direction.x);
      return Math.max(24, along, across * 0.45) * 0.56 * bend;
    };
    const c1 = arrow.c1 ? { x: arrow.c1[0], y: arrow.c1[1] } : { x: from.x + start.direction.x * reach(start.direction), y: from.y + start.direction.y * reach(start.direction) };
    const c2 = arrow.c2 ? { x: arrow.c2[0], y: arrow.c2[1] } : { x: stem.x - inward.x * reach(inward), y: stem.y - inward.y * reach(inward) };
    return `M ${from.x} ${from.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${stem.x} ${stem.y}${lead ? ` L ${to.x} ${to.y}` : ''}`;
  }

  // 未挂到文档上的 path 在部分浏览器里量不出长度，借一个隐藏的探针
  let probeSvg = null;
  function measurePath(d) {
    if (!probeSvg) {
      probeSvg = element('svg', { width: 0, height: 0, 'aria-hidden': 'true', style: 'position:absolute;width:0;height:0;overflow:hidden' });
      element('path', {}, probeSvg);
      document.body.append(probeSvg);
    }
    const path = probeSvg.firstChild;
    path.setAttribute('d', d);
    return path;
  }
  let renderId = 0;
  function render(slide, { title } = {}) {
    const prefix = `diagram-${++renderId}`;
    const width = slide.w || 720;
    const height = slide.h || 450;
    const svg = element('svg', { viewBox: `0 0 ${width} ${height}`, xmlns: svgNS, class: 'slide', role: 'img' });
    if (title) element('title', {}, svg).textContent = title;
    const defs = element('defs', {}, svg);
    for (const [kind, head] of Object.entries(heads)) {
      for (const [size, scale] of [['', 1], ['-sm', 0.55]]) {
        const marker = element('marker', { id: `${prefix}-head-${kind}${size}`, viewBox: '0 0 12 12', refX: String(head.refX ?? 8), refY: '6', markerWidth: 18 * scale, markerHeight: 18 * scale, orient: 'auto', markerUnits: 'userSpaceOnUse' }, defs);
        element('path', head.bar
          ? { d: 'M 11 0.8 L 11 11.2', fill: 'none', stroke: head.color, 'stroke-width': 2.4 }
          : head.foot
          ? { d: 'M 8 6 L 12 1.8 M 8 6 L 12 6 M 8 6 L 12 10.2', fill: 'none', stroke: head.color, 'stroke-width': 1.7, 'stroke-linecap': 'round' }
          : head.open
          ? { d: 'M 0.5 1 L 11.5 6 L 0.5 11', fill: 'none', stroke: head.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }
          : { d: 'M 0 0.5 L 12 6 L 0 11.5 z', fill: head.color }, marker);
      }
    }
    // 起点端标记 refX=0：标记从出发边界沿线向前铺开，前端贴框、身体盖住线头；path 与样式由各项自带
    for (const [name, head] of Object.entries(startHeads)) {
      for (const [size, scale] of [['', 1], ['-sm', 0.55]]) {
        const marker = element('marker', { id: `${prefix}-start-${name}${size}`, viewBox: '0 0 12 12', refX: '0', refY: '6', markerWidth: 18 * scale, markerHeight: 18 * scale, orient: 'auto', markerUnits: 'userSpaceOnUse' }, defs);
        element('path', { d: head.d, fill: head.fill, stroke: head.stroke, 'stroke-width': head.width, 'stroke-linecap': head.linecap ?? null }, marker);
      }
    }
    const shadow = element('filter', { id: `${prefix}-shadow`, x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
    element('feDropShadow', { dx: '0', dy: '2', stdDeviation: '5', 'flood-color': '#000', 'flood-opacity': '.12' }, shadow);

    const shapes = new Map();
    for (const group of slide.groups || []) shapes.set(group.id, group);
    for (const box of slide.boxes || []) shapes.set(box.id, box);

    // 参与者盒子（含时序脚注副本）：一次渲染逻辑，主盒与脚注副本共用。
    // box 是最终坐标与内容（脚注副本 = 主盒副本，仅把 y 换成 foot），variants 提供各组成部分的类名，
    // 这样副本与主盒除了类名之外逐笔画一致（同 x/w/h/fill/label/icon/shape/status/dim）。
    function paintOf(box) {
      return {
        fill: box.status === 'muted' ? fills.gray : fills[box.fill] || box.fill || fills.mint,
        stroke: box.status === 'muted' ? '#9aa3ad' : box.status === 'error' ? '#e5484d' : 'none',
        'stroke-width': box.status === 'muted' ? 1.5 : 3,
        'stroke-dasharray': box.status === 'muted' ? '6 5' : null
      };
    }
    function participantBox(box, layer, variants) {
      const small = box.size === 'sm';
      const muted = box.status === 'muted';
      const kind = shapeOf(box);
      const center = centerOf(box);
      const shape = variants.shape;
      const paint = { class: shape, ...paintOf(box) };
      const dot = kind === 'initial' || kind === 'final';
      if (kind === 'initial') element('circle', { cx: center.x, cy: center.y, r: Math.min(box.w, box.h) / 2, class: shape, fill: '#111' }, layer);
      else if (kind === 'final') {
        element('circle', { cx: center.x, cy: center.y, r: Math.min(box.w, box.h) / 2, class: shape, fill: '#fff', stroke: '#111', 'stroke-width': 2.5 }, layer);
        element('circle', { cx: center.x, cy: center.y, r: Math.min(box.w, box.h) / 2 * 0.55, fill: '#111' }, layer);
      }
      else if (kind === 'ellipse') element('ellipse', { cx: center.x, cy: center.y, rx: box.w / 2, ry: box.h / 2, ...paint }, layer);
      else if (kind === 'diamond') element('path', { d: `M ${center.x} ${box.y} L ${box.x + box.w} ${center.y} L ${center.x} ${box.y + box.h} L ${box.x} ${center.y} Z`, 'stroke-linejoin': 'round', ...paint }, layer);
      else if (kind === 'trapezoid') element('path', { d: `M ${box.x} ${box.y} L ${box.x + box.w} ${box.y} L ${box.x + box.w * 0.88} ${box.y + box.h} L ${box.x + box.w * 0.12} ${box.y + box.h} Z`, 'stroke-linejoin': 'round', ...paint }, layer);
      else element('rect', { x: box.x, y: box.y, width: box.w, height: box.h, rx: kind === 'pill' ? Math.min(box.w, box.h) / 2 : box.r ?? (small ? 6 : 20), ...paint }, layer);
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      const icon = icons[box.icon];
      if (icon && !dot) {
        // 图标 24×24，占框顶一块；主框标签相应下移，sm 示意框等比缩小、标签不动
        const scale = small ? 0.5 : 1;
        const g = element('g', { class: 'slide-icon', transform: `translate(${cx - 12 * scale} ${box.y + (small ? 4 : 10)}) scale(${scale})` }, layer);
        for (const part of icon) element(part.d !== undefined ? 'path' : 'circle', part, g);
      }
      const hasValue = box.value !== undefined && box.value !== null && String(box.value) !== '' && !small;
      // 类图分栏：fields/methods 存在时标签置顶（y+24 加粗沿用 slide-box-label），其下分隔线，
      // fields 逐行左对齐（行距 20），再分隔线，再 methods 逐行；sm 示意框忽略分栏。
      // ER 实体行（rows，仅主框）：与 fields/methods 互斥且优先；标签置顶加分隔线后，
      // 逐行渲染 key/name/type 三列，key 与 name 之间加一条竖分隔线。框高预算 h ≥ 67 + 20×行数。
      const rows = !small && !dot && box.rows && box.rows.length ? box.rows : null;
      const sectioned = !small && !dot && (rows || (box.fields && box.fields.length) || (box.methods && box.methods.length));
      if (!dot) {
        const labelY = sectioned ? box.y + 24 : icon ? (hasValue ? cy + 6 : cy + 14) : (hasValue ? cy - 10 : cy);
        text(layer, cx, labelY, box.label, { class: `${variants.label}${muted ? ' is-muted' : ''}` });
        if (hasValue && !sectioned) text(layer, cx, icon ? cy + 24 : cy + 15, box.value, { class: `${variants.value}${muted ? ' is-muted' : ''}` });
      }
      if (rows) {
        // ER 三列：水平分隔线 y+38；行基线 y+58+i*20；key 列 x+10、name 列 x+56 左对齐，type 列右对齐
        element('path', { class: variants.divider, d: `M ${box.x + 10} ${box.y + 38} L ${box.x + box.w - 10} ${box.y + 38}` }, layer);
        // key 与 name 之间的竖分隔线：x+48，从 y+38 到 y+h-8
        element('path', { class: variants.divider, d: `M ${box.x + 48} ${box.y + 38} L ${box.x + 48} ${box.y + box.h - 8}` }, layer);
        rows.forEach((row, index) => {
          const y = box.y + 58 + index * 20;
          if (row.key) text(layer, box.x + 10, y, row.key, { class: variants.key });
          text(layer, box.x + 56, y, row.name, { class: variants.member });
          if (row.type) text(layer, box.x + box.w - 12, y, row.type, { class: variants.type });
        });
      } else if (sectioned) {
        const divider = y => element('path', { class: variants.divider, d: `M ${box.x + 10} ${y} L ${box.x + box.w - 10} ${y}` }, layer);
        const members = (list, top) => list.forEach((member, index) => text(layer, box.x + 12, top + index * 20, member, { class: variants.member }));
        const fields = box.fields || [];
        const methods = box.methods || [];
        divider(box.y + 38);
        members(fields, box.y + 58);
        if (fields.length && methods.length) divider(box.y + 58 + fields.length * 20 - 10);
        members(methods, box.y + 58 + (fields.length ? fields.length * 20 : 0));
      }
      const badge = badges[box.status];
      if (badge && !small && !dot) {
        const at = badgeCenter(box);
        element('circle', { class: 'slide-badge-dot', cx: at.x, cy: at.y, r: 11, fill: badge.fill, stroke: '#fff', 'stroke-width': 2 }, layer);
        text(layer, at.x, at.y + badge.dy, badge.glyph, { class: 'slide-badge', fill: badge.ink });
      }
    }

    // 生命线（时序风格）：从节点底边向下的虚线，纯装饰，只用于给 @life:<y> 锚点定位。
    // lifelines[].foot：给定时生命线止于该 y，并在 y 处画一个与参与者盒子完全同款的视觉副本（脚注框）。
    // 副本是装饰：类名走独立的 slide-foot/slide-foot-*，检查器选择器（.slide-box/.slide-group/.slide-shape/…）都看不到它。
    const lifelines = new Map();
    for (const line of slide.lifelines || []) {
      const shape = shapes.get(line.of);
      if (!shape) throw new Error(`生命线引用了不存在的框：${line.of}`);
      if (lifelines.has(line.of)) throw new Error(`同一节点只能有一条生命线：${line.of}`);
      const x = shape.x + shape.w * (line.at === undefined ? 0.5 : Number(line.at));
      // foot 直接采用给定数值（不吸附网格）：契约要求副本盒顶部落在该 y，y 同时是生命线的终点，
      // 于是 @life:foot 的箭头端点正好落在副本盒上边缘上（contains 是严格不等式，不构成穿框）。
      const foot = line.foot === undefined ? null : Number(line.foot);
      if (foot !== null && !Number.isFinite(foot)) throw new Error(`生命线 foot 必须是数值：${line.of}`);
      lifelines.set(line.of, { of: line.of, x, y1: boundary(shape, { x, y: shape.y + shape.h }).y, y2: foot ?? line.to ?? height - 24, end: line.end, foot });
    }

    for (const group of slide.groups || []) {
      const layer = element('g', { class: 'slide-group', 'data-id': group.id, opacity: group.dim ? 0.4 : null }, svg);
      element('rect', { x: group.x, y: group.y, width: group.w, height: group.h, rx: group.r ?? 22, class: 'slide-shape', fill: '#fff', stroke: group.status === 'error' ? '#e5484d' : '#1b1b1b', 'stroke-width': 1.5, 'stroke-dasharray': group.dashed ? '9 7' : null }, layer);
      // titleAlign: 'left' 把标题挪到左内边距并左对齐（区别于默认居中）：层叠容器/片段框用左对齐更贴标签习惯
      if (group.title) {
        const left = group.titleAlign === 'left';
        text(layer, left ? group.x + 16 : group.x + group.w / 2, group.y + (group.titleY ?? 26), group.title, { class: `slide-group-title${left ? ' is-left' : ''}` });
      }
      if (group.card) element('rect', { x: group.card.x, y: group.card.y, width: group.card.w, height: group.card.h, rx: 10, class: 'slide-card', fill: '#fff', filter: `url(#${prefix}-shadow)` }, layer);
    }
    // 交互片段框（时序）：UML 组合片段 Alt/Opt/Loop/Par。面板与标签条是装饰，不进 content、不参与语义比对。
    // **层级：面板 = 片段底衬，排在泳道/生命线之前**。面板只有 fill-opacity .92 的白底，若盖在生命线上就会把
    // 它洗淡到几乎看不见（实测：片段框内的生命线/激活条被压到 ~93% 白，读起来像断线）；排在生命线之下则
    // 只压画布底色，生命线、激活条与消息线在框内全都保持原样。片段自己的边框描边仍画在生命线之下，1.5 描边
    // 与 1.5 虚线生命线只有 1px 内缘相切，两色同为 #111/近黑，重叠处不可辨，不构成观感问题。
    // 面板底部边框与它下面的任何图元都不重叠，故底边始终可见。
    const fragments = slide.fragments || [];
    if (fragments.length) {
      const fragmentLayer = element('g', { class: 'slide-fragments' }, svg);
      for (const fragment of fragments) {
        const spec = fragmentKinds[fragment.kind];
        if (!spec) throw new Error(`片段框 kind 只能是 alt/opt/loop/par：${fragment.kind}`);
        const { x, y } = fragment;
        const layer = element('g', { 'data-kind': fragment.kind, opacity: fragment.dim ? 0.4 : null }, fragmentLayer);
        // dashed: true 把外框描边换成虚线（与 group.dashed 同一观感，见 diagram.css）
        element('rect', { x, y, width: fragment.w, height: fragment.h, rx: 4, class: `slide-fragment${fragment.dashed ? ' is-dashed' : ''}` }, layer);
        // 左上角标签条：宽 78、高 26，内含字形 + 英文缩写；14px bold 左对齐，两段文字起点相隔 20
        element('rect', { x, y, width: 78, height: 26, class: 'slide-fragment-tab' }, layer);
        text(layer, x + 12, y + 14, spec.glyph, { class: 'slide-fragment-tab-text' });
        text(layer, x + 32, y + 14, spec.label, { class: 'slide-fragment-tab-text' });
        // sections：把「标签条以下 → 框底」的正文带均分为 N 段（每段一个 operands 分区），段间画虚线分隔线，
        // 每段 guard 左对齐落在该段左上（x+14、段顶+26，即旧顶层 guard 的同一相对位置）。
        // 有 sections 时忽略顶层 guard（契约），无 sections 时下面这支不进，行为与旧版逐字节相同。
        const sections = fragment.sections;
        if (sections && sections.length) {
          const top = y + 26;
          const band = fragment.h - 26;
          const step = band / sections.length;
          sections.forEach((section, index) => {
            const sectionTop = top + step * index;
            if (index) element('path', { d: `M ${x + 1} ${sectionTop} L ${x + fragment.w - 1} ${sectionTop}`, class: 'slide-fragment-divider' }, layer);
            if (section && section.guard) text(layer, x + 14, sectionTop + 26, section.guard, { class: 'slide-fragment-guard' });
          });
        } else if (fragment.guard) text(layer, x + 14, y + 52, fragment.guard, { class: 'slide-fragment-guard' });
        if (fragment.op) text(layer, x - 10, y + 18, fragment.op, { class: 'slide-fragment-op' });
      }
    }
    const lifeLayer = element('g', { class: 'slide-lifelines' }, svg);
    // 泳道泳池：单一外框 + 顶部标题带 + 道间单线分隔（参考标准泳道格式）；道是语义节点，分隔线纯装饰
    const pool = slide.swimlane;
    if (pool) {
      const g = element('g', { class: 'slide-swimlane' }, svg);
      const count = pool.lanes.length;
      const laneW = pool.w / count;
      const header = pool.header ?? 48;
      element('rect', { x: pool.x, y: pool.y, width: pool.w, height: pool.h, rx: 8, fill: '#fff', stroke: '#1b1b1b', 'stroke-width': 1.5 }, g);
      element('path', { d: `M ${pool.x} ${pool.y + header} L ${pool.x + pool.w} ${pool.y + header}`, class: 'slide-swimlane-sep' }, g);
      pool.lanes.forEach((lane, index) => {
        text(g, pool.x + laneW * (index + 0.5), pool.y + header / 2 + 2, lane.title, { class: 'slide-swimlane-title' });
        if (index) element('path', { d: `M ${pool.x + laneW * index} ${pool.y + header} L ${pool.x + laneW * index} ${pool.y + pool.h}`, class: 'slide-swimlane-sep' }, g);
      });
    }
    for (const line of lifelines.values()) {
      element('path', { d: `M ${line.x} ${line.y1} L ${line.x} ${line.y2}`, class: 'slide-lifeline' }, lifeLayer);
      if (line.end) element('path', { d: `M ${line.x - 7} ${line.y2} L ${line.x + 7} ${line.y2}`, class: 'slide-lifeline-end' }, lifeLayer);
    }
    // 生命线脚注框（时序）：foot 处放一个参与者盒子的视觉副本（装饰，不是节点）。类名全部独立于
    // .slide-box/.slide-group/.slide-shape/… 两族，检查器的框/标签/穿框判定都看不见它。
    // **层级：排在消息线之前**，与片段框同为底衬——副本盒的白底洗不掉箭头与激活条，箭头标签也始终压在它上面；
    // 消息线端点落在副本盒上边缘（y 与 foot 同值）时正好贴着盒边，不会扎进盒里。y 换成 foot，其余几何与主盒一致。
    const mainBoxes = new Map((slide.boxes || []).map(box => [box.id, box]));
    const feet = [...lifelines.values()].filter(line => line.foot !== null);
    if (feet.length) {
      const footLayer = element('g', { class: 'slide-feet' }, svg);
      for (const line of feet) {
        const shape = mainBoxes.get(line.of);
        if (!shape) throw new Error(`生命线脚注框 foot 只能挂在主框上（容器没有盒子外观可复制）：${line.of}`);
        const layer = element('g', { class: `slide-foot${shape.size === 'sm' ? ' slide-foot--sm' : ''}`, 'data-id': line.of, opacity: shape.dim ? 0.4 : null }, footLayer);
        participantBox({ ...shape, y: line.foot }, layer, {
          shape: 'slide-foot-shape', label: 'slide-foot-label', value: 'slide-foot-value',
          member: 'slide-foot-member', divider: 'slide-foot-divider',
          key: 'slide-foot-member slide-foot-key', type: 'slide-foot-member slide-foot-type'
        });
      }
    }
    // 激活条（时序）：生命线上一段 14 宽的窄条，表示该参与者在这段时间里正在执行。
    // 与生命线同为装饰：不进 content、不参与语义比对；类名刻意避开 .slide-shape/.slide-box/.slide-group/.slide-arrow，
    // 几何检查因此完全看不到它。层级在生命线之上、箭头之下——消息端点的 x 就是生命线 x，正好落在条的竖直中线上。
    // 图层按需创建：未声明 activations/fragments 的帧拿到的 DOM 与旧版一致
    const activations = slide.activations || [];
    if (activations.length) {
      const activationLayer = element('g', { class: 'slide-activations' }, svg);
      for (const activation of activations) {
        const shape = shapes.get(activation.of);
        if (!shape) throw new Error(`激活条引用了不存在的框：${activation.of}`);
        const line = lifelines.get(activation.of);
        if (!line) throw new Error(`节点没有声明生命线，无法放激活条：${activation.of}`);
        const from = Number(activation.from);
        const to = Number(activation.to);
        if (!Number.isFinite(from) || !Number.isFinite(to) || !(from < to)) throw new Error(`激活条 from 必须小于 to：${activation.of}`);
        // at 与 lifelines 的 at 同义（节点宽度上的比例）；缺省时直接用该节点生命线的 x，条心与时间轴严格重合
        const x = (activation.at === undefined ? line.x : shape.x + shape.w * Number(activation.at)) - 7;
        element('rect', { x, y: from, width: 14, height: to - from, class: 'slide-activation' }, activationLayer);
      }
    }
    const arrowLayer = element('g', { class: 'slide-arrows' }, svg);
    const boxLayer = element('g', { class: 'slide-boxes' }, svg);
    const labelLayer = element('g', { class: 'slide-arrow-labels' }, svg);

    for (const box of slide.boxes || []) {
      const small = box.size === 'sm';
      const kind = shapeOf(box);
      const layer = element('g', { class: `slide-box${small ? ' slide-box--sm' : ''}`, 'data-id': box.id, 'data-shape': kind, opacity: box.dim ? 0.4 : null }, boxLayer);
      participantBox(box, layer, {
        shape: 'slide-shape', label: 'slide-box-label', value: 'slide-box-value',
        member: 'slide-box-member', divider: 'slide-box-divider',
        key: 'slide-box-member slide-box-key', type: 'slide-box-member slide-box-type'
      });
    }
    for (const arrow of slide.arrows || []) {
      const small = arrow.size === 'sm';
      const kind = arrowKinds.has(arrow.kind) ? arrow.kind : 'flow';
      const path = element('path', {
        d: route(shapes, arrow, slide.ring, lifelines, activations), class: `slide-arrow slide-arrow--${kind}${small ? ' slide-arrow--sm' : ''}`,
        'marker-end': `url(#${prefix}-head-${kind}${small ? '-sm' : ''})`,
        'marker-start': startHeads[arrow.start] ? `url(#${prefix}-start-${arrow.start}${small ? '-sm' : ''})` : null,
        opacity: arrow.dim ? 0.4 : null
      }, arrowLayer);
      if (arrow.label) {
        let at = arrow.at;
        if (!at) {
          const probe = measurePath(path.getAttribute('d'));
          const length = probe.getTotalLength();
          const middle = probe.getPointAtLength(length / 2);
          const before = probe.getPointAtLength(Math.max(0, length / 2 - 2));
          const angle = Math.atan2(middle.y - before.y, middle.x - before.x);
          const side = arrow.side ?? 1;
          at = [middle.x + Math.sin(angle) * 16 * side, middle.y - Math.cos(angle) * 16 * side];
        }
        text(labelLayer, at[0], at[1], arrow.label, { class: `slide-arrow-label slide-arrow-label--${kind}`, style: arrow.anchor ? `text-anchor: ${arrow.anchor}` : null, opacity: arrow.dim ? 0.4 : null });
      }
    }
    for (const note of slide.notes || []) text(labelLayer, note.x, note.y, note.text, { class: `slide-note${note.tone ? ` slide-note--${note.tone}` : ''}`, style: note.anchor ? `text-anchor: ${note.anchor}` : null });
    return svg;
  }

  // Array fields concatenate; later explicitly supplied scalar fields win.
  const merge = (...parts) => parts.reduce((all, part) => ({
    ...all,
    ...part,
    boxes: [...all.boxes, ...(part.boxes || [])],
    arrows: [...all.arrows, ...(part.arrows || [])],
    groups: [...all.groups, ...(part.groups || [])],
    lifelines: [...all.lifelines, ...(part.lifelines || [])],
    activations: [...all.activations, ...(part.activations || [])],
    fragments: [...all.fragments, ...(part.fragments || [])],
    notes: [...all.notes, ...(part.notes || [])]
  }), { boxes: [], arrows: [], groups: [], lifelines: [], activations: [], fragments: [], notes: [] });

  window.Diagram = { render, fills, merge };
})();
