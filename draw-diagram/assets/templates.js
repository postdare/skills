// Fixed-geometry starting points; copy a template and adapt it to authoritative content.
window.DIAGRAM_TEMPLATES = {
  // 纯环 · 三节点：沿椭圆环轨顺时针
  ring3: {
    ring: { cx: 360, cy: 238, rx: 232, ry: 168 },
    boxes: [
      { id: 'a', x: 280, y: 39, w: 160, h: 62, fill: 'mint', label: '节点 A' },
      { id: 'b', x: 481, y: 291, w: 160, h: 62, fill: 'pink', label: '节点 B' },
      { id: 'c', x: 79, y: 291, w: 160, h: 62, fill: 'mintSoft', label: '节点 C' }
    ],
    arrows: [
      { from: 'a', to: 'b', shape: 'orbit' },
      { from: 'b', to: 'c', shape: 'orbit' },
      { from: 'c', to: 'a', shape: 'orbit', label: '下一轮', at: [146, 112] }
    ]
  },
  // 纯环 · 四节点：上右下左，侧边出、顶边进
  ring4: {
    boxes: [
      { id: 'a', x: 280, y: 24, w: 160, h: 70, fill: 'mint', label: '节点 A', value: '副标题' },
      { id: 'b', x: 520, y: 190, w: 160, h: 70, fill: 'pink', label: '节点 B' },
      { id: 'c', x: 280, y: 356, w: 160, h: 70, fill: 'mintSoft', label: '节点 C' },
      { id: 'd', x: 40, y: 190, w: 160, h: 70, fill: 'pinkSoft', label: '节点 D' }
    ],
    arrows: [
      { from: 'a@right', to: 'b@top', shape: 'arc', label: '指导', at: [604, 100] },
      { from: 'b@bottom', to: 'c@right', shape: 'arc' },
      { from: 'c@left', to: 'd@bottom', shape: 'arc' },
      { from: 'd@top', to: 'a@left', shape: 'arc', label: '回到起点', at: [96, 104] }
    ]
  },
  // 环 + 两个外挂：环居中偏右，外挂在左上、左下，各接一个环上节点
  ringSatellites: {
    boxes: [
      { id: 's1', x: 14, y: 24, w: 130, h: 70, fill: 'violetPale', label: '外挂一' },
      { id: 's2', x: 14, y: 356, w: 130, h: 70, fill: 'skyPale', label: '外挂二' },
      { id: 'a', x: 340, y: 24, w: 160, h: 70, fill: 'mint', label: '节点 A' },
      { id: 'b', x: 566, y: 190, w: 140, h: 70, fill: 'pink', label: '节点 B' },
      { id: 'c', x: 340, y: 356, w: 160, h: 70, fill: 'mintSoft', label: '节点 C' },
      { id: 'd', x: 166, y: 190, w: 140, h: 70, fill: 'pinkSoft', label: '节点 D' }
    ],
    arrows: [
      { from: 's1@right:0.3', to: 'a@left:0.3', shape: 'line', label: '引导', at: [242, 28] },
      { from: 's2@right:0.7', to: 'c@left:0.7', shape: 'line', label: '支撑', at: [242, 388] },
      { from: 'a@right', to: 'b@top', shape: 'arc' },
      { from: 'b@bottom', to: 'c@right', shape: 'arc' },
      { from: 'c@left:0.3', to: 'd@bottom', shape: 'arc' },
      { from: 'd@top', to: 'a@left:0.75', shape: 'arc', label: '读取', at: [214, 120] }
    ]
  },
  // 汇聚：三个来源左列竖排 → 中枢 → 输出
  fanIn: {
    boxes: [
      { id: 's1', x: 20, y: 40, w: 150, h: 66, fill: 'mintPale', label: '来源一' },
      { id: 's2', x: 20, y: 192, w: 150, h: 66, fill: 'violetPale', label: '来源二' },
      { id: 's3', x: 20, y: 344, w: 150, h: 66, fill: 'skyPale', label: '来源三' },
      { id: 'h', x: 290, y: 180, w: 170, h: 90, fill: 'pink', label: '中枢', value: '副标题' },
      { id: 'o', x: 550, y: 192, w: 150, h: 66, fill: 'mintSoft', label: '输出' }
    ],
    arrows: [
      { from: 's1@right', to: 'h@left:0.25', shape: 'arc', label: '前馈', at: [254, 128] },
      { from: 's2@right', to: 'h@left:0.5', shape: 'line' },
      { from: 's3@right', to: 'h@left:0.75', shape: 'arc' },
      { from: 'h@right', to: 'o@left', shape: 'line', label: '产出', at: [505, 208] }
    ]
  },
  // 汇聚 + 检查回流：中枢产出 → 检查 → 返工回中枢
  fanInLoop: {
    boxes: [
      { id: 's1', x: 20, y: 40, w: 150, h: 66, fill: 'mintPale', label: '来源一' },
      { id: 's2', x: 20, y: 192, w: 150, h: 66, fill: 'violetPale', label: '来源二' },
      { id: 's3', x: 20, y: 344, w: 150, h: 66, fill: 'skyPale', label: '来源三' },
      { id: 'h', x: 290, y: 180, w: 170, h: 90, fill: 'pink', label: '中枢' },
      { id: 'o', x: 550, y: 120, w: 150, h: 66, fill: 'mint', label: '产出' },
      { id: 'c', x: 550, y: 300, w: 150, h: 66, fill: 'mintSoft', label: '检查', status: 'error' }
    ],
    arrows: [
      { from: 's1@right', to: 'h@left:0.25', shape: 'arc' },
      { from: 's2@right', to: 'h@left:0.5', shape: 'line' },
      { from: 's3@right', to: 'h@left:0.75', shape: 'arc' },
      { from: 'h@right:0.3', to: 'o@left', shape: 'arc' },
      { from: 'o@bottom', to: 'c@top', shape: 'line', label: '检查', at: [637, 243], anchor: 'start' },
      { from: 'c@left', to: 'h@bottom:0.7', shape: 'arc', label: '返工', at: [478, 360] }
    ]
  },
  // 分叉：一个来源 → 三个去向右列竖排
  fanOut: {
    boxes: [
      { id: 's', x: 20, y: 180, w: 170, h: 90, fill: 'pink', label: '来源', value: '副标题' },
      { id: 't1', x: 530, y: 40, w: 160, h: 66, fill: 'mintSoft', label: '去向一' },
      { id: 't2', x: 530, y: 192, w: 160, h: 66, fill: 'amberPale', label: '去向二' },
      { id: 't3', x: 530, y: 344, w: 160, h: 66, fill: 'pinkPale', label: '去向三' }
    ],
    arrows: [
      { from: 's@right:0.25', to: 't1@left', shape: 'arc', label: '低', at: [470, 56] },
      { from: 's@right:0.5', to: 't2@left', shape: 'line', label: '中', at: [470, 208] },
      { from: 's@right:0.75', to: 't3@left', shape: 'arc', label: '高', at: [470, 352] }
    ]
  },
  // 直线链 · 四个：横排等距
  chain4: {
    boxes: [
      { id: 'a', x: 14, y: 190, w: 124, h: 70, fill: 'mintPale', label: '第一步' },
      { id: 'b', x: 203, y: 190, w: 124, h: 70, fill: 'mint', label: '第二步' },
      { id: 'c', x: 392, y: 190, w: 124, h: 70, fill: 'pink', label: '第三步' },
      { id: 'd', x: 581, y: 190, w: 124, h: 70, fill: 'mintSoft', label: '第四步' }
    ],
    arrows: [
      { from: 'a@right', to: 'b@left', shape: 'line', label: '交给', at: [170, 206] },
      { from: 'b@right', to: 'c@left', shape: 'line' },
      { from: 'c@right', to: 'd@left', shape: 'line' }
    ]
  },
  // 直线链 · 六个：上行左→右，下行右→左（蛇形）
  chainWrap: {
    boxes: [
      { id: 'a', x: 40, y: 60, w: 140, h: 70, fill: 'mintPale', label: '第一步' },
      { id: 'b', x: 290, y: 60, w: 140, h: 70, fill: 'mint', label: '第二步' },
      { id: 'c', x: 540, y: 60, w: 140, h: 70, fill: 'mint', label: '第三步' },
      { id: 'd', x: 540, y: 310, w: 140, h: 70, fill: 'pink', label: '第四步' },
      { id: 'e', x: 290, y: 310, w: 140, h: 70, fill: 'pinkSoft', label: '第五步' },
      { id: 'f', x: 40, y: 310, w: 140, h: 70, fill: 'mintSoft', label: '第六步' }
    ],
    arrows: [
      { from: 'a@right', to: 'b@left', shape: 'line' },
      { from: 'b@right', to: 'c@left', shape: 'line' },
      { from: 'c@bottom', to: 'd@top', shape: 'line', label: '转下一行', at: [624, 220], anchor: 'start' },
      { from: 'd@left', to: 'e@right', shape: 'line' },
      { from: 'e@left', to: 'f@right', shape: 'line' }
    ]
  },
  // 往返对：上弧去、下弧回
  pair: {
    boxes: [
      { id: 'a', x: 90, y: 180, w: 180, h: 90, fill: 'amber', label: '客户端', value: '请求' },
      { id: 'b', x: 450, y: 180, w: 180, h: 90, fill: 'pink', label: '服务端', value: '响应' }
    ],
    arrows: [
      { from: 'a@top:0.7', to: 'b@top:0.3', shape: 'arc', c1: [236, 90], c2: [484, 90], label: '交代', at: [360, 92] },
      { from: 'b@bottom:0.3', to: 'a@bottom:0.7', shape: 'arc', c1: [484, 360], c2: [236, 360], label: '反馈', at: [360, 358] }
    ]
  },
  // 并联：三行平行，行序按严重度或数据顺序
  lanes: {
    boxes: [
      { id: 'l1', x: 60, y: 40, w: 170, h: 66, fill: 'pink', label: '阻塞', value: '完整证据', status: 'error' },
      { id: 'l2', x: 60, y: 192, w: 170, h: 66, fill: 'amberSoft', label: '警告', value: '评估摘要', status: 'warn' },
      { id: 'l3', x: 60, y: 344, w: 170, h: 66, fill: 'gray', label: '信息', value: '默认静默', status: 'muted' },
      { id: 'r1', x: 490, y: 40, w: 170, h: 66, fill: 'mint', label: '必须修复' },
      { id: 'r2', x: 490, y: 192, w: 170, h: 66, fill: 'amberPale', label: '值得再改吗' },
      { id: 'r3', x: 490, y: 344, w: 170, h: 66, fill: 'gray', label: '按需查看', status: 'muted' }
    ],
    arrows: [
      { from: 'l1@right', to: 'r1@left', shape: 'line', label: '修复', at: [360, 56] },
      { from: 'l2@right', to: 'r2@left', shape: 'line', label: '评估', at: [360, 208] },
      { from: 'l3@right', to: 'r3@left', shape: 'line' }
    ]
  },
  // 时序 · 四个参与者：消息锚在生命线上，自上而下即时间顺序
  sequence: {
    boxes: [
      { id: 'p1', x: 24, y: 32, w: 140, h: 54, fill: 'violet', label: '参与者 A' },
      { id: 'p2', x: 200, y: 32, w: 140, h: 54, fill: 'sky', label: '参与者 B' },
      { id: 'p3', x: 376, y: 32, w: 140, h: 54, fill: 'amber', label: '参与者 C' },
      { id: 'p4', x: 552, y: 32, w: 140, h: 54, fill: 'pink', label: '参与者 D' }
    ],
    lifelines: [
      { of: 'p1', to: 404, end: true },
      { of: 'p2', to: 404, end: true },
      { of: 'p3', to: 404, end: true },
      { of: 'p4', to: 404, end: true }
    ],
    arrows: [
      { from: 'p1@life:140', to: 'p2@life:140', label: '消息一', at: [182, 124] },
      { from: 'p2@life:190', to: 'p3@life:190', label: '消息二', at: [358, 174] },
      { from: 'p3@life:240', to: 'p1@life:240', label: '消息三', at: [358, 224] },
      { from: 'p2@life:290', to: 'p2@life:340', bend: 70, label: '自处理', at: [305, 315] }
    ]
  },
  // 泳道 · 三条：全宽 group 横铺满画布，流程跨道上下走
  swimlane3: {
    groups: [
      { id: 'lane1', x: 14, y: 14, w: 692, h: 130, title: '角色 A', titleY: 22 },
      { id: 'lane2', x: 14, y: 160, w: 692, h: 130, title: '角色 B', titleY: 22 },
      { id: 'lane3', x: 14, y: 306, w: 692, h: 130, title: '角色 C', titleY: 22 }
    ],
    boxes: [
      { id: 'a', x: 110, y: 50, w: 150, h: 62, fill: 'mint', label: '第一步' },
      { id: 'b', x: 110, y: 196, w: 150, h: 62, fill: 'violet', label: '第二步' },
      { id: 'c', x: 110, y: 342, w: 150, h: 62, fill: 'pink', label: '第三步' }
    ],
    arrows: [
      { from: 'a@bottom', to: 'b@top', shape: 'line' },
      { from: 'b@bottom', to: 'c@top', shape: 'line', label: '交给', at: [203, 304], anchor: 'start' }
    ]
  },
  // 漏斗 · 四段：trapezoid 居中堆叠，宽度按约 0.76 倍递减使下缘与下一段上缘连续
  funnel4: {
    boxes: [
      { id: 's1', x: 160, y: 76, w: 400, h: 64, fill: 'violet', shape: 'trapezoid', label: '第一段', value: '量级' },
      { id: 's2', x: 208, y: 154, w: 304, h: 64, fill: 'sky', shape: 'trapezoid', label: '第二段' },
      { id: 's3', x: 244, y: 232, w: 232, h: 64, fill: 'mint', shape: 'trapezoid', label: '第三段' },
      { id: 's4', x: 272, y: 310, w: 176, h: 64, fill: 'amber', shape: 'trapezoid', label: '第四段' }
    ],
    arrows: [
      { from: 's1@bottom', to: 's2@top', shape: 'line', label: '转化', at: [378, 150], anchor: 'start' },
      { from: 's2@bottom', to: 's3@top', shape: 'line' },
      { from: 's3@bottom', to: 's4@top', shape: 'line' }
    ]
  }
};
