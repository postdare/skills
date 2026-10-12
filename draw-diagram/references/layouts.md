# Layout selection

Choose a starting point by relationship shape, then replace IDs, labels, values and statuses from authoritative content. `assets/templates.js` exposes `window.DIAGRAM_TEMPLATES`; these are geometry starting points, not semantic sources or a guarantee that edited text will fit.

| Template | Relationship shape | Engineering/business use |
| --- | --- | --- |
| `ring3` | Three-node elliptical cycle | Collect → evaluate → adjust |
| `ring4` | Four-node cycle with directional anchor curves | Plan → deliver → inspect → improve |
| `ringSatellites` | Four-node cycle plus two outside inputs | Workflow with policy and resource inputs |
| `fanIn` | Three sources → hub → output | Events from several systems aggregated into a report |
| `fanInLoop` | Aggregation with downstream review and return | Assembly, quality gate and rework |
| `fanOut` | One source → three destinations | Dispatch requests to independent consumers |
| `chain4` | Four-stage horizontal chain | Intake, validate, fulfill, archive |
| `chainWrap` | Six-stage wrapped chain | A long process across two rows |
| `pair` | Two participants with separate outbound/return curves | Client request and server response |
| `lanes` | Three independent parallel relationships | Triage routes by severity |
| `swimlane3` | One flow handed across three role lanes | Approval routed through submitter, reviewer, finance |
| `funnel4` | Four shrinking stages in a vertical stack | Conversion from exposure to payment |

For five or more cycle nodes, position centers on an ellipse and use `ring` + `orbit`; forcing all edges into four-corner arc routes produces hooks. All orbit arrows in one diagram share the same ring. For a second ring inside the first, use explicit arc controls or the small illustration pattern below.

## Nested groups: deployment boundaries

Nested groups are rectangles drawn in array order, not a containment engine. Supply absolute positions, outer group first, and keep each group title clear. This example models a platform boundary with two service boundaries. All three group titles and the four main boxes belong in `content.nodes`; the two main arrows belong in `content.edges`.

```js
const diagram = {
  groups: [
    { id: 'platform', x: 20, y: 20, w: 680, h: 410, title: 'Commerce platform', titleY: 22 },
    { id: 'orders', x: 50, y: 90, w: 260, h: 285, title: 'Order service', titleY: 22 },
    { id: 'warehouse', x: 410, y: 90, w: 260, h: 285, title: 'Warehouse', titleY: 22 }
  ],
  boxes: [
    { id: 'accepted', x: 90, y: 150, w: 180, h: 66, label: 'Accepted', fill: 'mint' },
    { id: 'confirmed', x: 90, y: 270, w: 180, h: 66, label: 'Confirmed', fill: 'mintSoft' },
    { id: 'reserved', x: 450, y: 150, w: 180, h: 66, label: 'Reserved', fill: 'pink' },
    { id: 'shipped', x: 450, y: 270, w: 180, h: 66, label: 'Shipped', fill: 'pinkSoft' }
  ],
  arrows: [
    { from: 'accepted@right', to: 'reserved@left', shape: 'line', label: 'reserve', at: [360, 167] },
    { from: 'shipped@left', to: 'confirmed@right', shape: 'line', label: 'confirm', at: [360, 287] }
  ]
};
```

If the source has only the four states, do not invent three semantic boundary nodes to use this layout. Either record the boundaries as source-approved nodes or choose a simpler layout without named groups. Cards and notes can support composition without entering semantic matching.

## Outer cycle with an inner illustration

Start with `ring4`, replacing its placeholder labels with the source cycle. The central group is a main semantic node named `operations`. Its small internal boxes and arrows illustrate a mechanism, so they are exempt from main-node/edge matching. Keep illustration wording grounded in the supplied explanation.

```js
const illustration = {
  groups: [
    { id: 'operations', x: 260, y: 150, w: 200, h: 150,
      title: 'Operations', titleY: 17,
      card: { x: 270, y: 181, w: 180, h: 108 } }
  ],
  boxes: [
    { id: 'detail-read', x: 324, y: 185, w: 72, h: 25, label: 'Read', fill: 'mint', size: 'sm' },
    { id: 'detail-check', x: 365, y: 248, w: 72, h: 25, label: 'Check', fill: 'pink', size: 'sm' },
    { id: 'detail-save', x: 283, y: 248, w: 72, h: 25, label: 'Save', fill: 'violetSoft', size: 'sm' }
  ],
  arrows: [
    { from: 'detail-read@right', to: 'detail-check@top', shape: 'arc', size: 'sm' },
    { from: 'detail-check@left', to: 'detail-save@right', shape: 'line', size: 'sm' },
    { from: 'detail-save@top', to: 'detail-read@left', shape: 'arc', size: 'sm' }
  ]
};
const diagram = Diagram.merge(DIAGRAM_TEMPLATES.ring4, illustration);
```

For a true inner cycle with source-required nodes, use normal-size boxes and include every node/edge in content. Increase the canvas or simplify the outer cycle rather than shrinking business facts into an exempt illustration. These examples demonstrate composition; run the normal geometry and visual checks after adapting them.

## Sequence style: participants over time

Use it when the relationship is a **message exchange ordered in time** between fixed participants — protocol handshakes, request/response pairs, retry ladders. Time runs down the frame; each participant is a header box with a dashed lifeline, and every message is an arrow anchored to two lifelines.

Start from `DIAGRAM_TEMPLATES.sequence` and replace its placeholders:

```js
const diagram = Diagram.merge(DIAGRAM_TEMPLATES.sequence, {
  lifelines: [ { of: 'client', to: 420, end: true }, /* 一位参与者一行 */ ],
  arrows: [ { from: 'client@life:150', to: 'authz@life:150', label: '① 请求', at: [372, 134] } ]
});
```

Rules that keep a sequence frame readable:

- **The message `y` is the timeline.** Number the messages in source order and place them strictly increasing; ~46 units apart leaves room for a 14px label plus clearance.
- **Anchor every message on lifelines** (`id@life:<y>`), never on box edges — a box anchor makes the arrow leave the participant header instead of the timeline.
- **Requests are `flow`, responses are `reply`.** Solid line + filled arrowhead going out, dashed line + open arrowhead coming back, is the UML interaction convention and it makes the request/response pairing readable at a glance. A message that is itself asynchronous (fire-and-forget) is `async` (solid line, open arrowhead). Set the same `kind` in `content.edges` and `diagram.arrows`.
- **Labels sit 16–20 above their own line, centred between the two lifelines**, placed explicitly with `at`. A label must stay ≥3px clear of every arrow path, its own included.
- **Crossing lifelines is expected.** A message between non-adjacent participants crosses the ones in between; keep those participants in place rather than shortening the message.
- **Keep the same lifelines in every frame.** Across related frames hold the participants in identical x columns, and keep a participant this phase does not use as a `dim: true` gray box instead of deleting it — otherwise the reader must re-locate every participant between frames.
- **Self-messages** (`p@life:y1` → `p@life:y2`) loop to the right; leave ~50 of vertical room so the loop and its label clear their neighbours. A self-message that carries a label needs a wider loop — `bend: 70` — so the label fits inside it; the default 44 leaves no room and the label lands on the loop's vertical.
- **Width:** four participants need roughly 940×400 and up; the default 720×450 canvas fits three comfortably.
- Lifelines are decoration, never nodes: they carry no `content` entry, and the geometry checker ignores them (a message crossing a lifeline is not a defect).

### Advanced sequence frames: activations, fragments, footers

For a call that shows execution periods, conditional/parallel fragments, participant footer boxes and an object created mid-interaction, keep the sequence rules above and add the sequence decorations from [frame-format.md](frame-format.md):

- **Activation bars** (`diagram.activations: [{of, from, to, at?}]`) mark the window in which a participant is executing. `of` must be a node that already declares a lifeline, and `from < to` (both throw otherwise). Bars are 14 wide, centred on the lifeline, drawn under the arrows so message endpoints land on the bar's centre line. **Nesting is expressed by the coordinates alone**: an inner call's bar must end before the outer bar does, and a bar longer than a frame's worth of messages is a defect in the drawing, not the renderer. Give the controller and the service each at least one bar of a different length; a participant with no bar is simply idle during that interval.
- **Participant footers** (`lifelines: [{of, foot: y}]`) duplicate the participant box at the bottom of its axis: the guide stops at `foot`, and a visual copy with the same `x/w/h/fill/label/icon/shape` is drawn with its top edge at that y. It is the cheapest way to close a long timeline — the reader gets the same box top and bottom and never has to re-identify a column. Use one shared `foot` for every participant so the copies form a straight bottom row, keep each participant's two boxes at the same `x/w`, and size the canvas so the row has ~30 units of margin below it. The copy is decoration (`slide-foot*` classes, invisible to the checker), so a message may end on it with `@life:<foot>` without any crossing error — in fact that is the intended reading: the last message arrives at the footer box.
- **Multi-operand fragments** (`fragments[].sections: [{guard?}]`) divide one frame into N operands: the band under the tab is split into N equal segments with **dashed** divider lines, and each segment carries its own left-aligned guard. A `par` with two `sections` is the standard way to show two branches happening in parallel; **a top-level `guard` is ignored when `sections` is present**, so put the conditions on the sections instead. Budget each segment as `h/N ≥ 44 + message room`: the section guard sits 26 below its segment top, and the first message of the segment needs ~18 more.
- **Dashed frames** (`fragments[].dashed: true`) draw the outline as `stroke-dasharray: 9 7`, the usual cue for a tentative or secondary region. It changes only the line style, so the guard/op budgets are unchanged. Use it when the frame is a secondary annotation rather than a primary control-flow panel.
- **Self-action illustration.** An action that a participant performs internally is *not* a message, so do not invent an edge for it: draw a small box (`size: "sm"`) beside that participant's lifeline, mid-frame, with the action wording as its label and a warm fill (e.g. `amber`) to mark it as an aside. A `sm` box is exempt from semantic node comparison and its arrows (if any, also `size: "sm"`) are exempt from edge comparison — it illustrates mechanics without asserting a new business fact. Keep it out of `content`, clear of the fragment frames, and away from the lifeline's own message labels.
- **Runtime-created object.** Draw it as an ordinary box with its literal name as the label (`订单对象\norder:Order`) placed to the right, mid-frame, with a **short lifeline**: `{of: 'obj', to: y, end: true}` where `to` is just below the box. Its creation is the message that points at it, and the reply leaves its own lifeline, so the box never needs a full-height time axis. Anchor the creation message with `obj@left:0.5` (the object has no lifeline above the box) and the reply with `obj@life:<y>`.
- **Combined fragments** (`diagram.fragments`) are the Alt/Opt/Loop/Par panels. Declare the outer fragment first, then the nested one with smaller `x/y/w/h` inside it — array order is draw order, so the later panel covers the earlier one. `guard` (e.g. `[ 订单有效 ]`) is the fragment condition at `y+52`; `op` is the nesting label (`1.1.2`, then `1.1.2.1` for the inner one) rendered *left of* the frame, so leave ~40 units of margin and **put the numbering outside the frame's left edge**, not inside.
- **Numbering** follows the `op` prefixes: top-level message `1`, then `1.1`, `1.1.1`, `1.1.1.1`, and inside the Par fragment `1.1.2.1.1` / `1.1.2.1.2`. Every number in the label must match its `content.edges` label; the checker compares labels and will not accept a number that exists on only one side.
- **Budget the frame around its messages.** The tab occupies the top 26 units and the guard baseline sits 52 below the top, so budget the first message at `y ≥ top + 70` when the fragment carries a guard (`top + 50` when it does not); with `sections`, budget each section's own guard 26 below its top and its first message ~18 below that. Leave ~20 units under the last message. Order the fragments' message `y` values (creation above the reply, then the Par pair) and keep the fragment bands disjoint from the participant headers and from the footer row.
- **Boundaries are ordinary groups.** Participant groupings are groups with `titleAlign: 'left'` for a primary solid boundary and `dashed: true` for a secondary one; both titles are semantic nodes and both groups are only framing — positions stay absolute, so place boxes and lifelines inside the group rectangles by hand.

```js
const diagram = Diagram.merge(DIAGRAM_TEMPLATES.sequence, {
  w: 1000, h: 640,
  groups: [
    { id: 'order-boundary', x: 30, y: 14, w: 566, h: 336, title: '订单服务', titleY: 22, titleAlign: 'left' },
    { id: 'business-boundary', x: 606, y: 14, w: 378, h: 336, title: '业务服务', titleY: 22, dashed: true }
  ],
  activations: [ { of: 'order-svc', from: 246, to: 612 } ],
  fragments: [
    { kind: 'alt', x: 64, y: 458, w: 896, h: 160, guard: '[ 订单有效 ]', op: '1.1.2' },
    { kind: 'par', x: 252, y: 488, w: 696, h: 116, op: '1.1.2.1' }
  ],
  arrows: [
    { from: 'order-svc@life:554', to: 'purchase-svc@life:554', label: '1.1.2.1.1 createPO(order)', at: [391, 532] }
  ]
});
```

The demo frame `order-call-sequence` is the worked example: 1000×640, two boundaries, five participants plus a runtime-created `order:Order`, three activation bars, an `alt` guard with a nested `par`.

A footer-and-sections frame is the other shape of the same style — four participants boxed top and bottom, a two-operand `par`, a dashed `loop`, and one `sm` aside for an internal action:

```js
const diagram = Diagram.merge(DIAGRAM_TEMPLATES.sequence, {
  w: 960, h: 800,
  boxes: [
    { id: 'client', x: 65, y: 30, w: 170, h: 80, fill: 'sky', label: '客户端 App' },
    { id: 'order-svc', x: 285, y: 30, w: 170, h: 80, fill: 'mint', label: '订单服务' },
    { id: 'kitchen', x: 505, y: 30, w: 170, h: 80, fill: 'pink', label: '厨房' },
    { id: 'rider', x: 725, y: 30, w: 170, h: 80, fill: 'violet', label: '骑手', icon: 'actor' },
    { id: 'verify-pay', x: 380, y: 425, w: 110, h: 30, fill: 'amber', label: '校验商品并扣款', size: 'sm' }
  ],
  // 四个脚注框同一行：生命线止于 foot，副本盒顶正好落在 foot 上
  lifelines: [ { of: 'client', foot: 690 }, { of: 'order-svc', foot: 690 }, { of: 'kitchen', foot: 690 }, { of: 'rider', foot: 690 } ],
  fragments: [
    { kind: 'par', x: 130, y: 150, w: 480, h: 210, dashed: true,
      sections: [ { guard: '[通知厨房]' }, { guard: '[回复客户]' } ] },
    { kind: 'loop', x: 130, y: 500, w: 700, h: 120, dashed: true, guard: '[直到送达]' }
  ],
  arrows: [
    { from: 'client@life:140', to: 'order-svc@life:140', label: '提交订单', at: [260, 124] },
    { from: 'order-svc@life:246', to: 'kitchen@life:246', label: '新订单票据', at: [480, 230] },
    { from: 'order-svc@life:338', to: 'client@life:338', kind: 'reply', label: '已接单，预计 30 分钟', at: [260, 322] },
    { from: 'kitchen@life:410', to: 'order-svc@life:410', kind: 'reply', label: '订单就绪', at: [480, 394] },
    { from: 'order-svc@life:470', to: 'rider@life:470', label: '请求取餐', at: [540, 440] },
    { from: 'rider@life:592', to: 'client@life:592', kind: 'reply', label: '分享实时位置', at: [480, 576] },
    { from: 'rider@life:660', to: 'client@life:660', kind: 'reply', label: '订单送达', at: [480, 644] }
  ]
});
```

The demo frame `delivery-sequence` is the worked example: 960×800, four footer-boxed participants (`foot: 690` on each), a two-section dashed `par`, a dashed `loop`, an `actor` icon and one `sm` self-action aside.

## Swimlane style: one flow across roles

Use it when the same process is **executed by different roles or systems in turn** — approvals, escalations, handoffs. Start from `DIAGRAM_TEMPLATES.swimlane3` and replace its placeholders.

- **One pool, single separators.** Declare `diagram.swimlane: {x, y, w, h, lanes: [{id, title}…]}`: the renderer draws one outer frame, a top header band with the lane titles, and single vertical separators between lanes. Never tile per-role groups — adjacent group borders double up and their rounded corners break the grid look. Each lane is a semantic node in `content.nodes` (label = lane title); the pool frame and separators are decoration.
- **Time runs down the lanes.** Nodes are normal boxes inside their owner's lane, ordered top to bottom; a decision keeps the usual `diamond` sizing rules (see [frame-format.md](frame-format.md)).
- **Crossing lane borders is the point.** In-lane segments run vertical, cross-lane segments run horizontal; use `line` for straight runs and `elbow` (with `via`) so every segment stays axis-aligned. A line crossing a lane boundary is expected, not a defect — like messages crossing lifelines.
- Park branch labels just beside their own segment, inside the lane where the segment runs.

## Layered stack: dependencies point down

Use it when the relationship is **tiered architecture** — access, service and data tiers where upper layers call lower ones.

- **A layer is a full-width group**; stack them vertically with small gaps, title at the top of each layer (every layer title is a semantic node).
- **Align boxes on a grid inside each layer** (2–3 per layer); infrastructure boxes may carry an `icon` such as `database` (budget `h ≥ 80` for icon + label).
- **One or two straight vertical lines** suffice for cross-layer calls: align caller and callee on the same x so the line drops straight across both group borders, top layer to bottom layer. Do not draw every pairwise dependency — pick the representative paths.

## Quadrant matrix: two axes, no arrows

Use it when items are **classified along two dimensions** — urgency/importance, impact/effort.

- **Tile the canvas with 2×2 groups**, leaving a cross-shaped gap (~40 units) between them for the axes. Each quadrant title is a semantic node; member items are normal boxes (1–2 per quadrant); there are no arrows.
- **Axis labels are `notes`** placed in the cross gap or the outer margin — e.g. `紧急 →` at the end of the horizontal strip, `重要 →` above the vertical strip. Notes are decoration and never enter `content`.
- Fill color can rank the quadrants (hot to gray); position, not color, carries the classification.

## Funnel: magnitude by decreasing width

Use it when a population **shrinks through ordered stages** — conversion, screening. Start from `DIAGRAM_TEMPLATES.funnel4` and replace its placeholders.

- **Each stage is a `shape: "trapezoid"` box**, stacked vertically and centred on one axis. The bottom edge insets 12% per side, so choose widths with `w(n+1) ≈ 0.76 × w(n)` — then each stage's bottom edge lands flush on the next stage's top edge and the stack reads as one continuous funnel.
- **The stage `value` carries the magnitude** (e.g. `12000`); the label names the stage. Both go in `content.nodes`.
- **No arrows between stages.** The stacking order already says the direction; conversion rates are derived from adjacent stages' magnitudes and placed as `notes` beside the gap's centerline (e.g. `x ≈ 400`, `y` at the gap midpoint), never as edge labels.

## Class boxes and ER entities

Use it for **class structure** (types with attributes and operations) and **data models** (entities with columns) plus their relations.

- **A class is a `rect` box with `fields`/`methods` arrays.** The label renders bold at the top, then a divider, then field rows, another divider, then method rows; rows are left-aligned at 20-unit pitch. Budget box height as 24 (label) + 16 (divider) + 20 × rows; omitting both arrays renders exactly like a plain box.
- **An ER entity is a `rect` box with a `rows` array** of `{key?, name, type?}`: the key column (`PK`/`FK`) sits left of a vertical divider, the column name next to it, and the type right-aligned. Budget box height as `67 + 20 × rows` and width for the name and type columns; `rows` replaces `fields`/`methods` (declaring both renders `rows`).
- **Repeat the same `fields`/`methods`/`rows` arrays in `content.nodes`.** The semantic checker compares them element-wise with whitespace stripped; a difference — including declaring them on only one side — is an error.
- **Relations reuse the existing vocabulary**: `kind: "many"` for 1:N with the crow's foot on the many side, `start: "compose"`/`"aggregate"` with the diamond on the whole side. Standard ER (Crow's Foot) cardinality pairs a bar on the "one" side with a crow's foot on the "many" side: `kind: "one"`/`"many"` set the arrow-end marker, `start: "one"`/`"many"` set the source-end marker — e.g. `{from: 'customer', to: 'order', start: 'one', kind: 'many', label: '1:N'}`. Connect boxes edge-to-edge with straight `line` routes and align the compartment boxes on a shared centerline.

## Composition rules

- On the default canvas, leave at least 14 units around the outside. Main boxes usually need heights of 62–90 and at least 60 units between neighboring boxes.
- Main labels are 20px bold. Estimate width as 20 units per CJK character or 11 per Latin letter, plus 40 units padding; add about 30 more for a badge. Check actual measured text rather than relying on estimates.
- Keep roughly eight or fewer main boxes per default-size frame. Split a crowded process into multiple frames before reducing main-label font size.
- Offset multiple connections on one side with anchor ratios such as `:0.3` and `:0.7`. Keep incoming connections away from the upper-right badge.
- Place edge labels explicitly with `at`, outside curved routes or above straight routes. Label clearance and route length are measured by the checker; see troubleshooting for repairs.
- Assign one color per recurring concept and keep it consistent across frames. Saturated fills emphasize main participants; Soft/Pale fills support context. Status remains an explicit field, not a color guess.
- Choose `shape` by semantics, not decoration: `diamond` for a decision, `ellipse` for start/end, `pill` for a state tag, `rect` otherwise. A shape is not an emphasis device: mixed shapes in one frame must each mean something, and diamond/ellipse boxes need the room their inscribed text area requires (see [frame-format.md](frame-format.md)).
- Across related frames, preserve participant positions where possible; make the changing relationship or status the visible difference.
