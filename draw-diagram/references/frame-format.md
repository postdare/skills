# Diagram document and fields

## Document

A standalone JSON document is `{ "title": "…", "frames": [frame, …] }`. Each frame has:

- `id`: unique filename-safe identifier used for exported artifacts.
- `title`: accessible title and preview heading.
- `note?`: supporting preview prose, separate from the SVG.
- `content`: authoritative `{nodes, edges}` data.
- `diagram`: manually composed geometry described below.

Keep `content` independent of layout: changing wording, status or relationships changes content first; moving a box changes only diagram coordinates. JSON contains plain data, not function calls. In JavaScript authoring, copy a `DIAGRAM_TEMPLATES` object or use `Diagram.merge`; then serialize the resulting object for the build command.
独立工具输入为 UTF-8 JSON，不含 JS 调用：

```json
{
  "title": "发布流程",
  "frames": [{
    "id": "release-1",
    "title": "审核后发布",
    "note": "审核通过才进入发布。",
    "content": {
      "nodes": [{"id":"review","label":"审核"},{"id":"publish","label":"发布","status":"ok"}],
      "edges": [{"from":"review","to":"publish","label":"通过"}]
    },
    "diagram": {
      "boxes": [
        {"id":"review","x":90,"y":185,"w":180,"h":80,"fill":"skyPale","label":"审核"},
        {"id":"publish","x":450,"y":185,"w":180,"h":80,"fill":"mintSoft","label":"发布","status":"ok"}
      ],
      "arrows": [{"from":"review@right","to":"publish@left","shape":"line","label":"通过","at":[360,207]}]
    }
  }]
}
```

## Authoritative content

`nodes` contains `{id, label, value?, status?}`. `edges` contains `{from, to, label?, kind?}`; endpoints are node IDs, not anchors. IDs must be unique across all main boxes and groups. Use IDs without `@`, which separates a drawing anchor.

`DiagramCheck.semantic(diagram, content)` returns `{errors, hints}`. It compares every main node in both directions: missing and extra nodes, labels, values and statuses are errors. Label/value comparison removes whitespace, including deliberate line wrapping; punctuation and wording remain significant. Omitted/null/empty values compare as empty; numeric values are compared as text. A group's `title` is its node label; groups do not render values, so use a box when the semantic node needs a value.

The status must match exactly; `error`, `ok`, `warn` and `muted` are supported visual statuses. Omitted status means none. `dim` is visual de-emphasis only and does not replace `status: "muted"`.

Edges match by endpoint IDs, whitespace-normalized label and kind, with multiplicity preserved. Parallel edges with different labels are distinct, and repeated identical edges require repeated arrows. Omitted kind means `flow`; `blocked` must match explicitly. Missing and extra main arrows are errors, including label/kind differences.

## Diagram

Coordinates are SVG user units. Default canvas is 720×450; set positive `w` and `h` for another canvas. Positions are absolute even inside groups: groups do not transform their contents or establish clipping.

| Field | Shape | Meaning |
| --- | --- | --- |
| `boxes` | array of boxes | Main semantic nodes or small illustrations |
| `groups?` | array of groups | Framing containers that can also be semantic nodes |
| `arrows` | array of arrows | Directed relationships |
| `ring?` | `{cx,cy,rx,ry}` | Shared elliptical route for `orbit` arrows; positive radii |
| `notes?` | array of `{x,y,text,tone?,anchor?}` | Non-authoritative annotations; `tone: "warn"` adds emphasis |
| `w?`, `h?` | numbers | Canvas dimensions |

`Diagram.merge(...parts)` concatenates `boxes`, `groups`, `arrows` and `notes` in argument order. Other supplied fields, including `w`, `h` and `ring`, use the last supplied value. It does not clone nested objects, rename IDs or resolve collisions. One merged diagram has one shared ring; use manually controlled `arc` routes for an additional cycle.

### Boxes

`{id,x,y,w,h,label,fill?,value?,status?,dim?,size?,r?,shape?}`

- `x/y` locate the top-left corner of the bounding box; `w/h` are positive dimensions. `r` overrides the corner radius of a `rect`.
- `fill` is a named `Diagram.fills` color or a CSS color. Named families are `mint`, `pink`, `violet`, `sky`, `amber`, each with `Soft` and `Pale` variants, plus `gray`. Omitted fill uses mint.
- `label` supports `\n`; `value` adds a smaller second line. Numeric zero renders. Keep line wrapping intentional.
- `error`, `ok` and `warn` add a badge; `muted` adds gray fill and dashed outline. `dim: true` reduces opacity independently.
- `size: "sm"` is for an illustration only: smaller text/corners, no value or badge. It is exempt from semantic node comparison and cannot satisfy a required content node.

### Shapes

`shape` selects the node outline. It defaults to `rect`, applies to boxes only (groups are always rectangles), also works for `size: "sm"` illustrations, and does not change semantic comparison.

| `shape` | Outline | Common use | Notes |
| --- | --- | --- | --- |
| `rect` | Rounded rectangle | Ordinary step, participant or container member | `r` sets the corner radius |
| `pill` | Stadium (fully rounded ends) | Terminal/state tag such as `上线` | `r` ignored; ends use half the shorter side |
| `diamond` | Rhombus | Decision with two or more branches | `r` ignored; four sharp vertices |
| `ellipse` | Ellipse | Start/end terminator | `r` ignored |

Shape changes the outline, the usable text area, the anchor points and the badge position, while `x/y/w/h` stay the bounding box every other computation uses:

- **Anchors**: `id@side:ratio` still addresses the bounding box; the rendered endpoint is pushed to the outline along the direction from the box center, so ratios keep their meaning. On a diamond `@top`, `@right`, `@bottom`, `@left` land exactly on the four vertices; on an ellipse they land on the four axis ends; on a pill `@left`/`@right` land on the cap extremes. `orbit` clips on the outline as well.
- **Badges**: `error/ok/warn` badges keep the fixed top-right inset on a `rect`; on `pill`, `diamond` and `ellipse` they move inside the outline along the up-right direction and must clear the boundary by at least their radius (11). A flat or tiny shape cannot carry a badge.
- **Labels**: the checker requires the text bounding box to clear the outline. `rect` and `pill` keep the rectangular rule (6 left/right, 2 top/bottom). `diamond` and `ellipse` require every corner of the text box to be at least 4 units from the outline, i.e. the text must fit inside the inscribed rhombus or ellipse, not the bounding box.

Budget the box from the label instead of reusing rectangle sizes:

| `shape` | Fits a label of `tw`×`th` when | 100×24 label (≈5 CJK characters) |
| --- | --- | --- |
| `rect` | `w ≥ tw + 12`, `h ≥ th + 4` | 130×70 |
| `pill` | same as `rect`, plus half the shorter side for the rounded ends | 130×70 |
| `diamond` | `(tw/2 + 4)/(w/2) + (th/2 + 4)/(h/2) ≤ 1` | 220×130 (0.74) |
| `ellipse` | each text corner at least 4 inside the outline | 220×130 (comfortable) |

Equal bounding boxes therefore are not interchangeable: a diamond needs roughly the same width plus more height than a rectangle, and wide flat shapes waste the corners. Prefer few shapes per frame; mixing all four in one frame usually needs a wider canvas (`demo/diagrams.json` frame `shape-vocabulary` uses 820×450).

### Groups

`{id,x,y,w,h,title?,titleY?,card?,status?,dim?,r?}`

`titleY` is relative to group top, default 26. `card` is `{x,y,w,h}` in absolute canvas coordinates and renders a shadowed white inset. Groups draw in array order, so put an outer group before its nested groups. A group with a meaningful title is a main semantic node and must appear in content. `status: "error"` colors its outline; groups do not draw box status badges. Prefer boxes when status needs a badge or muted treatment. Cards and notes are decorations, not extra semantic nodes.

### Arrows and anchors

`{from,to,shape?,label?,at?,anchor?,kind?,dim?,size?,via?,radius?,c1?,c2?,bend?,counter?,side?}`

For `line`, `arc` and `elbow`, use `id@side[:ratio]`; side is `top`, `right`, `bottom` or `left`, ratio is 0–1 along that edge. Omitted side is right and omitted ratio is 0.5. Endpoints can be boxes or groups.

- `line`: straight connection; align endpoints deliberately.
- `arc` (also the default): cubic curve leaving/arriving along anchor directions. `c1/c2: [x,y]` override control points; `bend` scales automatic control reach.
- `elbow`: rounded orthogonal route. `via: [[x,y],…]` supplies intermediate points; omitted via chooses a route from endpoint directions. `radius` overrides turn rounding.
- `orbit`: follows the diagram's `ring` clockwise, clipping the curve at the endpoint box boundaries. Use bare IDs, not anchors. `counter: true` reverses direction. Place node centers on the ellipse.
- `kind: "blocked"`: red dashed line and red arrowhead; otherwise flow styling.
- `label`: relationship text. `at: [x,y]` sets its position; omitted at offsets the path midpoint, without collision avoidance. `anchor` accepts `start`, `middle` or `end`. `side` reverses automatic midpoint offset when negative.
- `size: "sm"`: illustration arrow, smaller stroke/marker and exempt from semantic edge comparison. Set this on each illustration arrow explicitly. Main arrows do not become illustrations merely because one endpoint is small.

Illustrations explain internal mechanics without adding authoritative relationships: mark their boxes and arrows `size: "sm"`. Main nodes, including disconnected ones, remain in content. Keep helpers and decorations from presenting new business facts not present in the source.

## Rendering and checking

Load `assets/diagram.css` and `assets/diagram.js`, then append `Diagram.render(diagram, {title})` to the document. Load `assets/check.js` and call geometry only after the SVG is attached, styles are loaded and fonts are ready (`await document.fonts.ready`). `DiagramCheck.geometry(svg, diagram)` measures visible SVG text/path geometry and returns `{errors, hints}`; semantic checking does not require a DOM.

The renderer returns an SVG with its own marker/filter definitions and per-render IDs so multiple diagrams coexist. CSS is external during preview. For standalone SVG export, embed the supplied diagram stylesheet as an SVG `<style>` element before XML serialization; the parent build/export tool owns that step. Preserve `.slide*` selectors when embedding styles.
