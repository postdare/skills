(() => {
  'use strict';
  const rectOf = element => {
    const box = element.getBBox();
    return { left: box.x, top: box.y, right: box.x + box.width, bottom: box.y + box.height };
  };
  const rectAttr = rect => {
    const x = Number(rect.getAttribute('x'));
    const y = Number(rect.getAttribute('y'));
    return { left: x, top: y, right: x + Number(rect.getAttribute('width')), bottom: y + Number(rect.getAttribute('height')) };
  };
  const overlaps = (a, b, pad = 0) => a.left + pad < b.right && b.left + pad < a.right && a.top + pad < b.bottom && b.top + pad < a.bottom;
  const contains = (r, p, inset = 0) => p.x > r.left + inset && p.x < r.right - inset && p.y > r.top + inset && p.y < r.bottom - inset;
  const idOf = reference => reference.split('@')[0];

  function geometry(svg, slide) {
    const errors = [];
    const hints = [];
    const width = slide.w || 720;
    const height = slide.h || 450;
    const boxes = [...svg.querySelectorAll('.slide-box')].map(g => ({ id: g.dataset.id, rect: rectAttr(g.querySelector('rect')), texts: [...g.querySelectorAll('.slide-box-label, .slide-box-value')], badge: g.querySelector('circle'), badgeText: g.querySelector('text.slide-badge'), small: g.classList.contains('slide-box--sm') }));
    const groups = [...svg.querySelectorAll('.slide-group')].map(g => ({ id: g.dataset.id, rect: rectAttr(g.querySelector('rect')), title: g.querySelector('.slide-group-title'), card: g.querySelectorAll('rect')[1] }));
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
        if (r.left < box.rect.left + 6 || r.right > box.rect.right - 6 || r.top < box.rect.top + 2 || r.bottom > box.rect.bottom - 2) errors.push(`文字溢出：${box.id}「${text.textContent}」`);
        if (badge && overlaps(r, badge, -2)) errors.push(`角标压字：${box.id}「${text.textContent}」，框宽至少加到 字宽 + 70`);
      }
      if (!inCanvas(box.rect)) errors.push(`越界：${box.id}`);
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
      if (overlaps(boxes[a].rect, boxes[b].rect)) errors.push(`框重叠：${boxes[a].id} / ${boxes[b].id}`);
    }
    (slide.arrows || []).forEach((arrow, index) => {
      const { length, points } = samples[index];
      const ends = new Set([idOf(arrow.from), idOf(arrow.to)]);
      const name = `${idOf(arrow.from)}→${idOf(arrow.to)}`;
      for (const box of boxes) if (!ends.has(box.id) && points.some(p => contains(box.rect, p, 2))) errors.push(`穿框：${name} 穿过 ${box.id}`);
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
      for (const box of boxes) if (overlaps(label.rect, box.rect, 1)) errors.push(`标签压框：「${label.text}」压 ${box.id}`);
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
      if (!inCanvas(group.rect)) errors.push(`越界：容器 ${group.id}`);
      if (!group.title) continue;
      const title = rectOf(group.title);
      for (const box of boxes) if (overlaps(title, box.rect)) errors.push(`标题被挡：容器 ${group.id} 的标题压 ${box.id}`);
      if (group.card && overlaps(title, rectAttr(group.card))) errors.push(`标题被挡：容器 ${group.id} 的标题压卡片`);
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
      if (statusOf(shape) !== statusOf(node)) {
        errors.push(`Different status: ${node.id}; content ${statusOf(node) || 'none'}, diagram ${statusOf(shape) || 'none'}`);
      }
    }
    for (const shape of shapes.values()) {
      if (shape.size !== 'sm' && !expected.has(shape.id)) errors.push(`Extra main node: ${shape.id}`);
    }
    // Each occurrence consumes one matching arrow, preserving parallel-edge multiplicity.
    const keyOf = edge => JSON.stringify([idOf(edge.from), idOf(edge.to), normalize(edge.label), kindOf(edge)]);
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
