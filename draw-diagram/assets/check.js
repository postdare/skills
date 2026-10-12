(() => {
  'use strict';
  const rectOf = element => {
    const box = element.getBBox();
    return { left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height };
  };
  const overlaps = (a, b, pad = 0) => a.left + pad < b.right && b.left + pad < a.right && a.top + pad < b.bottom && b.top + pad < a.bottom;
  const contains = (r, p, inset = 0) => p.x > r.left + inset && p.x < r.right - inset && p.y > r.top + inset && p.y < r.bottom - inset;
  const idOf = reference => reference.split('@')[0];

  // 形状几何：一律用外接矩形 frame 表示；rect/pill 之外按解析式判断内缩、边界距离与外轮廓。
  // 渲染端 assets/diagram.js 用同一套规则决定锚点与角标，改一处必须同步另一处。
  const halfOf = frame => ({ w: (frame.right - frame.left) / 2, h: (frame.bottom - frame.top) / 2 });
  const centerOf = frame => ({ x: (frame.left + frame.right) / 2, y: (frame.top + frame.bottom) / 2 });
  const spineOf = frame => {
    const half = halfOf(frame);
    const center = centerOf(frame);
    const r = Math.min(half.w, half.h);
    return half.w >= half.h
      ? { x1: frame.left + r, y1: center.y, x2: frame.right - r, y2: center.y, r }
      : { x1: center.x, y1: frame.top + r, x2: center.x, y2: frame.bottom - r, r };
  };
  // 点到边界的有符号距离（正数表示在内侧）：rect/pill/diamond 精确，ellipse 用一阶近似
  const clearance = (shape, frame, p) => {
    const half = halfOf(frame);
    const center = centerOf(frame);
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    if (!half.w || !half.h) return -Infinity;
    if (shape === 'diamond') return (1 - (Math.abs(dx) / half.w + Math.abs(dy) / half.h)) / Math.hypot(1 / half.w, 1 / half.h);
    if (shape === 'ellipse' || shape === 'initial' || shape === 'final') {
      const radial = Math.hypot(dx / half.w, dy / half.h);
      const gradient = Math.hypot(dx / half.w ** 2, dy / half.h ** 2);
      return gradient ? (1 - radial) * radial / gradient : Math.min(half.w, half.h);
    }
    if (shape === 'trapezoid') {
      // 梯形：上边缘全宽，下边缘两侧各内缩 w*0.12。点到四条边取朝内法线的垂直距离，最小值即 clearance
      const points = outline(shape, frame);
      let best = Infinity;
      for (let index = 0; index < points.length; index++) {
        const a = points[index];
        const b = points[(index + 1) % points.length];
        const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const nx = -(b.y - a.y) / length;
        const ny = (b.x - a.x) / length;
        const inward = (center.x - a.x) * nx + (center.y - a.y) * ny > 0 ? 1 : -1;
        best = Math.min(best, inward * ((p.x - a.x) * nx + (p.y - a.y) * ny));
      }
      return best;
    }
    if (shape === 'pill') {
      const spine = spineOf(frame);
      const u = Math.max(spine.x1, Math.min(p.x, spine.x2));
      const v = Math.max(spine.y1, Math.min(p.y, spine.y2));
      return spine.r - Math.hypot(p.x - u, p.y - v);
    }
    return Math.min(p.x - frame.left, frame.right - p.x, p.y - frame.top, frame.bottom - p.y);
  };
  const insideShape = (shape, frame, p, inset = 0) => shape === 'rect'
    ? contains(frame, p, inset)
    : clearance(shape, frame, p) > inset;
  // 凸多边形采样：形状之间、标签与形状之间按真实轮廓求交，而不是外接矩形
  const outline = (shape, frame) => {
    const half = halfOf(frame);
    const center = centerOf(frame);
    if (shape === 'ellipse' || shape === 'initial' || shape === 'final') return Array.from({ length: 32 }, (_, index) => {
      const angle = index / 32 * Math.PI * 2;
      return { x: center.x + half.w * Math.cos(angle), y: center.y + half.h * Math.sin(angle) };
    });
    if (shape === 'diamond') return [{ x: center.x, y: frame.top }, { x: frame.right, y: center.y }, { x: center.x, y: frame.bottom }, { x: frame.left, y: center.y }];
    if (shape === 'trapezoid') {
      const inset = (frame.right - frame.left) * 0.12;
      return [{ x: frame.left, y: frame.top }, { x: frame.right, y: frame.top }, { x: frame.right - inset, y: frame.bottom }, { x: frame.left + inset, y: frame.bottom }];
    }
    if (shape === 'pill') {
      const spine = spineOf(frame);
      const caps = spine.y1 === spine.y2
        ? [[spine.x2, spine.y1, -Math.PI / 2], [spine.x1, spine.y2, Math.PI / 2]]
        : [[spine.x1, spine.y2, 0], [spine.x2, spine.y1, Math.PI]];
      const points = [];
      for (const [cx, cy, start] of caps) for (let index = 0; index <= 8; index++) {
        const angle = start + Math.PI * index / 8;
        points.push({ x: cx + spine.r * Math.cos(angle), y: cy + spine.r * Math.sin(angle) });
      }
      return points;
    }
    return [{ x: frame.left, y: frame.top }, { x: frame.right, y: frame.top }, { x: frame.right, y: frame.bottom }, { x: frame.left, y: frame.bottom }];
  };
  // 凸多边形分离轴判定：矩形之间与旧的矩形重叠判定一致，菱形/椭圆的空角不再算作相交
  const convexOverlap = (a, b) => {
    const separated = (polygon, other) => {
      for (let index = 0; index < polygon.length; index++) {
        const from = polygon[index];
        const to = polygon[(index + 1) % polygon.length];
        const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
        const axis = { x: -(to.y - from.y) / length, y: (to.x - from.x) / length };
        const project = points => points.map(point => point.x * axis.x + point.y * axis.y);
        const one = project(polygon);
        const two = project(other);
        if (Math.min(...one) > Math.max(...two) + 1e-6 || Math.min(...two) > Math.max(...one) + 1e-6) return true;
      }
      return false;
    };
    return !separated(a, b) && !separated(b, a);
  };
  const textCorners = r => [{ x: r.left, y: r.top }, { x: r.right, y: r.top }, { x: r.right, y: r.bottom }, { x: r.left, y: r.bottom }];

  function geometry(svg, slide) {
    const errors = [];
    const hints = [];
    const width = slide.w || 720;
    const height = slide.h || 450;
    const boxes = [...svg.querySelectorAll('.slide-box')].map(g => ({
      id: g.dataset.id, shape: g.dataset.shape || 'rect', frame: rectOf(g.querySelector('.slide-shape')),
      texts: [...g.querySelectorAll('.slide-box-label, .slide-box-value, .slide-box-member')], badge: g.querySelector('.slide-badge-dot'), badgeText: g.querySelector('text.slide-badge'), small: g.classList.contains('slide-box--sm')
    }));
    const groups = [...svg.querySelectorAll('.slide-group')].map(g => ({ id: g.dataset.id, frame: rectOf(g.querySelector('.slide-shape')), title: g.querySelector('.slide-group-title'), card: g.querySelector('.slide-card') }));
    const paths = [...svg.querySelectorAll('.slide-arrow')];
    const labels = [...svg.querySelectorAll('.slide-arrow-label')].map(element => ({ text: element.textContent, rect: rectOf(element) }));
    const samples = paths.map(path => {
      const length = path.getTotalLength();
      return { length, points: Array.from({ length: 81 }, (_, k) => path.getPointAtLength(length * k / 80)) };
    });
    const inCanvas = r => r.left >= -1 && r.top >= -1 && r.right <= width + 1 && r.bottom <= height + 1;

    for (const box of boxes) {
      const badge = box.badge && rectOf(box.badge);
      for (const text of box.texts) {
        const r = rectOf(text);
        // rect/pill 沿用矩形规则（左右 6、上下 2）；diamond/ellipse 按文字外框四角到形状边界的距离判定，
        // 不能只看外接矩形——菱形的四个空角会让「看起来放得下」的文字压到边上。
        const overflow = box.shape === 'rect' || box.shape === 'pill'
          ? r.left < box.frame.left + 6 || r.right > box.frame.right - 6 || r.top < box.frame.top + 2 || r.bottom > box.frame.bottom - 2
          : textCorners(r).some(corner => clearance(box.shape, box.frame, corner) < 4);
        if (overflow) errors.push(`文字溢出：${box.id}「${text.textContent}」${box.shape === 'rect' || box.shape === 'pill' ? '' : `——${box.shape} 的可用区域是内接形状，四角到边界需 ≥ 4px，加宽/加高框或缩小字号`}`);
        if (badge && overlaps(r, badge, -2)) errors.push(`角标压字：${box.id}「${text.textContent}」，框宽至少加到 字宽 + 70`);
      }
      // 角标必须完全落在形状内侧，菱形/椭圆的右上角是空的，位置由渲染端按形状给
      if (box.badge) {
        const radius = Number(box.badge.getAttribute('r'));
        const gap = clearance(box.shape, box.frame, { x: Number(box.badge.getAttribute('cx')), y: Number(box.badge.getAttribute('cy')) });
        if (gap < radius) errors.push(`角标出框：${box.id} 角标圆心离形状边界 ${gap.toFixed(1)}px，需 ≥ ${radius}px（加大框或改小角标）`);
      }
      if (!inCanvas(box.frame)) errors.push(`越界：${box.id}`);
    }
    // 角标字形光学居中：`.slide text` 的 dominant-baseline: central 对齐的是 em 盒中心，而字形墨迹在 em 盒里并不居中，
    // assets/diagram.js 的 badges 表用 dy 补偿。这里按 .slide-badge 的实际字体量出墨迹相对 em 中心的下偏量，和 dy 对差；
    // 换字体栈后墨迹下偏量会变，这条就会报错提醒重新量 dy（不要直接放宽阈值）。
    const glyphCtx = document.createElement('canvas').getContext('2d');
    for (const box of boxes) {
      if (!box.badgeText) continue;
      const style = getComputedStyle(box.badgeText);
      glyphCtx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      const metrics = glyphCtx.measureText(box.badgeText.textContent);
      if (metrics.fontBoundingBoxAscent === undefined || metrics.actualBoundingBoxAscent === undefined) continue;
      const inkBelowEm = ((metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) - (metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent)) / 2;
      const offset = (Number(box.badgeText.getAttribute('y')) - Number(box.badge.getAttribute('cy'))) + inkBelowEm;
      if (Math.abs(offset) > 1) errors.push(`角标未居中：${box.id}「${box.badgeText.textContent}」墨迹中心离圆心 ${offset.toFixed(2)}px（改 assets/diagram.js 的 badges.dy）`);
    }
    for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
      if (convexOverlap(outline(boxes[a].shape, boxes[a].frame), outline(boxes[b].shape, boxes[b].frame))) errors.push(`框重叠：${boxes[a].id} / ${boxes[b].id}`);
    }
    (slide.arrows || []).forEach((arrow, index) => {
      const { length, points } = samples[index];
      const ends = new Set([idOf(arrow.from), idOf(arrow.to)]);
      const name = `${idOf(arrow.from)}→${idOf(arrow.to)}`;
      for (const box of boxes) if (!ends.has(box.id) && points.some(p => insideShape(box.shape, box.frame, p, 2))) errors.push(`穿框：${name} 穿过 ${box.id}`);
      if (length < (arrow.size === 'sm' ? 12 : 28)) errors.push(`短边：${name} 仅 ${Math.round(length)}px`);
      // 斜线：直线几乎横平竖直却差了几度，多半是两端框没对齐
      if (arrow.shape === 'line') {
        const first = points[0];
        const last = points[points.length - 1];
        const angle = Math.abs(Math.atan2(last.y - first.y, last.x - first.x) * 180 / Math.PI) % 90;
        const off = Math.min(angle, 90 - angle);
        if (off > 0.5 && off < 10) errors.push(`斜线：${name} 偏离横平竖直 ${off.toFixed(1)}°，对齐两端坐标`);
      }
      // 箭头折角：箭头头部底下（末端 18px 内）线的方向变化过大，看起来像被掰弯
      if (arrow.size !== 'sm' && length > 30) {
        const path = paths[index];
        const at = d => path.getPointAtLength(Math.max(0, length - d));
        const heading = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
        const turn = Math.abs(((heading(at(2), at(0)) - heading(at(24), at(18))) * 180 / Math.PI + 540) % 360 - 180);
        if (turn > 25) errors.push(`箭头折角：${name} 末端转了 ${Math.round(turn)}°，箭头要落在直的一段上`);
      }
      if (points.some(p => p.x < -1 || p.y < -1 || p.x > width + 1 || p.y > height + 1)) errors.push(`越界：连线 ${name}`);
    });
    // 边标签按箭头顺序渲染：第 k 个标签属于第 k 支带 label 的箭头
    const owners = (slide.arrows || []).map((arrow, index) => (arrow.label ? index : null)).filter(index => index !== null);
    labels.forEach((label, k) => {
      const owner = owners[k];
      const name = owner === undefined ? '' : `${idOf(slide.arrows[owner].from)}→${idOf(slide.arrows[owner].to)}`;
      const halo = { left: label.rect.left - 3, top: label.rect.top - 3, right: label.rect.right + 3, bottom: label.rect.bottom + 3 };
      for (const box of boxes) if (convexOverlap(outline('rect', { left: label.rect.left - 1, top: label.rect.top - 1, right: label.rect.right + 1, bottom: label.rect.bottom + 1 }), outline(box.shape, box.frame))) errors.push(`标签压框：「${label.text}」压 ${box.id}`);
      for (const group of groups) if (group.title && overlaps(label.rect, rectOf(group.title))) errors.push(`标签压标题：「${label.text}」`);
      samples.forEach(({ points }, index) => {
        if (points.some(p => contains(halo, p))) errors.push(`标签压线：「${label.text}」离 ${idOf(slide.arrows[index].from)}→${idOf(slide.arrows[index].to)} 不足 3px`);
      });
      if (owner !== undefined) {
        const { length, points } = samples[owner];
        const gap = Math.min(...points.map(p => Math.hypot(Math.max(label.rect.left - p.x, 0, p.x - label.rect.right), Math.max(label.rect.top - p.y, 0, p.y - label.rect.bottom))));
        if (gap > 30) errors.push(`标签离线太远：「${label.text}」离 ${name} ${Math.round(gap)}px（应 ≤ 30）`);
        if (length < label.rect.right - label.rect.left + 24) errors.push(`标签放不下：「${label.text}」比 ${name} 的线长（${Math.round(length)}px）还宽，拉开两框或缩短标签`);
      }
      if (!inCanvas(label.rect)) errors.push(`越界：标签「${label.text}」`);
    });
    for (let a = 0; a < labels.length; a++) for (let b = a + 1; b < labels.length; b++) {
      if (overlaps(labels[a].rect, labels[b].rect)) errors.push(`标签互压：「${labels[a].text}」/「${labels[b].text}」`);
    }
    for (const group of groups) {
      if (!inCanvas(group.frame)) errors.push(`越界：容器 ${group.id}`);
      if (!group.title) continue;
      const title = rectOf(group.title);
      for (const box of boxes) if (overlaps(title, box.frame)) errors.push(`标题被挡：容器 ${group.id} 的标题压 ${box.id}`);
      if (group.card && overlaps(title, rectOf(group.card))) errors.push(`标题被挡：容器 ${group.id} 的标题压卡片`);
    }
    return { errors, hints };
  }

  // Ignore line wrapping and whitespace only, not punctuation or words.
  const normalize = value => String(value ?? '').replace(/\s+/g, '');
  const statusOf = node => node.status || '';
  const kindOf = edge => edge.kind || 'flow';

  function semantic(diagram, content) {
    const errors = [];
    const hints = [];
    const shapes = new Map();
    for (const shape of [
      ...(diagram.groups || []).map(group => ({ ...group, label: group.title })),
      ...(diagram.boxes || [])
    ]) {
      if (shapes.has(shape.id)) errors.push(`Duplicate diagram node: ${shape.id}`);
      shapes.set(shape.id, shape);
    }
    const expected = new Map();
    for (const node of content.nodes || []) {
      if (expected.has(node.id)) errors.push(`Duplicate content node: ${node.id}`);
      expected.set(node.id, node);
      const shape = shapes.get(node.id);
      if (!shape || shape.size === 'sm') {
        errors.push(`Missing main node: ${node.id} (${node.label})`);
        continue;
      }
      for (const field of ['label', 'value']) {
        if (normalize(shape[field]) !== normalize(node[field])) {
          errors.push(`Different ${field}: ${node.id}; content “${node[field] ?? ''}”, diagram “${shape[field] ?? ''}”`);
        }
      }
      // fields/methods 数组逐元素比对（去全部空白）；未声明与空数组等价
      for (const list of ['fields', 'methods']) {
        const inDiagram = (shape[list] || []).map(normalize);
        const inContent = (node[list] || []).map(normalize);
        if (inDiagram.length !== inContent.length || inDiagram.some((item, index) => item !== inContent[index])) {
          errors.push(`Different ${list}: ${node.id}; content [${(node[list] || []).join(', ')}], diagram [${(shape[list] || []).join(', ')}]`);
        }
      }
      if (statusOf(shape) !== statusOf(node)) {
        errors.push(`Different status: ${node.id}; content ${statusOf(node) || 'none'}, diagram ${statusOf(shape) || 'none'}`);
      }
    }
    for (const shape of shapes.values()) {
      if (shape.size !== 'sm' && !expected.has(shape.id)) errors.push(`Extra main node: ${shape.id}`);
    }
    // Each occurrence consumes one matching arrow, preserving parallel-edge multiplicity.
    // start（compose/aggregate 起点菱形）与 kind 一样是语义属性，两端必须一致
    const startOf = edge => edge.start || '';
    const keyOf = edge => JSON.stringify([idOf(edge.from), idOf(edge.to), normalize(edge.label), kindOf(edge), startOf(edge)]);
    const drawn = new Map();
    for (const arrow of diagram.arrows || []) {
      if (arrow.size === 'sm') continue;
      const key = keyOf(arrow);
      drawn.set(key, (drawn.get(key) || 0) + 1);
    }
    for (const edge of content.edges || []) {
      const key = keyOf(edge);
      const count = drawn.get(key) || 0;
      if (!count) errors.push(`Missing edge: ${edge.from}→${edge.to} [${edge.label ?? ''}; ${kindOf(edge)}]`);
      else drawn.set(key, count - 1);
    }
    for (const [key, count] of drawn) {
      if (!count) continue;
      const [from, to, label, kind] = JSON.parse(key);
      errors.push(`Extra edge: ${from}→${to} [${label}; ${kind}] ×${count}`);
    }
    return { errors, hints };
  }

  window.DiagramCheck = { geometry, semantic };
})();
