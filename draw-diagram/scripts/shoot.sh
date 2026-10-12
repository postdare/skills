#!/usr/bin/env bash
# Capture a generated or integrated diagram preview, export SVGs and fail incomplete/error reports.
# Usage: shoot.sh <preview-url> <output-directory>
# Requires Python 3 and ego-browser. The preview exposes __diagramCheck and __diagramStyle.
set -euo pipefail
url="${1:?Preview URL is required}"
out="${2:?Output directory is required}"
command -v ego-browser >/dev/null || { echo 'ego-browser is required; read its installation skill.' >&2; exit 2; }
mkdir -p "$out"
json() { python3 -c 'import json,sys; print(json.dumps(sys.argv[1]))' "$1"; }
ego-browser nodejs <<JS
const url = $(json "$url");
const out = $(json "$out");
const fs = await import('node:fs/promises');
const task = await taskSpace('draw-diagram verification');
console.log('Browser space:', task.spaceId);
const page = task.page('p1');
// Bypass only this page's HTTP cache; leave profile-wide caches and sessions intact.
await page.cdp('Network.setCacheDisabled', { cacheDisabled: true });
let failed = false;
const reports = [];
for (const width of [1200, 390]) {
  await page.cdp('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 2, mobile: width < 500 });
  await page.goto(url);
  await page.waitForFunction(() => document.body?.dataset.ready === 'true', undefined, { timeout: 20000 });
  const report = await page.evaluate(() => window.__diagramCheck);
  if (!report) throw new Error('Preview must expose window.__diagramCheck');
  const complete = report.frames > 0 && report.drawn === report.frames;
  failed ||= !complete || report.errors > 0 || report.scriptErrors.length > 0;
  reports.push({ width, ...report });
  console.log(width + 'px: ' + report.drawn + '/' + report.frames + ' drawn; errors ' + report.errors + '; hints ' + report.hints + '; JS errors ' + (report.scriptErrors.length ? report.scriptErrors.join('; ') : 'none'));
  for (const item of report.items) {
    if (!item.drawn) { console.log('  ' + item.key + ': not drawn'); continue; }
    console.log('  ' + item.key + ': ' + (item.errors.length ? item.errors.join('; ') : 'pass') + (item.hints.length ? ' [hints] ' + item.hints.join('; ') : ''));
  }
  const keys = await page.evaluate(() => [...document.querySelectorAll('.preview-frame')].filter(frame => frame.querySelector('svg.slide')).map(frame => frame.dataset.key));
  for (const key of keys) {
    if (!/^[a-zA-Z0-9_-]+$/.test(key)) throw new Error('Unsafe frame id: ' + key);
    const { clip, svg } = await page.evaluate(k => {
      const frame = [...document.querySelectorAll('.preview-frame')].find(element => element.dataset.key === k);
      const canvas = frame.querySelector('.preview-slide');
      canvas.scrollIntoView({ block: 'start' });
      const r = canvas.getBoundingClientRect();
      const copy = canvas.querySelector('svg.slide').cloneNode(true);
      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      if (typeof window.__diagramStyle !== 'string' || !window.__diagramStyle) throw new Error('Preview must expose its diagram CSS as window.__diagramStyle');
      style.textContent = window.__diagramStyle; copy.prepend(style);
      return { clip: { x: r.x, y: r.y + scrollY, width: r.width, height: r.height }, svg: new XMLSerializer().serializeToString(copy) };
    }, key);
    const shot = await page.cdp('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } });
    await fs.writeFile(out + '/' + key + '-' + width + '.png', Buffer.from(shot.data, 'base64'));
    if (width === 1200) await fs.writeFile(out + '/' + key + '.svg', svg);
  }
}
await fs.writeFile(out + '/report.json', JSON.stringify({ url, passed: !failed, viewports: reports }, null, 2) + '\n');
await page.cdp('Emulation.clearDeviceMetricsOverride');
await page.cdp('Network.setCacheDisabled', { cacheDisabled: false });
await task.finish({ keep: [] });
console.log('Artifacts:', out);
if (failed) throw new Error('Diagram verification failed; see report.json. Fix the source and regenerate artifacts.');
JS
