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

## Swimlane style: one flow across roles

Use it when the same process is **executed by different roles or systems in turn** — approvals, escalations, handoffs. Start from `DIAGRAM_TEMPLATES.swimlane3` and replace its placeholders.

- **A lane is a full-width group.** Tile the canvas with horizontal groups, one per role (three lanes of ~130 height fill an 820×450 canvas). The group `title` is the role name, stays at the left of the lane, and is a semantic node in `content.nodes`.
- **Nodes are normal boxes inside their owner's lane**; a decision keeps the usual `diamond` sizing rules (see [frame-format.md](frame-format.md)).
- **Crossing lane borders is the point.** Flow arrows run straight or elbow across group outlines into the next lane; a line crossing a lane boundary is expected, not a defect — like messages crossing lifelines. Align successive steps on one x where possible so cross-lane segments stay vertical.
- Park branch labels just beside their own segment, inside the lane where the branch starts.

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
- **Conversion rates are edge labels** on the short `line` arrows between stages (`@bottom` → `@top`), placed beside the segment with `at`, not on it.

## Class boxes: fields and methods compartments

Use it for **class structure** — types with attributes and operations plus their relations.

- **A class is a `rect` box with `fields`/`methods` arrays.** The label renders bold at the top, then a divider, then field rows, another divider, then method rows; rows are left-aligned at 20-unit pitch. Budget box height as 24 (label) + 16 (divider) + 20 × rows; omitting both arrays renders exactly like a plain box.
- **Repeat the same `fields`/`methods` arrays in `content.nodes`.** The semantic checker compares them element-wise with whitespace stripped; a difference — including declaring them on only one side — is an error.
- **Relations reuse the existing vocabulary**: `kind: "many"` for 1:N with the crow's foot on the many side, `start: "compose"`/`"aggregate"` with the diamond on the whole side. Connect boxes edge-to-edge with straight `line` routes and align the compartment boxes on a shared centerline.

## Composition rules

- On the default canvas, leave at least 14 units around the outside. Main boxes usually need heights of 62–90 and at least 60 units between neighboring boxes.
- Main labels are 20px bold. Estimate width as 20 units per CJK character or 11 per Latin letter, plus 40 units padding; add about 30 more for a badge. Check actual measured text rather than relying on estimates.
- Keep roughly eight or fewer main boxes per default-size frame. Split a crowded process into multiple frames before reducing main-label font size.
- Offset multiple connections on one side with anchor ratios such as `:0.3` and `:0.7`. Keep incoming connections away from the upper-right badge.
- Place edge labels explicitly with `at`, outside curved routes or above straight routes. Label clearance and route length are measured by the checker; see troubleshooting for repairs.
- Assign one color per recurring concept and keep it consistent across frames. Saturated fills emphasize main participants; Soft/Pale fills support context. Status remains an explicit field, not a color guess.
- Choose `shape` by semantics, not decoration: `diamond` for a decision, `ellipse` for start/end, `pill` for a state tag, `rect` otherwise. A shape is not an emphasis device: mixed shapes in one frame must each mean something, and diamond/ellipse boxes need the room their inscribed text area requires (see [frame-format.md](frame-format.md)).
- Across related frames, preserve participant positions where possible; make the changing relationship or status the visible difference.
