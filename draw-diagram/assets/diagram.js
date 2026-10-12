(() => {
  'use strict';
  // Fixed-geometry diagram renderer; routing uses explicit anchors and control points.
  // 连线写法：from/to 为「框id@边[:位置0~1]」，shape 为 arc（弧线连接）、elbow（直角折线）或 line（直线）。
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
  const sides = { top: { x: 0, y: -1 }, right: { x: 1, y: 0 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 } };

  // 主节点外形：rect（默认，圆角由 r 控制）、pill（胶囊，两端半圆）、diamond（菱形，判断）、ellipse（椭圆，起止）。
  // 只有 rect 使用 r；其余形状的边界按解析几何求，锚点、角标与文字可用区域都以形状边界为准。
  const shapeOf = shape => shape.shape || 'rect';
  const centerOf = shape => ({ x: shape.x + shape.w / 2, y: shape.y + shape.h / 2 });
  // 胶囊的脊线：横放时是水平线段，竖放时是垂直线段；形状 = 脊线 ⊕ 半径 R 的圆
  const spineOf = shape => shape.w >= shape.h
    ? { x1: shape.x + shape.h / 2, y1: shape.y + shape.h / 2, x2: shape.x + shape.w - shape.h / 2, y2: shape.y + shape.h / 2, r: shape.h / 2 }
    : { x1: shape.x + shape.w / 2, y1: shape.y + shape.w / 2, x2: shape.x + shape.w / 2, y2: shape.y + shape.h - shape.w / 2, r: shape.w / 2 };
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
    const half = { w: shape.w / 2 - inset, h: shape.h / 2 - inset };
    if (half.w <= 0 || half.h <= 0) return false;
    if (kind === 'diamond') return Math.abs(dx) / half.w + Math.abs(dy) / half.h <= 1;
    if (kind === 'ellipse') return (dx / half.w) ** 2 + (dy / half.h) ** 2 <= 1;
    return Math.abs(dx) < half.w && Math.abs(dy) < half.h;
  }
  // 把外接矩形上的目标点沿「中心→目标」方向推到形状边界：rect 的目标点本来就在边界上
  function boundary(shape, target) {
    const kind = shapeOf(shape);
    const c = centerOf(shape);
    const dx = target.x - c.x;
    const dy = target.y - c.y;
    if (kind === 'rect' || (!dx && !dy)) return { x: target.x, y: target.y };
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
  function anchor(shapes, reference) {
    const [id, rest = 'right'] = reference.split('@');
    const [side, ratioText] = rest.split(':');
    const shape = shapes.get(id);
    if (!shape) throw new Error(`连线引用了不存在的框：${id}`);
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
  // 箭头尖端与框边留 3px，出发端贴边
  function route(shapes, arrow, ring) {
    if (arrow.shape === 'orbit') return orbit(ring, shapes.get(arrow.from), shapes.get(arrow.to), 3, arrow.counter);
    const start = anchor(shapes, arrow.from);
    const end = anchor(shapes, arrow.to);
    const gap = arrow.size === 'sm' ? 1.5 : 3;
    const from = start.point;
    const to = { x: end.point.x + end.direction.x * gap, y: end.point.y + end.direction.y * gap };
    const inward = { x: -end.direction.x, y: -end.direction.y };
    if (arrow.shape === 'line') return `M ${from.x} ${from.y} L ${to.x} ${to.y}`;
    if (arrow.shape === 'elbow') {
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
    for (const [kind, color] of [['flow', '#111'], ['blocked', '#e0245e']]) {
      for (const [size, scale] of [['', 1], ['-sm', 0.55]]) {
        const marker = element('marker', { id: `${prefix}-head-${kind}${size}`, viewBox: '0 0 12 12', refX: '11', refY: '6', markerWidth: 18 * scale, markerHeight: 18 * scale, orient: 'auto', markerUnits: 'userSpaceOnUse' }, defs);
        element('path', { d: 'M 0 0.5 L 12 6 L 0 11.5 z', fill: color }, marker);
      }
    }
    const shadow = element('filter', { id: `${prefix}-shadow`, x: '-20%', y: '-20%', width: '140%', height: '140%' }, defs);
    element('feDropShadow', { dx: '0', dy: '2', stdDeviation: '5', 'flood-color': '#000', 'flood-opacity': '.12' }, shadow);

    const shapes = new Map();
    for (const group of slide.groups || []) shapes.set(group.id, group);
    for (const box of slide.boxes || []) shapes.set(box.id, box);

    for (const group of slide.groups || []) {
      const layer = element('g', { class: 'slide-group', 'data-id': group.id, opacity: group.dim ? 0.4 : null }, svg);
      element('rect', { x: group.x, y: group.y, width: group.w, height: group.h, rx: group.r ?? 22, class: 'slide-shape', fill: '#fff', stroke: group.status === 'error' ? '#e5484d' : '#1b1b1b', 'stroke-width': 1.5 }, layer);
      if (group.title) text(layer, group.x + group.w / 2, group.y + (group.titleY ?? 26), group.title, { class: 'slide-group-title' });
      if (group.card) element('rect', { x: group.card.x, y: group.card.y, width: group.card.w, height: group.card.h, rx: 10, class: 'slide-card', fill: '#fff', filter: `url(#${prefix}-shadow)` }, layer);
    }
    const arrowLayer = element('g', { class: 'slide-arrows' }, svg);
    const boxLayer = element('g', { class: 'slide-boxes' }, svg);
    const labelLayer = element('g', { class: 'slide-arrow-labels' }, svg);

    for (const box of slide.boxes || []) {
      const small = box.size === 'sm';
      const muted = box.status === 'muted';
      const kind = shapeOf(box);
      const center = centerOf(box);
      const layer = element('g', { class: `slide-box${small ? ' slide-box--sm' : ''}`, 'data-id': box.id, 'data-shape': kind, opacity: box.dim ? 0.4 : null }, boxLayer);
      const paint = {
        class: 'slide-shape', fill: muted ? fills.gray : fills[box.fill] || box.fill || fills.mint,
        stroke: muted ? '#9aa3ad' : box.status === 'error' ? '#e5484d' : 'none', 'stroke-width': muted ? 1.5 : 3, 'stroke-dasharray': muted ? '6 5' : null
      };
      if (kind === 'ellipse') element('ellipse', { cx: center.x, cy: center.y, rx: box.w / 2, ry: box.h / 2, ...paint }, layer);
      else if (kind === 'diamond') element('path', { d: `M ${center.x} ${box.y} L ${box.x + box.w} ${center.y} L ${center.x} ${box.y + box.h} L ${box.x} ${center.y} Z`, 'stroke-linejoin': 'round', ...paint }, layer);
      else element('rect', { x: box.x, y: box.y, width: box.w, height: box.h, rx: kind === 'pill' ? Math.min(box.w, box.h) / 2 : box.r ?? (small ? 6 : 20), ...paint }, layer);
      const cx = box.x + box.w / 2;
      const cy = box.y + box.h / 2;
      const hasValue = box.value !== undefined && box.value !== null && String(box.value) !== '' && !small;
      text(layer, cx, hasValue ? cy - 10 : cy, box.label, { class: `slide-box-label${muted ? ' is-muted' : ''}` });
      if (hasValue) text(layer, cx, cy + 15, box.value, { class: `slide-box-value${muted ? ' is-muted' : ''}` });
      const badge = badges[box.status];
      if (badge && !small) {
        const at = badgeCenter(box);
        element('circle', { cx: at.x, cy: at.y, r: 11, fill: badge.fill, stroke: '#fff', 'stroke-width': 2 }, layer);
        text(layer, at.x, at.y + badge.dy, badge.glyph, { class: 'slide-badge', fill: badge.ink });
      }
    }
    for (const arrow of slide.arrows || []) {
      const small = arrow.size === 'sm';
      const kind = arrow.kind === 'blocked' ? 'blocked' : 'flow';
      const path = element('path', {
        d: route(shapes, arrow, slide.ring), class: `slide-arrow slide-arrow--${kind}${small ? ' slide-arrow--sm' : ''}`,
        'marker-end': `url(#${prefix}-head-${kind}${small ? '-sm' : ''})`, opacity: arrow.dim ? 0.4 : null
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
    notes: [...all.notes, ...(part.notes || [])]
  }), { boxes: [], arrows: [], groups: [], notes: [] });

  window.Diagram = { render, fills, merge };
})();
