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

Edges match by endpoint IDs, whitespace-normalized label, kind and start, with multiplicity preserved. Parallel edges with different labels are distinct, and repeated identical edges require repeated arrows. Omitted kind means `flow`; `blocked` must match explicitly. Missing and extra main arrows are errors, including label/kind differences.

## Diagram

Coordinates are SVG user units. Default canvas is 720×450; set positive `w` and `h` for another canvas. Positions are absolute even inside groups: groups do not transform their contents or establish clipping.

| Field | Shape | Meaning |
| --- | --- | --- |
| `boxes` | array of boxes | Main semantic nodes or small illustrations |
| `groups?` | array of groups | Framing containers that can also be semantic nodes |
| `arrows` | array of arrows | Directed relationships |
| `lifelines?` | array of `{of,to,at?,end?}` | Sequence-style dashed vertical guides under a node (decoration only, never a node) |
| `activations?` | array of `{of,from,to,at?}` | Sequence-style execution bars drawn on an existing lifeline (decoration only, never a node) |
| `fragments?` | array of `{x,y,w,h,kind,guard?,op?,dim?}` | UML combined fragment panels such as Alt/Par (decoration only, never a node) |
| `swimlane?` | `{x,y,w,h,header?,lanes:[{id,title}…]}` | Swimlane pool: one outer frame, header band with lane titles, single separators between lanes. Each lane is a semantic node; frame and separators are decoration |
| `ring?` | `{cx,cy,rx,ry}` | Shared elliptical route for `orbit` arrows; positive radii |
| `notes?` | array of `{x,y,text,tone?,anchor?}` | Non-authoritative annotations; `tone: "warn"` adds emphasis |
| `w?`, `h?` | numbers | Canvas dimensions |

`Diagram.merge(...parts)` concatenates `boxes`, `groups`, `arrows` and `notes` in argument order. Other supplied fields, including `w`, `h` and `ring`, use the last supplied value. It does not clone nested objects, rename IDs or resolve collisions. One merged diagram has one shared ring; use manually controlled `arc` routes for an additional cycle.

### Boxes

`{id,x,y,w,h,label,fill?,value?,status?,dim?,size?,r?,shape?,icon?}`

- `x/y` locate the top-left corner of the bounding box; `w/h` are positive dimensions. `r` overrides the corner radius of a `rect`.
- `fill` is a named `Diagram.fills` color or a CSS color. Named families are `mint`, `pink`, `violet`, `sky`, `amber`, each with `Soft` and `Pale` variants, plus `gray`. Omitted fill uses mint.
- `icon` adds a small line pictogram at the top of the box: `database`（存储）、`queue`（消息队列）、`user`（人/角色）、`cloud`（外部系统）、`clock`（定时/调度）. The label shifts down accordingly; budget `h ≥ 80` for icon + label, more with a `value`. Icons are pure visual vocabulary and never enter `content`.
- `fields?: string[]` and `methods?: string[]` turn the box into a UML-style class box: the label moves to the top, a divider follows, then left-aligned member rows, another divider, then the method rows. Layout: label at `y+24`, first divider at `y+38`, rows at `y+58 + i*20` (13px); budget `h ≥ 67 + 20 × (行数)`. Members are semantic: `content` nodes must declare the same arrays (whitespace-normalized, elementwise). Compartments render only on main boxes and do not combine with `value` or `icon`.
- `rows?: [{key?, name, type?}]` turns the box into an ER entity table: the label renders bold and centered at `y+24`, a horizontal divider at `y+38`, then one row per entry at baseline `y+58 + i*20` — `key` left-aligned at `x+10`, `name` left-aligned at `x+56`, `type` right-aligned at `x+w-12` — plus a vertical divider at `x+48` from `y+38` to `y+h-8` separating the key column. Budget `h ≥ 67 + 20 × (行数)` and enough width for the name and type columns. `rows` is mutually exclusive with `fields`/`methods` (when both appear, `rows` wins), keeps `data-shape="rect"`, and is semantic like members: `content` nodes must declare the same entries (`key`/`name`/`type` whitespace-normalized, elementwise; missing and empty compare equal).
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
| `initial` | Filled dot | State-machine initial pseudostate | No label/value/badge; keep `w = h` ≈ 24; the matching content node carries an empty label |
| `final` | Bullseye (ring + filled core) | State-machine final pseudostate | Same rules as `initial` |
| `trapezoid` | Trapezoid: top edge full width, bottom edge inset 12% per side | Funnel stage | Text must clear the slanted outline like diamond/ellipse; stack with decreasing widths so adjacent stages' edges line up visually |

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

`{id,x,y,w,h,title?,titleY?,titleAlign?,dashed?,card?,status?,dim?,r?}`

`titleY` is relative to group top, default 26. `titleAlign: "left"` puts the title at `x+16` with `text-anchor: start` (default `center`); it changes only the title's position, never its text, so semantic matching is unaffected. `dashed: true` renders the outline as `stroke-dasharray: 9 7` — a non-semantic cue for a secondary or tentative boundary; the outline width, corner radius and `status` color are unchanged. `card` is `{x,y,w,h}` in absolute canvas coordinates and renders a shadowed white inset. Groups draw in array order, so put an outer group before its nested groups. A group with a meaningful title is a main semantic node and must appear in content. `status: "error"` colors its outline; groups do not draw box status badges. Prefer boxes when status needs a badge or muted treatment. Cards and notes are decorations, not extra semantic nodes.

### Arrows and anchors

`{from,to,shape?,label?,at?,anchor?,kind?,dim?,size?,via?,radius?,c1?,c2?,bend?,counter?,side?}`

For `line`, `arc` and `elbow`, use `id@side[:ratio]`; side is `top`, `right`, `bottom` or `left`, ratio is 0–1 along that edge. Omitted side is right and omitted ratio is 0.5. Endpoints can be boxes or groups.

- `line`: straight connection; align endpoints deliberately.
- `arc` (also the default): cubic curve leaving/arriving along anchor directions. `c1/c2: [x,y]` override control points; `bend` scales automatic control reach.
- `elbow`: rounded orthogonal route. `via: [[x,y],…]` supplies intermediate points; omitted via chooses a route from endpoint directions. `radius` overrides turn rounding.
- `orbit`: follows the diagram's `ring` clockwise, clipping the curve at the endpoint box boundaries. Use bare IDs, not anchors. `counter: true` reverses direction. Place node centers on the ellipse.
- `kind` selects the relation line style, and it is a **semantic** choice: the same value must appear in `content.edges`, because the checker compares kinds.
  - `flow` (default) — synchronous call/request: solid line, filled arrowhead.
  - `async` — asynchronous message: solid line, **open** arrowhead.
  - `reply` — return/response: **dashed** line, **open** arrowhead.
  - `blocked` — blocked/failed path: red dashed line, filled arrowhead.
  - `many` — ER one-to-many: solid line with a **crow's foot** on the arrow end; point it at the "many" side.
  - `one` — ER mandatory-one: solid line with a **short perpendicular bar** on the arrow end instead of an arrowhead; the bar lands flush on the box boundary.
  The filled-vs-open arrowhead split between calls and returns follows UML interaction diagrams; use it whenever a diagram distinguishes requests from responses.
- `start`: decoration on the **source** end, also semantic (the same value must appear in `content.edges`): `compose`（组合，实心菱形贴整体一侧）、`aggregate`（聚合，空心菱形贴整体一侧）、`one`（ER「一」侧，短杠贴源头一侧）、`many`（ER「多」侧，鸦脚扇向源头框）. Point the arrow from the whole to the part for the diamonds, and from the "one" side to the "many" side for ER cardinality pairs.
- `label`: relationship text. `at: [x,y]` sets its position; omitted at offsets the path midpoint, without collision avoidance. `anchor` accepts `start`, `middle` or `end`. `side` reverses automatic midpoint offset when negative.
- `size: "sm"`: illustration arrow, smaller stroke/marker and exempt from semantic edge comparison. Set this on each illustration arrow explicitly. Main arrows do not become illustrations merely because one endpoint is small.

### Lifelines and sequence-style messages

`lifelines` draws a dashed vertical guide under a node — the time axis of a sequence diagram. Each entry is `{of, to, at?, end?}`: `of` is the node id, `to` is the y where the guide stops (default `h - 24`), `at` is the ratio along that node's width (default 0.5), and `end: true` adds a short closing bar. A node carries at most one lifeline, and a lifeline **is not a node**: it never enters `content`, never affects semantic matching, and is exempt from geometry collision rules (a message crossing another participant's lifeline is normal and intended).

Messages between lifelines anchor with `id@life:<y>`:

```json
{ "from": "client@life:240", "to": "authz@life:240", "label": "5 用码换令牌", "at": [560, 224] }
```

- The anchor sits on that node's lifeline at height `y`; the node must already declare a lifeline, otherwise rendering throws.
- The direction is not fixed by the anchor but taken from the other endpoint, so a message always points into its target's lifeline with the arrowhead landing flush on it.
- Two life anchors default to a straight horizontal `line`; declare `elbow`/`arc` explicitly to override.
- Both endpoints on the **same** lifeline become a self-message: the route leaves right, runs down and returns with the arrowhead landing on the lifeline. `bend` sets the loop width (default 44; a labelled self-message needs ~70 so the label fits inside the loop instead of on its vertical).
- Semantic matching strips everything after `@`, so `owner@life:240` still counts as node `owner`.

Keep message `y` values in time order and about 46+ apart so labels fit between neighbours. Do not drop a participant just to shorten a message that spans non-adjacent lifelines.

Illustrations explain internal mechanics without adding authoritative relationships: mark their boxes and arrows `size: "sm"`. Main nodes, including disconnected ones, remain in content. Keep helpers and decorations from presenting new business facts not present in the source.

### Activations and combined fragments

`activations` draws execution bars, the UML activation on a lifeline, and `fragments` draws combined-fragment panels. Both are sequence-style decoration: like lifelines they never enter `content`, never affect semantic matching, and carry classes (`slide-activation`, `slide-fragment`) deliberately outside `.slide-shape` / `.slide-box` / `.slide-group` / `.slide-arrow`, so the geometry checker does not see them at all — a message crossing a bar or a panel is normal and intended.

`activations` entry `{of, from, to, at?}`:

- `of` is a node id that **already declares a lifeline**; otherwise rendering throws. `from`/`to` are y coordinates (`from < to`, checked with the same explicit throw style as the `@life` anchor errors) and `at` is the ratio along that node's width, identical in meaning to `lifelines.at` (default 0.5).
- Rendering: a `rect` 14 wide centred on the lifeline x (`x = lifeline x - 7`), `y = from`, `height = to - from`, fill `#dde3e8`, stroke `#111` width 1.2.
- Draw order: after the lifelines, before the arrows — messages lie on top of the bar and their endpoints land on the bar's vertical centre, exactly like a UML interaction diagram.
- Bars nest implicitly: to show a nested call, end the inner bar before the outer one ends (put its `to` above the outer `to`); nothing but the coordinates expresses nesting.

`fragments` entry `{x,y,w,h,kind,guard?,op?,dim?}`:

- `kind` is one of `alt`, `opt`, `loop`, `par` — any other value throws. Glyph and label follow the UML notation: `alt`/`opt` render `◇`, `loop` renders `↻`, `par` renders `=`, with the labels `Alt`/`Opt`/`Loop`/`Par`.
- The panel is a `rect` with `rx: 4`, fill `#fff`, `fill-opacity: .92`, stroke `#111` width 1.5. The top-left tab is 78 wide and 26 tall (fill `#eceff2`) holding the glyph and label as 14px bold left-aligned text.
- `guard` (non-empty) renders at `x+14`, `y+52` as left-aligned 14px text — the fragment's condition, written in brackets by convention. `op` (non-empty) renders *outside* the panel at `x-10`, `y+18` with `anchor: end`, so reserve at least ~40 units of margin left of the frame; nesting depth is expressed as an operating-expression prefix (`1.1.2` outside, `1.1.2.1` for its inner fragment).
- Panels draw in array order, so a later panel covers an earlier one — declare an outer fragment before the one nested inside it, and shrink the inner `x/y/w/h` to sit within the outer frame.
- Budget the frame so it **contains the messages it governs**: the tab occupies the top 26 units and the guard baseline sits 52 below the top, so budget the first message at `y ≥ top + 70` when the fragment carries a guard (`top + 50` when it does not), and leave ~20 units of clearance above the bottom edge. Panels are drawn as a white underlay beneath the lifelines and activation bars, so lifelines and bars stay visible inside the fragment.

## Rendering and checking

Load `assets/diagram.css` and `assets/diagram.js`, then append `Diagram.render(diagram, {title})` to the document. Load `assets/check.js` and call geometry only after the SVG is attached, styles are loaded and fonts are ready (`await document.fonts.ready`). `DiagramCheck.geometry(svg, diagram)` measures visible SVG text/path geometry and returns `{errors, hints}`; semantic checking does not require a DOM.

The renderer returns an SVG with its own marker/filter definitions and per-render IDs so multiple diagrams coexist. CSS is external during preview. For standalone SVG export, embed the supplied diagram stylesheet as an SVG `<style>` element before XML serialization; the parent build/export tool owns that step. Preserve `.slide*` selectors when embedding styles.
