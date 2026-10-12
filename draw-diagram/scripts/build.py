#!/usr/bin/env python3
"""Build a self-contained diagram preview from JSON; no project runtime required."""
import argparse
import html
import json
from pathlib import Path

SKILL = Path(__file__).resolve().parents[1]

PREVIEW_STYLE = """
body { margin: 0; background: #f4f5f7; color: #20252c; font: 16px/1.6 system-ui, sans-serif; }
main { max-width: 960px; margin: 32px auto; padding: 0 16px; }
h1 { margin-bottom: 8px; } h2 { font-size: 20px; }
.preview-frame { margin: 28px 0; }
.preview-slide { max-width: 720px; border: 1px solid #d4d8df; border-radius: 12px; overflow: hidden; }
.preview-check { padding-left: 24px; font-size: 14px; }
[data-level=error] { color: #a92c3b; } [data-level=ok] { color: #17634a; }
@media (max-width: 500px) { main { margin: 16px auto; padding: 0 12px; } }
"""

PREVIEW_SCRIPT = """
(async () => {
  const report = { frames: documentData.frames.length, drawn: 0, errors: 0, hints: 0, items: [], scriptErrors: [] };
  const root = document.getElementById('preview');
  for (const frame of documentData.frames) {
    const article = document.createElement('article');
    article.className = 'preview-frame'; article.dataset.key = frame.id;
    const heading = document.createElement('h2'); heading.textContent = frame.title;
    const note = document.createElement('p'); note.textContent = frame.note || '';
    const canvas = document.createElement('div'); canvas.className = 'preview-slide';
    const result = document.createElement('ul'); result.className = 'preview-check';
    article.append(heading, note, canvas, result); root.append(article);
    try {
      const svg = Diagram.render(frame.diagram, { title: frame.title });
      canvas.append(svg); report.drawn++;
    } catch (error) {
      report.scriptErrors.push(frame.id + ': ' + error.message);
    }
  }
  await document.fonts.ready;
  for (const frame of documentData.frames) {
    const article = [...root.children].find(element => element.dataset.key === frame.id);
    const svg = article.querySelector('svg.slide');
    const result = article.querySelector('.preview-check');
    let errors = [], hints = [];
    if (!svg) errors.push('Missing rendered diagram: ' + frame.id);
    else {
      const geometry = DiagramCheck.geometry(svg, frame.diagram);
      const semantic = DiagramCheck.semantic(frame.diagram, frame.content);
      errors = [...geometry.errors, ...semantic.errors]; hints = [...geometry.hints, ...semantic.hints];
    }
    report.errors += errors.length; report.hints += hints.length;
    report.items.push({ key: frame.id, drawn: Boolean(svg), errors, hints });
    for (const [level, lines] of [['error', errors], ['hint', hints]]) for (const message of lines) {
      const li = document.createElement('li'); li.dataset.level = level; li.textContent = message; result.append(li);
    }
    if (!errors.length) {
      const li = document.createElement('li'); li.dataset.level = 'ok';
      li.textContent = 'Geometry and content checks passed; visual review still required.'; result.append(li);
    }
  }
  report.scriptErrors.push(...window.__diagramErrors);
  const summary = document.getElementById('preview-summary');
  summary.textContent = `${report.drawn}/${report.frames} diagrams · ${report.errors} errors · ${report.hints} hints`;
  summary.dataset.level = report.errors || report.scriptErrors.length ? 'error' : 'ok';
  window.__diagramStyle = diagramStyle;
  window.__diagramCheck = report;
  document.body.dataset.ready = 'true';
})().catch(error => {
  window.__diagramCheck = { frames: documentData.frames.length, drawn: 0, errors: 1, hints: 0, items: [], scriptErrors: [error.message] };
  document.getElementById('preview-summary').textContent = error.message;
  document.body.dataset.ready = 'true';
});
"""


def script_text(text):
    # Data labels must not terminate the surrounding HTML script element.
    return text.replace('</', '<\\/')


def build(source, output):
    data = json.loads(source.read_text(encoding='utf-8'))
    frames = data.get('frames')
    if not isinstance(frames, list) or not frames:
        raise ValueError('frames must be a non-empty array')
    ids = set()
    for frame in frames:
        key = frame.get('id', '')
        if not isinstance(key, str) or not key or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_' for c in key):
            raise ValueError('frame id must contain only letters, digits, hyphens or underscores')
        if key in ids:
            raise ValueError('duplicate frame id: ' + key)
        ids.add(key)
        if not isinstance(frame.get('title'), str) or not frame['title'].strip():
            raise ValueError('frame title is required: ' + key)
        if not isinstance(frame.get('diagram'), dict) or not isinstance(frame.get('content'), dict):
            raise ValueError('diagram and content are required: ' + key)
        for field in ('nodes', 'edges'):
            if not isinstance(frame['content'].get(field), list):
                raise ValueError('content.' + field + ' must be an array: ' + key)
    assets = SKILL / 'assets'
    css = (assets / 'diagram.css').read_text(encoding='utf-8')
    renderer = (assets / 'diagram.js').read_text(encoding='utf-8')
    checker = (assets / 'check.js').read_text(encoding='utf-8')
    title = html.escape(str(data.get('title', 'Diagrams')))
    preview = f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title}</title><style>{PREVIEW_STYLE}\n{css}</style>
<script>window.__diagramErrors = []; addEventListener('error', e => __diagramErrors.push(e.message));</script>
<script>{script_text(renderer)}</script><script>{script_text(checker)}</script></head>
<body><main><h1>{title}</h1><p id="preview-summary">Rendering…</p><div id="preview"></div></main>
<script>const documentData = {script_text(json.dumps(data, ensure_ascii=False))};
const diagramStyle = {script_text(json.dumps(css, ensure_ascii=False))};
{PREVIEW_SCRIPT}</script></body></html>
'''
    output.mkdir(parents=True, exist_ok=True)
    destination = output / 'preview.html'
    destination.write_text(preview, encoding='utf-8')
    return destination


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path, help='JSON document containing title and frames')
    parser.add_argument('--out', type=Path, required=True, help='output directory for preview.html')
    args = parser.parse_args()
    try:
        print(build(args.input, args.out))
    except (OSError, ValueError, TypeError) as error:
        parser.exit(1, str(error) + '\n')


if __name__ == '__main__':
    main()
