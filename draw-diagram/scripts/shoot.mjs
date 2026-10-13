#!/usr/bin/env node
// Capture a generated or integrated diagram preview, export SVGs and fail incomplete/error reports.
// Usage: node shoot.mjs <preview-url> <output-directory> [--widths=1200,390] [--check-only]
// --widths: viewport widths to verify (default 1200); add 390 only when mobile display matters.
// --check-only: run geometry/semantic checks and write report.json without screenshots or SVG export.
// Requires Node >= 22 (built-in WebSocket) and a local Chrome/Edge/Chromium (override with BROWSER).
// The preview exposes __diagramCheck and __diagramStyle.
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const args = process.argv.slice(2);
const checkOnly = args.includes('--check-only');
const widthsArg = args.find(arg => arg.startsWith('--widths='));
const widths = widthsArg
  ? widthsArg.slice('--widths='.length).split(',').map(Number)
  : [1200];
if (!widths.length || widths.some(width => !Number.isInteger(width) || width <= 0)) {
  console.error('--widths must be a comma-separated list of positive integers');
  process.exit(2);
}
const [url, out] = args.filter(arg => !arg.startsWith('--'));
if (!url || !out) {
  console.error('Usage: node shoot.mjs <preview-url> <output-directory> [--widths=1200,390] [--check-only]');
  process.exit(2);
}

function browserCandidates() {
  const env = [process.env.BROWSER, process.env.CHROME_PATH].filter(Boolean);
  const roots = {
    win32: [process.env['PROGRAMFILES(X86)'], process.env.PROGRAMFILES, process.env.LOCALAPPDATA]
      .filter(Boolean)
      .flatMap(root => [
        path.join(root, 'Microsoft/Edge/Application/msedge.exe'),
        path.join(root, 'Google/Chrome/Application/chrome.exe'),
        path.join(root, 'Chromium/Application/chrome.exe'),
      ]),
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
    ],
    linux: [
      '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/microsoft-edge',
      '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium',
    ],
  };
  return [...env, ...(roots[process.platform] ?? [])];
}

const browserPath = browserCandidates().find(candidate => existsSync(candidate));
if (!browserPath) {
  console.error('A local Chrome, Edge or Chromium is required; set BROWSER to its executable path.');
  process.exit(2);
}

// --- Minimal CDP client over the browser-level WebSocket (Node >= 22) ---
class Cdp {
  static async connect(wsUrl) {
    const socket = new WebSocket(wsUrl);
    const cdp = new Cdp(socket);
    socket.onmessage = event => {
      const message = JSON.parse(event.data);
      if (message.id && cdp.pending.has(message.id)) {
        const { resolve, reject } = cdp.pending.get(message.id);
        cdp.pending.delete(message.id);
        message.error ? reject(new Error(message.error.message)) : resolve(message.result);
      }
    };
    await new Promise((resolve, reject) => {
      socket.onopen = resolve;
      socket.onerror = () => reject(new Error('Cannot connect to browser DevTools'));
    });
    return cdp;
  }

  constructor(socket) {
    this.socket = socket;
    this.pending = new Map();
    this.nextId = 1;
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    this.socket.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  close() { try { this.socket.close(); } catch { /* already closed */ } }
}

async function evaluate(cdp, sessionId, expression) {
  const { result, exceptionDetails } = await cdp.send('Runtime.evaluate',
    { expression, returnByValue: true, awaitPromise: true }, sessionId);
  if (exceptionDetails) throw new Error('Page evaluation failed: ' + (exceptionDetails.exception?.description || exceptionDetails.text));
  return result.value;
}

async function waitForReady(cdp, sessionId, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(cdp, sessionId, "document.body?.dataset.ready === 'true'")) return;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error('Preview did not become ready within ' + timeoutMs + 'ms');
}

// --- Launch a throwaway headless browser ---
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'diagram-shoot-'));
const browser = spawn(browserPath, [
  '--headless=new', '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check',
  '--user-data-dir=' + profile, 'about:blank',
], { stdio: ['ignore', 'ignore', 'pipe'] });

const wsUrl = await new Promise((resolve, reject) => {
  let buffer = '';
  browser.stderr.on('data', chunk => {
    buffer += chunk;
    const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/);
    if (match) resolve(match[1]);
  });
  browser.on('error', reject);
  browser.on('exit', code => reject(new Error('Browser exited before DevTools was ready (code ' + code + ')')));
});

function killBrowser() {
  if (process.platform === 'win32' && browser.pid) {
    spawn('taskkill', ['/pid', String(browser.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    try { browser.kill('SIGKILL'); } catch { /* already exited */ }
  }
}

let cdp;
try {
  await fs.mkdir(out, { recursive: true });
  cdp = await Cdp.connect(wsUrl);
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  console.log('Browser:', path.basename(browserPath), '(headless)');
  // Bypass only this session's HTTP cache.
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true }, sessionId);

  let failed = false;
  const reports = [];
  for (const width of widths) {
    await cdp.send('Emulation.setDeviceMetricsOverride',
      { width, height: 900, deviceScaleFactor: 2, mobile: width < 500 }, sessionId);
    await cdp.send('Page.navigate', { url }, sessionId);
    await waitForReady(cdp, sessionId, 20000);
    const report = await evaluate(cdp, sessionId, 'window.__diagramCheck');
    if (!report) throw new Error('Preview must expose window.__diagramCheck');
    const complete = report.frames > 0 && report.drawn === report.frames;
    failed ||= !complete || report.errors > 0 || report.scriptErrors.length > 0;
    reports.push({ width, ...report });
    console.log(width + 'px: ' + report.drawn + '/' + report.frames + ' drawn; errors ' + report.errors +
      '; hints ' + report.hints + '; JS errors ' + (report.scriptErrors.length ? report.scriptErrors.join('; ') : 'none'));
    for (const item of report.items) {
      if (!item.drawn) { console.log('  ' + item.key + ': not drawn'); continue; }
      console.log('  ' + item.key + ': ' + (item.errors.length ? item.errors.join('; ') : 'pass') +
        (item.hints.length ? ' [hints] ' + item.hints.join('; ') : ''));
      if (item.geometry && item.semantic) {
        console.log('    geometry: errors ' + item.geometry.errors.length + ', hints ' + item.geometry.hints.length +
          '; semantic: errors ' + item.semantic.errors.length + ', hints ' + item.semantic.hints.length);
      }
    }
    if (!checkOnly) {
      const keys = await evaluate(cdp, sessionId,
        "[...document.querySelectorAll('.preview-frame')].filter(frame => frame.querySelector('svg.slide')).map(frame => frame.dataset.key)");
      for (const key of keys) {
        if (!/^[a-zA-Z0-9_-]+$/.test(key)) throw new Error('Unsafe frame id: ' + key);
        const { clip, svg } = await evaluate(cdp, sessionId, `(k => {
          const frame = [...document.querySelectorAll('.preview-frame')].find(element => element.dataset.key === k);
          const canvas = frame.querySelector('.preview-slide');
          canvas.scrollIntoView({ block: 'start' });
          const r = canvas.getBoundingClientRect();
          const copy = canvas.querySelector('svg.slide').cloneNode(true);
          const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
          if (typeof window.__diagramStyle !== 'string' || !window.__diagramStyle) throw new Error('Preview must expose its diagram CSS as window.__diagramStyle');
          style.textContent = window.__diagramStyle; copy.prepend(style);
          return { clip: { x: r.x, y: r.y + scrollY, width: r.width, height: r.height }, svg: new XMLSerializer().serializeToString(copy) };
        })(${JSON.stringify(key)})`);
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { ...clip, scale: 1 } }, sessionId);
        await fs.writeFile(path.join(out, key + '-' + width + '.png'), Buffer.from(shot.data, 'base64'));
        if (width === widths[0]) await fs.writeFile(path.join(out, key + '.svg'), svg);
      }
    }
  }
  await fs.writeFile(path.join(out, 'report.json'), JSON.stringify({ url, passed: !failed, viewports: reports }, null, 2) + '\n');
  await cdp.send('Emulation.clearDeviceMetricsOverride', {}, sessionId);
  console.log('Artifacts:', out);
  if (failed) {
    console.error('Diagram verification failed; see report.json. Fix the source and regenerate artifacts.');
    process.exitCode = 1;
  }
} finally {
  cdp?.close();
  killBrowser();
  await fs.rm(profile, { recursive: true, force: true }).catch(() => {});
}
