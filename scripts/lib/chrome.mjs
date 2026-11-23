// Headless Chrome over the DevTools protocol, with Node built-ins only (fetch, WebSocket, child_process).
// Used by capture.mjs and board.mjs. One browser per call, closed and its profile deleted at the end.
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CANDIDATES = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
];

export function findChrome(env = process.env) {
  if (env.CHROME) return existsSync(env.CHROME) ? env.CHROME : null;
  return CANDIDATES.find((p) => existsSync(p)) || null;
}

export function fail(msg) {
  const e = new Error(msg); e.userFacing = true; return e;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ width, height, scale = 1, chromePath } = {}) {
  if (typeof WebSocket === 'undefined') throw fail(`Node ${process.versions.node} has no global WebSocket. Use Node 22 or later.`);
  const bin = chromePath || findChrome();
  if (!bin) throw fail('Google Chrome not found. Install it or set CHROME to the Chrome binary.');
  const profile = mkdtempSync(join(tmpdir(), 'showrunner-chrome-'));
  const proc = spawn(bin, [
    '--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, `--window-size=${width},${height}`,
    '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-networking', '--force-color-profile=srgb', '--font-render-hinting=none', '--disable-lcd-text',
    '--allow-file-access-from-files', '--mute-audio',
    // Chrome refuses to start as root (Docker, CI, cloud boxes) unless its sandbox is off.
    ...(process.getuid && process.getuid() === 0 ? ['--no-sandbox'] : []),
    'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });

  // Chrome prints the DevTools endpoint on stderr when it picks a free port.
  const wsBrowser = await new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(fail('Chrome did not start within 20 s.')), 20000);
    proc.stderr.on('data', (d) => {
      buf += d.toString();
      const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
      if (m) { clearTimeout(timer); resolve(m[1]); }
    });
    proc.on('exit', (code) => { clearTimeout(timer); reject(fail(`Chrome exited early (code ${code}).`)); });
  });
  const port = new URL(wsBrowser).port;
  let target;
  for (let i = 0; i < 80 && !target; i += 1) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((x) => x.type === 'page'); } catch { /* not up yet */ }
    if (!target) await sleep(100);
  }
  if (!target) { proc.kill(); rmSync(profile, { recursive: true, force: true }); throw fail('Chrome started but opened no page.'); }

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = () => j(fail('Could not connect to Chrome.')); });
  let id = 0; const waiting = new Map(); const events = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && waiting.has(d.id)) { waiting.get(d.id)(d); waiting.delete(d.id); } else if (d.method) events.push(d);
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    id += 1; waiting.set(id, (d) => (d.error ? rej(new Error(`${method}: ${d.error.message}`)) : res(d.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evalJs = async (expression, timeoutMs = 30000) => {
    const call = send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    let handle;
    const timer = new Promise((_, rej) => { handle = setTimeout(() => rej(fail(`Timed out after ${timeoutMs / 1000} s evaluating: ${expression.slice(0, 80)}`)), timeoutMs); });
    let r;
    try { r = await Promise.race([call, timer]); } finally { clearTimeout(handle); }
    if (r.exceptionDetails) throw fail(`Page threw: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    return r.result.value;
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });

  const open = async (url) => {
    const loaded = new Promise((r) => {
      const t0 = Date.now();
      const tick = () => (events.some((e) => e.method === 'Page.loadEventFired') || Date.now() - t0 > 30000 ? r() : setTimeout(tick, 50));
      tick();
    });
    events.length = 0;
    const nav = await send('Page.navigate', { url });
    if (nav.errorText) throw fail(`Could not open ${url}: ${nav.errorText}`);
    await loaded;
  };
  const screenshot = async (clip, format = 'png') => {
    const { data } = await send('Page.captureScreenshot', { format, clip: { ...clip, scale: 1 }, captureBeyondViewport: true, fromSurface: true });
    return Buffer.from(data, 'base64');
  };
  const close = async () => {
    try { await send('Browser.close'); } catch { /* already gone */ }
    try { ws.close(); } catch { /* closed */ }
    await sleep(200); proc.kill();
    proc.stderr.destroy(); proc.unref();
    rmSync(profile, { recursive: true, force: true });
  };
  return { send, evalJs, open, screenshot, close, events };
}

// Run main(); print user-facing errors plainly and exit 1, show a stack for anything unexpected.
export async function runMain(main) {
  try { await main(); } catch (e) {
    process.stderr.write(`${e.userFacing ? 'ERROR: ' + e.message : e.stack}\n`);
    process.exitCode = 1;
  }
}
