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

## Composition rules

- On the default canvas, leave at least 14 units around the outside. Main boxes usually need heights of 62–90 and at least 60 units between neighboring boxes.
- Main labels are 20px bold. Estimate width as 20 units per CJK character or 11 per Latin letter, plus 40 units padding; add about 30 more for a badge. Check actual measured text rather than relying on estimates.
- Keep roughly eight or fewer main boxes per default-size frame. Split a crowded process into multiple frames before reducing main-label font size.
- Offset multiple connections on one side with anchor ratios such as `:0.3` and `:0.7`. Keep incoming connections away from the upper-right badge.
- Place edge labels explicitly with `at`, outside curved routes or above straight routes. Label clearance and route length are measured by the checker; see troubleshooting for repairs.
- Assign one color per recurring concept and keep it consistent across frames. Saturated fills emphasize main participants; Soft/Pale fills support context. Status remains an explicit field, not a color guess.
- Choose `shape` by semantics, not decoration: `diamond` for a decision, `ellipse` for start/end, `pill` for a state tag, `rect` otherwise. A shape is not an emphasis device: mixed shapes in one frame must each mean something, and diamond/ellipse boxes need the room their inscribed text area requires (see [frame-format.md](frame-format.md)).
- Across related frames, preserve participant positions where possible; make the changing relationship or status the visible difference.
