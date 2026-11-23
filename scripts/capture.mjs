#!/usr/bin/env node
// Capture stills or every frame of a code-rendered film page with headless Chrome.
// Generalised from the capture script of an earlier locked film. Node 22+ built-ins only, no npm packages.
//
// The page contract (the film page must provide all three):
//   window.DURATION  seconds, a finite number above 0
//   window.seek(t)   sets every style from t alone (it may return a promise)
//   window.ready     a promise that resolves truthy once fonts, images and shaders are ready
//
// Usage:
//   node capture.mjs --url http://127.0.0.1:8471/index.html --stills 0.7,4.3,19.9 --out board/
//   node capture.mjs --url http://127.0.0.1:8471/index.html --frames --fps 30 --out frames/
//   node capture.mjs --url ... --frames --fps 60 --scale 2 --out frames4k/ --resume
//   Mid-transition stills before any full render: for a seam from 4.0 to 4.6 s, take its start, middle
//   and end, plus each scene's settled time, and look at every one (a plain crossfade between two busy
//   layouts shows as a muddy double image at the middle):
//   node capture.mjs --url ... --stills 3.5,4.0,4.15,4.3,4.45,4.6,5.2 --out checks/seams/
// Flags (env fallback in brackets):
//   --url [SITE_URL]  --out [OUT_DIR]  --width [WIDTH] 1920  --height [HEIGHT] 1080
//   --scale [SCALE] 1 (2 gives a true 4K from a 1920x1080 layout)  --fps [FPS] 30
//   --first N --last N (frame range)  --resume (skip frames already on disk)
//   --allow-file (permit file:// for a page with images, canvas or video; see below)
//   --ready-timeout S (default 60)  --chrome PATH [CHROME]
//
// Why file:// is refused: a WebGL shader cannot read images from file:// (cross-origin taint), so the
// A WebGL gradient on an earlier film silently failed to start until the site was served over http. Serve it:
//   python3 -m http.server 8471 --bind 127.0.0.1 --directory site
import { mkdirSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, fail, runMain } from './lib/chrome.mjs';

const num = (name, v, { min = 0, int = false } = {}) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= min || (int && !Number.isInteger(n))) throw fail(`--${name} must be a number above ${min}, got "${v}"`);
  return n;
};

export function parseArgs(argv, env = process.env) {
  const o = { url: env.SITE_URL, out: env.OUT_DIR, width: env.WIDTH ?? 1920, height: env.HEIGHT ?? 1080, scale: env.SCALE ?? 1, fps: env.FPS ?? 30, chrome: env.CHROME, readyTimeout: 60, resume: false, allowFile: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]; const next = () => { i += 1; if (i >= argv.length) throw fail(`${a} needs a value`); return argv[i]; };
    switch (a) {
      case '--url': o.url = next(); break;
      case '--out': o.out = next(); break;
      case '--width': o.width = next(); break;
      case '--height': o.height = next(); break;
      case '--scale': o.scale = next(); break;
      case '--fps': o.fps = next(); break;
      case '--stills': o.mode = 'stills'; o.times = next(); break;
      case '--frames': o.mode = 'frames'; break;
      case '--first': o.first = next(); break;
      case '--last': o.last = next(); break;
      case '--resume': o.resume = true; break;
      case '--allow-file': o.allowFile = true; break;
      case '--ready-timeout': o.readyTimeout = next(); break;
      case '--chrome': o.chrome = next(); break;
      default: throw fail(`Unknown flag ${a}. See the usage at the top of capture.mjs.`);
    }
  }
  if (!o.url) throw fail('--url is required (or set SITE_URL)');
  if (!o.mode) throw fail('Pick a mode: --stills or --frames (for example --stills 0.5,1.2)');
  if (!o.out) throw fail('--out is required (or set OUT_DIR)');
  o.width = num('width', o.width, { int: true }); o.height = num('height', o.height, { int: true });
  o.scale = num('scale', o.scale); o.fps = num('fps', o.fps); o.readyTimeout = num('ready-timeout', o.readyTimeout);
  if (o.mode === 'stills') {
    o.times = String(o.times).split(',').map((s) => Number(s.trim()));
    if (!o.times.length || o.times.some((t) => !Number.isFinite(t) || t < 0)) throw fail(`--stills must be times in seconds like 0.5,1.2, got "${argv[argv.indexOf('--stills') + 1]}"`);
  }
  for (const k of ['first', 'last']) if (o[k] !== undefined) { const n = Number(o[k]); if (!Number.isInteger(n) || n < 0) throw fail(`--${k} must be a frame number 0 or above`); o[k] = n; }
  return o;
}

const stillName = (t) => `t_${t.toFixed(2).padStart(5, '0')}.png`;
const frameName = (f) => `f_${String(f).padStart(5, '0')}.png`;

export async function checkContract(page, o) {
  // The file:// check runs before waiting on ready, because a tainted shader can stall ready forever.
  if (o.url.startsWith('file://') && !o.allowFile) {
    const media = await page.evalJs('document.querySelectorAll("img,canvas,video,image").length + (window.NEEDS_HTTP ? 1 : 0)');
    if (media > 0) throw fail(`This page has ${media} image, canvas or video element(s) and is opened from file://. Shaders cannot read images from file://, so serve the folder over http (python3 -m http.server 8471 --bind 127.0.0.1 --directory <site>) and pass that URL. Use --allow-file only if you know the page needs no http.`);
  }
  const kind = await page.evalJs('typeof window.ready');
  if (kind === 'undefined') throw fail('Page contract broken: window.ready is missing. Set window.ready to a promise that resolves once fonts, images and shaders are loaded.');
  const ok = await page.evalJs('Promise.resolve(window.ready).then((v) => !!v)', o.readyTimeout * 1000);
  if (!ok) throw fail('window.ready resolved to a falsy value, so the page says it is not ready.');
  const dur = await page.evalJs('window.DURATION');
  if (!(typeof dur === 'number' && Number.isFinite(dur) && dur > 0)) throw fail(`Page contract broken: window.DURATION must be seconds above 0, got ${JSON.stringify(dur)}.`);
  if ((await page.evalJs('typeof window.seek')) !== 'function') throw fail('Page contract broken: window.seek(t) is missing.');
  const bad = await page.evalJs('[...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute("src") || i.currentSrc)');
  if (bad.length) throw fail(`${bad.length} image(s) did not load: ${bad.join(', ')}. Fix the paths before capturing.`);
  await page.evalJs('document.fonts.ready.then(() => document.fonts.status)');
  return dur;
}

// Seek the page to t and wait two animation frames. Also pause and seek any CSS or Web Animations,
// so stray transitions cannot drift between frames. contrast.mjs uses the same call.
export async function seekTo(page, t) {
  await page.evalJs(`Promise.resolve(window.seek(${t})).then(() => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = ${t * 1000}; } return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1)))); })`);
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const out = resolve(o.out);
  mkdirSync(out, { recursive: true });
  if (o.mode === 'frames' && !o.resume && readdirSync(out).some((f) => /^f_\d+\.png$/.test(f))) {
    throw fail(`${out} already holds frames. Pass --resume to keep them and capture only the missing ones, or delete the folder.`);
  }
  const page = await launch({ width: o.width, height: o.height, scale: o.scale, chromePath: o.chrome });
  try {
    await page.open(o.url);
    const duration = await checkContract(page, o);
    const clip = { x: 0, y: 0, width: o.width, height: o.height };
    const shot = async (t, file) => {
      await seekTo(page, t);
      writeFileSync(file, await page.screenshot(clip));
    };
    if (o.mode === 'stills') {
      for (const t of o.times) {
        if (t > duration) throw fail(`Still at ${t} s is past window.DURATION (${duration} s).`);
        await shot(t, join(out, stillName(t)));
      }
      console.log(`done: ${o.times.length} still(s) in ${out}`);
      return;
    }
    const total = Math.round(duration * o.fps);
    const first = o.first ?? 0; const last = o.last ?? total - 1;
    if (first > last || last >= total) throw fail(`Frame range ${first} to ${last} is outside 0 to ${total - 1}.`);
    const manifest = { url: o.url, width: o.width, height: o.height, scale: o.scale, pixels: `${Math.round(o.width * o.scale)}x${Math.round(o.height * o.scale)}`, fps: o.fps, duration, frames: total, first, last, pattern: 'f_%05d.png', status: 'capturing', started: new Date().toISOString() };
    writeFileSync(join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
    const t0 = Date.now(); let made = 0;
    for (let f = first; f <= last; f += 1) {
      const file = join(out, frameName(f));
      if (o.resume && existsSync(file) && statSync(file).size > 0) continue;
      await shot(f / o.fps, file); made += 1;
      if (made % 60 === 0) {
        const per = (Date.now() - t0) / made; const left = Math.round((per * (last - f)) / 1000);
        console.log(`frame ${f}/${total - 1}, about ${left} s left`);
      }
    }
    writeFileSync(join(out, 'manifest.json'), JSON.stringify({ ...manifest, status: 'done', finished: new Date().toISOString() }, null, 2));
    console.log(`done: ${made} new frame(s), ${last - first + 1} in range, in ${out}`);
  } finally {
    await page.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) runMain(main);
