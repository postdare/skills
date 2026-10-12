# Troubleshooting

Geometry diagnostics come from `assets/check.js`; renderer routes and badge compensation come from `assets/diagram.js`. Fix the diagram or the measured rendering cause rather than weakening checks. Semantic rules are authoritative in [frame-format.md](frame-format.md).

## Text, bounds and containers

| Diagnostic / symptom | Repair |
| --- | --- |
| Text overflow (`文字溢出`) | Widen the box or add a deliberate label line break. Preserve source wording. Move surrounding boxes to retain route space. |
| Badge overlaps text (`角标压字`) | Add space on the badge side; a status badge requires more width than a plain box. |
| Overlapping boxes (`框重叠`) | Move or resize boxes, including small illustration boxes. Groups are boundaries, not substitutes for spacing. |
| Out of bounds (`越界`) | Move the offending box, group, path or label inside the configured canvas. Increasing canvas dimensions requires another mobile review. |
| Group title obscured (`标题被挡`) | Keep boxes below the title. For a compact group, `titleY: 17` and a card beginning at `y + 31` are a useful starting point. Nested groups use absolute coordinates. |
| Bad measurements despite visible spacing | Attach the SVG, load the stylesheet and await fonts before geometry checking. Avoid hidden/display-none previews: text bounding boxes require a rendered SVG. |

## Paths and arrowheads

| Diagnostic / symptom | Repair |
| --- | --- |
| Path crosses a box (`穿框`) | Change anchor sides, move the boxes, or explicitly route an elbow using `via`. Endpoint boxes are exempt; other main and illustration boxes are obstacles. |
| Short edge (`短边`) | Separate the endpoints; do not hide a required relationship with an illustration-sized arrow. |
| Almost-horizontal/vertical line is slanted (`斜线`) | Align anchor positions, accounting for box dimensions and ratios. A genuinely diagonal relationship is different from an accidental near-axis slant. |
| Arrowhead bends sharply (`箭头折角`) | Pick arrival/departure sides that suit the relative position. A mostly vertical displacement often needs top/bottom anchors rather than left/right. Allow a straight terminal approach and sufficient separation. |
| Five-node cycle becomes a vertical segment with a hook | Use a shared ellipse and `orbit`, with bare endpoint IDs and node centers on the ring. Four-corner arc geometry does not generalize to arbitrary cycles. |
| Unknown endpoint throws while rendering | Match IDs against both boxes and groups. Anchor references use `id@side:ratio`; orbit references use only the ID. |
| Multiple inline SVGs use the wrong marker or shadow | Preserve renderer-generated unique marker/filter IDs when exporting or embedding; copying IDs between SVGs defeats their isolation. |

## Edge labels

Automatic midpoint placement offsets a label but does not avoid other content. Use explicit `at` coordinates for deliberate composition.

| Diagnostic | Repair |
| --- | --- |
| Label overlaps a box/title/another label (`标签压框`, `标签压标题`, `标签互压`) | Move it to the outer side of its own route; adjust neighboring labels as a set. |
| Label overlaps a line (`标签压线`) | Move its full text bounding box away from every path, not only its own. The white text halo is not an exemption. |
| Label too far from its edge (`标签离线太远`) | Bring it toward its owning route, retaining clearance. Keep parallel labels visually attributable to their own arrows. |
| Label wider than its available route (`标签放不下`) | Lengthen the relationship by separating boxes. Shorten wording only if the authoritative content is updated intentionally. |

## Status badges and fonts

Badge optical centering is checked from the browser's actual font metrics. `dominant-baseline: central` centers the em box, not necessarily the glyph ink. The renderer's badge `dy` offsets compensate for that difference.

When `角标未居中` appears after a font change, measure the new font and update the renderer's badge compensation deliberately. Do not relax the checker threshold or shift individual diagram badges: the renderer is the shared source of truth. Keep the stylesheet's badge font weight/size and renderer compensation aligned. Browsers without the required font metrics skip this optical check, so visual inspection still matters.

## Semantic differences

- Missing/extra nodes: compare the content ID list with main box/group IDs. A small illustration cannot satisfy a required node; a titled main group is not a free decoration.
- Different label/value: preserve all source words and punctuation. Only whitespace and line wrapping are normalized. A group label comes from `title`; it cannot render a value.
- Different status: copy the explicit status. `dim` controls opacity, not semantic muted status.
- Missing/extra edges: compare endpoint direction, label, kind and occurrence count. Two labeled edges between the same participants require two matching arrows. Illustration arrows must explicitly use `size: "sm"`.

Fix the semantic source only when the user's supplied facts justify it; layout convenience is not a reason to remove a relationship or status.

## Exports and visual review

A zero-error geometry report proves clearance, not a readable composition. Review both desktop and mobile captures after the last edit: main flow, hierarchy, status visibility, readable labels, comfortable whitespace and unambiguous parallel relationships.

If a standalone SVG looks unstyled, embed `assets/diagram.css` in an SVG `<style>` before serialization. The class names intentionally remain `.slide*` for compatible styling. Keep SVG namespaces and its own `<defs>` intact. If a long preview yields incorrect screenshots, capture each frame only after scrolling it into view rather than clipping an off-screen viewport.
