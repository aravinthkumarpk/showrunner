#!/usr/bin/env node
// WCAG contrast gate for a seek(t) film page. Node 22+ built-ins and headless Chrome, no npm packages.
//
// At each time it seeks the page, walks every visible text node, finds the text colour and the colour
// behind it, and reports the WCAG 2 contrast ratio per element. The bar is 4.5:1 for normal text and
// 3:1 for large text (24 px, or 18.66 px when bold, measured after any transform scale).
//
// The background comes from one of two places:
//   dom     the ancestors behind the text are plain colours: they are composited from the DOM.
//   pixels  anything else is behind it (a gradient, an image, a canvas, a sibling layer, opacity or a
//           filter): the page is screenshotted with all text made transparent, and the pixels inside
//           the text box are sampled. The reported ratio is the one 90 percent of those pixels meet.
// Text that is only texture is exempt: mark it (or an ancestor) with the attribute data-texture.
// Text whose colour cannot be read (gradient-clipped text, a url() fill) is UNMEASURED: check it by eye.
//
// Usage:
//   node contrast.mjs --url http://127.0.0.1:8471/index.html --times 0.7,4.3,9.3,12.95
//   node contrast.mjs --url ... --times 4.3 --json checks/contrast.json
// Flags: --width 1920 --height 1080 --scale 1 --normal 4.5 --large 3 --json FILE --allow-file
//        --ready-timeout S (default 60) --chrome PATH [CHROME]
// Prints PASS, FAIL or UNVERIFIED per time and one line per text element.
// Exit 0 when every time passes; 1 on any FAIL (or an error); 2 when nothing failed but some time is
// UNVERIFIED (zero text checked there, or an element could not be measured). Unverified is not a pass.
//
// Source: brag (github.com/latent-spaces/brag, MIT), skills/brag/references/step-4-deliver.md, which
// gates WCAG contrast as an error and treats "0 text checks" as unverified.
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { inflateSync } from 'node:zlib';
import { pathToFileURL } from 'node:url';
import { launch, fail, runMain } from './lib/chrome.mjs';
import { checkContract, seekTo } from './capture.mjs';

const num = (name, v, min = 0) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= min) throw fail(`--${name} must be a number above ${min}, got "${v}"`);
  return n;
};

export function parseArgs(argv, env = process.env) {
  const o = { url: env.SITE_URL, width: 1920, height: 1080, scale: 1, normal: 4.5, large: 3, chrome: env.CHROME, readyTimeout: 60, allowFile: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]; const next = () => { i += 1; if (i >= argv.length) throw fail(`${a} needs a value`); return argv[i]; };
    switch (a) {
      case '--url': o.url = next(); break;
      case '--times': o.times = next(); break;
      case '--width': o.width = next(); break;
      case '--height': o.height = next(); break;
      case '--scale': o.scale = next(); break;
      case '--normal': o.normal = next(); break;
      case '--large': o.large = next(); break;
      case '--json': o.json = next(); break;
      case '--allow-file': o.allowFile = true; break;
      case '--ready-timeout': o.readyTimeout = next(); break;
      case '--chrome': o.chrome = next(); break;
      default: throw fail(`Unknown flag ${a}. See the usage at the top of contrast.mjs.`);
    }
  }
  if (!o.url) throw fail('--url is required (or set SITE_URL)');
  if (o.times === undefined) throw fail('--times is required: the board still times and every scene\'s settled time, like 0.7,4.3,9.3');
  const raw = o.times;
  o.times = String(raw).split(',').map((s) => Number(s.trim()));
  if (!o.times.length || o.times.some((t) => !Number.isFinite(t) || t < 0)) throw fail(`--times must be seconds like 0.7,4.3, got "${raw}"`);
  for (const k of ['width', 'height', 'scale', 'normal', 'large', 'readyTimeout']) o[k] = num(k, o[k]);
  return o;
}

// WCAG 2 relative luminance of an sRGB colour [r, g, b] in 0..255.
export function luminance([r, g, b]) {
  const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

export function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// WCAG large text: 18 pt (24 px), or 14 pt (18.66 px) when bold.
export const isLarge = (px, weight) => px >= 24 || (px >= 18.66 && weight >= 700);

// The value that 90 percent of the samples meet or beat.
export function low(values) {
  const s = [...values].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(0.1 * s.length))];
}

const over = (fg, bg) => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3]));
const hex = (c) => '#' + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

// Minimal PNG reader for Chrome screenshots: 8-bit RGB or RGBA, not interlaced.
export function decodePng(buf) {
  if (buf.toString('ascii', 1, 4) !== 'PNG') throw fail('screenshot is not a PNG');
  let i = 8; let width; let height; let type; const idat = [];
  while (i < buf.length) {
    const len = buf.readUInt32BE(i); const kind = buf.toString('ascii', i + 4, i + 8); const body = buf.subarray(i + 8, i + 8 + len);
    if (kind === 'IHDR') {
      width = body.readUInt32BE(0); height = body.readUInt32BE(4); type = body[9];
      if (body[8] !== 8 || ![2, 6].includes(type) || body[12] !== 0) throw fail(`unsupported screenshot PNG (depth ${body[8]}, colour type ${body[9]}, interlace ${body[12]})`);
    } else if (kind === 'IDAT') idat.push(body);
    else if (kind === 'IEND') break;
    i += 12 + len;
  }
  const ch = type === 6 ? 4 : 3; const stride = width * ch;
  const raw = inflateSync(Buffer.concat(idat)); const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    const f = raw[y * (stride + 1)]; const src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x += 1) {
      const a = x >= ch ? out[y * stride + x - ch] : 0; const b = y ? out[(y - 1) * stride + x] : 0;
      const c = x >= ch && y ? out[(y - 1) * stride + x - ch] : 0;
      let v = src[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c; const pa = Math.abs(p - a); const pb = Math.abs(p - b); const pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[y * stride + x] = v & 255;
    }
  }
  return { width, height, ch, data: out };
}

// Runs inside the page. Returns one row per visible text node, plus the counts it skipped.
function measurePage() {
  const cv = document.createElement('canvas'); cv.width = 1; cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (css) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = css; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const blend = (f, b) => [0, 1, 2].map((i) => f[i] * f[3] + b[i] * (1 - f[3])).concat(1);
  const name = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/).join('.') : '');
  const pe = document.createElement('style'); pe.textContent = '*{pointer-events:auto!important}'; document.head.append(pe);
  const vw = innerWidth; const vh = innerHeight;
  const rows = []; let exempt = 0; let hidden = 0;
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    const text = n.nodeValue.replace(/\s+/g, ' ').trim();
    const el = n.parentElement;
    if (!text || !el || el.closest('script,style,noscript,template,title')) continue;
    if (!el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) { hidden += 1; continue; }
    let op = 1; for (let a = el; a; a = a.parentElement) op *= parseFloat(getComputedStyle(a).opacity);
    if (op < 0.05) { hidden += 1; continue; }
    const range = document.createRange(); range.selectNodeContents(n);
    const rects = [...range.getClientRects()].map((r) => {
      const x = Math.max(0, r.left); const y = Math.max(0, r.top);
      return { x, y, w: Math.min(vw, r.right) - x, h: Math.min(vh, r.bottom) - y };
    }).filter((r) => r.w > 0.5 && r.h > 0.5);
    if (!rects.length) { hidden += 1; continue; }
    const big = rects.reduce((m, r) => (r.w * r.h > m.w * m.h ? r : m));
    const stack = document.elementsFromPoint(big.x + big.w / 2, big.y + big.h / 2);
    const at = stack.indexOf(el);
    if (at === -1 || stack.slice(0, at).some((e) => !el.contains(e))) { hidden += 1; continue; } // covered or clipped
    if (el.closest('[data-texture]')) { exempt += 1; continue; }
    const cs = getComputedStyle(el); const svg = el instanceof SVGElement;
    const fgCss = svg ? cs.fill : cs.color;
    let scale = 1;
    if (svg && el.getScreenCTM()) { const m = el.getScreenCTM(); scale = Math.sqrt(Math.abs(m.a * m.d - m.b * m.c)); } else if (el.offsetHeight) scale = el.getBoundingClientRect().height / el.offsetHeight;
    if (!Number.isFinite(scale) || scale < 0.01) scale = 1;
    const row = { text: text.slice(0, 60), selector: name(el), font_px: Math.round(parseFloat(cs.fontSize) * scale * 100) / 100, weight: parseInt(cs.fontWeight, 10) || 400, rects };
    const clipText = cs.backgroundClip === 'text' || cs.webkitBackgroundClip === 'text';
    const fg = /url\(/.test(fgCss) || clipText ? null : rgba(fgCss);
    if (!fg || fg[3] === 0) { rows.push({ ...row, unmeasured: 'its colour comes from a gradient, an image or a transparent fill' }); continue; }
    fg[3] *= op; row.fg = fg;
    let source = op < 0.999 || svg ? 'pixels' : 'dom'; const layers = [];
    for (const e of stack.slice(at)) {
      if (source === 'pixels') break;
      const s = getComputedStyle(e);
      if (!e.contains(el) || e instanceof SVGElement || s.backgroundImage !== 'none' || s.filter !== 'none' || s.mixBlendMode !== 'normal' || (s.backdropFilter && s.backdropFilter !== 'none')) { source = 'pixels'; break; }
      const c = rgba(s.backgroundColor);
      if (c[3] > 0) layers.push(c);
      if (c[3] >= 0.999) break;
    }
    if (source === 'dom' && !(layers.length && layers[layers.length - 1][3] >= 0.999)) source = 'pixels';
    row.source = source;
    if (source === 'dom') row.bg = layers.reduceRight((acc, c) => blend(c, acc));
    rows.push(row);
  }
  pe.remove();
  return { rows, exempt, hidden };
}

const HIDE_TEXT = '*,*::before,*::after,*::marker,*::placeholder{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;-webkit-text-stroke:0!important;text-decoration-color:transparent!important;caret-color:transparent!important}svg text,svg tspan,svg textPath{fill:transparent!important;stroke:transparent!important}';
const raf2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))';

function samplePixels(img, rects, scale) {
  const px = [];
  for (const r of rects) {
    const x0 = Math.floor(r.x * scale); const y0 = Math.floor(r.y * scale);
    const x1 = Math.min(img.width - 1, Math.ceil((r.x + r.w) * scale) - 1); const y1 = Math.min(img.height - 1, Math.ceil((r.y + r.h) * scale) - 1);
    const sx = Math.max(1, (x1 - x0) / 24); const sy = Math.max(1, (y1 - y0) / 6);
    for (let y = y0; y <= y1; y += sy) for (let x = x0; x <= x1; x += sx) {
      const k = (Math.round(y) * img.width + Math.round(x)) * img.ch;
      px.push([img.data[k], img.data[k + 1], img.data[k + 2]]);
    }
  }
  return px;
}

export async function checkTime(page, o, t) {
  await seekTo(page, t);
  const m = await page.evalJs(`(${measurePage.toString()})()`);
  let img = null;
  if (m.rows.some((r) => r.source === 'pixels')) {
    await page.evalJs(`(() => { const s = document.createElement('style'); s.id = '__contrast_hide'; s.textContent = ${JSON.stringify(HIDE_TEXT)}; document.head.append(s); return ${raf2}; })()`);
    img = decodePng(await page.screenshot({ x: 0, y: 0, width: o.width, height: o.height }));
    await page.evalJs(`(() => { document.getElementById('__contrast_hide').remove(); return ${raf2}; })()`);
  }
  const rows = m.rows.map(({ rects, fg, bg, ...r }) => {
    if (r.unmeasured) return { ...r, pass: null };
    r.large = isLarge(r.font_px, r.weight); r.need = r.large ? o.large : o.normal; r.fg = hex(fg);
    if (r.source === 'dom') {
      r.ratio = ratio(over(fg, bg), bg); r.bg = hex(bg);
    } else {
      const pairs = samplePixels(img, rects, o.scale).map((p) => ({ p, v: ratio(over(fg, p), p) }));
      if (!pairs.length) return { ...r, unmeasured: 'no pixels behind it inside the viewport', pass: null };
      const v = low(pairs.map((x) => x.v)); r.ratio = v; r.bg = hex(pairs.find((x) => x.v === v).p);
    }
    r.ratio = Math.floor(r.ratio * 100) / 100; r.pass = r.ratio >= r.need;
    return r;
  });
  const checked = rows.filter((r) => r.pass !== null);
  const failed = checked.filter((r) => !r.pass).length; const unmeasured = rows.length - checked.length;
  const status = failed ? 'FAIL' : checked.length === 0 || unmeasured ? 'UNVERIFIED' : 'PASS';
  return { t, status, checked: checked.length, failed, unmeasured, exempt: m.exempt, hidden: m.hidden, rows };
}

function print(r) {
  const why = r.status === 'FAIL' ? `${r.failed} of ${r.checked} text element(s) under the bar`
    : r.checked === 0 ? 'zero text elements checked, so contrast here is unverified, not passed'
      : r.unmeasured ? `${r.unmeasured} element(s) could not be measured; check them by eye` : `${r.checked} text element(s) checked`;
  console.log(`${r.status.padEnd(10)} ${r.t.toFixed(2)} s  ${why} (${r.exempt} exempt as texture, ${r.hidden} hidden)`);
  for (const x of r.rows) {
    if (x.pass === null) { console.log(`  UNMEASURED  ${x.font_px}px ${x.weight}  "${x.text}"  ${x.selector}: ${x.unmeasured}`); continue; }
    console.log(`  ${x.pass ? 'PASS' : 'FAIL'} ${x.ratio.toFixed(2)}:1 needs ${x.need}  ${x.font_px}px ${x.weight}${x.large ? ' large' : ''}  ${x.fg} on ${x.bg}  ${x.source.padEnd(6)}  "${x.text}"  ${x.selector}`);
  }
}

async function main() {
  const o = parseArgs(process.argv.slice(2));
  const page = await launch({ width: o.width, height: o.height, scale: o.scale, chromePath: o.chrome });
  const results = [];
  try {
    await page.open(o.url);
    const duration = await checkContract(page, o);
    for (const t of o.times) if (t > duration) throw fail(`Time ${t} s is past window.DURATION (${duration} s).`);
    for (const t of o.times) { const r = await checkTime(page, o, t); results.push(r); print(r); }
  } finally {
    await page.close();
  }
  const count = (s) => results.filter((r) => r.status === s).length;
  console.log(`contrast: ${count('FAIL')} FAIL, ${count('UNVERIFIED')} UNVERIFIED, ${count('PASS')} PASS, over ${results.length} time(s)`);
  if (o.json) writeFileSync(resolve(o.json), JSON.stringify({ url: o.url, width: o.width, height: o.height, scale: o.scale, normal: o.normal, large: o.large, times: results }, null, 2));
  process.exitCode = count('FAIL') ? 1 : count('UNVERIFIED') ? 2 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) runMain(main);
