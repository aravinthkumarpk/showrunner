#!/usr/bin/env node
// Compose a storyboard sheet: 6 to 9 panel images plus their captions, in one PNG.
// It writes an HTML page beside the PNG and renders it with the same headless Chrome as capture.mjs.
// Node 22+ built-ins only.
//
// Usage: node board.mjs film/board/board-v2.json [--out-dir film/board]
// Writes board-v<version>.png and board-v<version>.html. It never overwrites a version: bump it.
//
// board JSON (image paths are relative to the JSON file):
// {
//   "film": "Launch film", "version": 2, "changelog": "Opening cut from 3 s to 1 s.",
//   "track": "synth score, C major, 120 BPM", "duration_s": 20, "line": "Anyone can build an agent.",
//   "panels": [
//     { "time": "0 to 1 s", "image": "t_00.70.png", "frame": "What the viewer sees",
//       "words": "On-screen words, exactly (use \"\" for none)", "tool": "code (seek(t))",
//       "sound": "kick on beat 1", "cost_usd": 0,
//       "options": [ { "label": "A: hard cut", "image": "a.png" }, { "label": "B: glide", "image": "b.png" } ] }
//   ]
// }
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launch, fail, runMain } from './lib/chrome.mjs';

const FIELDS = ['time', 'image', 'frame', 'words', 'tool', 'sound', 'cost_usd'];
const WIDTH = 2400;

export function validateBoard(b, baseDir) {
  if (!b || typeof b !== 'object') throw fail('The board must be a JSON object.');
  for (const k of ['film', 'version', 'track', 'line']) if (b[k] === undefined || b[k] === '') throw fail(`Board is missing "${k}".`);
  if (!Number.isInteger(b.version) || b.version < 1) throw fail(`"version" must be a whole number from 1, got ${JSON.stringify(b.version)}.`);
  if (b.version >= 2) {
    if (!b.changelog || typeof b.changelog !== 'string') throw fail(`Board v${b.version} needs a "changelog": one line on what changed since v${b.version - 1}.`);
    if (/\n/.test(b.changelog.trim())) throw fail('"changelog" must be one line. Put the detail in the ledger.');
  }
  if (!Array.isArray(b.panels) || b.panels.length < 6 || b.panels.length > 9) {
    throw fail(`A board has 6 to 9 panels, this one has ${Array.isArray(b.panels) ? b.panels.length : 'none'}. Merge or split beats.`);
  }
  b.panels.forEach((p, i) => {
    for (const k of FIELDS) {
      if (p[k] === undefined || p[k] === null || (k !== 'words' && p[k] === '')) throw fail(`panel ${i + 1} is missing "${k}". Every panel names frame, time, on-screen words, the tool that makes it, the sound cue and the cost.`);
    }
    if (typeof p.cost_usd !== 'number' || p.cost_usd < 0) throw fail(`panel ${i + 1}: "cost_usd" must be a number, 0 for code-rendered beats.`);
    const imgs = [p.image];
    if (p.options !== undefined) {
      if (!Array.isArray(p.options) || p.options.length < 2 || p.options.some((o) => !o.label || !o.image)) throw fail(`panel ${i + 1}: "options" needs two or more { label, image } entries.`);
      imgs.push(...p.options.map((o) => o.image));
    }
    for (const im of imgs) if (!existsSync(resolve(baseDir, im))) throw fail(`panel ${i + 1}: image not found: ${im}`);
  });
  return b;
}

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const usd = (n) => `USD ${n.toFixed(2)}`;

export function boardHtml(b, baseDir) {
  const src = (im) => pathToFileURL(resolve(baseDir, im)).href;
  const total = b.panels.reduce((s, p) => s + p.cost_usd, 0);
  const card = (p, i) => {
    const pic = p.options
      ? `<div class="opts">${p.options.map((o) => `<figure><img src="${src(o.image)}"><figcaption>${esc(o.label)}</figcaption></figure>`).join('')}</div>`
      : `<img class="hero" src="${src(p.image)}">`;
    const words = p.words === '' ? '<span class="none">no words on screen</span>' : `&ldquo;${esc(p.words)}&rdquo;`;
    return `<section class="card">${pic}
      <div class="row"><span class="n">${i + 1}</span><span class="t">${esc(p.time)}</span>${p.options ? '<span class="choose">choose one</span>' : ''}</div>
      <div class="w">${words}</div>
      <div class="d">${esc(p.frame)}</div>
      <div class="chips"><span><b>Tool</b> ${esc(p.tool)}</span><span><b>Sound</b> ${esc(p.sound)}</span><span class="${p.cost_usd > 0 ? 'cost spend' : 'cost'}"><b>Cost</b> ${usd(p.cost_usd)}</span></div>
    </section>`;
  };
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(b.film)} board v${b.version}</title><style>
:root{--ink:#0C1927;--sub:#4A5568;--line:#E3E8F0;--blue:#305EFF;--bg:#F5F7FB;--spend:#B42318}
*{margin:0;box-sizing:border-box}
html,body{width:${WIDTH}px;background:var(--bg);color:var(--ink);font-family:'Inter','Inter Tight',system-ui,-apple-system,'Segoe UI',sans-serif}
header{padding:56px 64px 28px;display:grid;grid-template-columns:1fr auto;gap:12px 48px;align-items:end}
h1{font-family:'TASA Orbiter Display','TASA Orbiter','Inter Tight','Inter',system-ui,sans-serif;font-size:52px;font-weight:650;letter-spacing:-.025em;line-height:1.05}
h1 em{font-style:normal;color:var(--blue)}
.meta{font-size:21px;color:var(--sub);line-height:1.5}.meta b{color:var(--ink);font-weight:600}
.total{text-align:right;font-size:20px;color:var(--sub)}.total strong{display:block;font-size:40px;color:var(--ink);font-weight:650;letter-spacing:-.02em}
.log{grid-column:1/-1;font-size:20px;color:var(--ink);background:#fff;border:1px solid var(--line);border-radius:10px;padding:12px 18px}
.log b{color:var(--blue)}
main{display:grid;grid-template-columns:repeat(3,1fr);gap:36px 36px;padding:8px 64px 40px}
.card{background:#fff;border:1px solid var(--line);border-radius:12px;padding:16px 16px 20px;box-shadow:0 2px 10px rgba(12,25,39,.05)}
.hero{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;display:block;background:#0C1927}
.opts{display:grid;grid-auto-flow:column;grid-auto-columns:1fr;gap:10px}
.opts figure{margin:0}.opts img{width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:8px;display:block;outline:2px dashed var(--blue);outline-offset:2px}
.opts figcaption{font-size:17px;font-weight:600;color:var(--blue);margin-top:8px}
.row{display:flex;gap:12px;align-items:center;margin-top:14px}
.n{width:30px;height:30px;border-radius:15px;background:var(--ink);color:#fff;font-size:16px;font-weight:700;display:grid;place-items:center}
.t{font-size:18px;font-weight:700;color:var(--blue);font-variant-numeric:tabular-nums}
.choose{margin-left:auto;font-size:15px;font-weight:600;color:var(--blue);border:1px solid var(--blue);border-radius:6px;padding:2px 8px}
.w{font-size:24px;font-weight:650;letter-spacing:-.01em;margin-top:8px;line-height:1.3}.none{color:var(--sub);font-weight:500;font-style:italic}
.d{font-size:18px;color:var(--sub);margin-top:6px;line-height:1.45}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.chips span{font-size:15px;background:var(--bg);border:1px solid var(--line);border-radius:6px;padding:4px 9px;color:var(--ink)}
.chips b{font-weight:600;color:var(--sub);margin-right:4px}
.cost.spend{border-color:var(--spend);color:var(--spend)}
footer{padding:0 64px 48px;font-size:18px;color:var(--sub)}
</style></head><body>
<header>
  <div><h1>${esc(b.film)} <em>board v${b.version}</em></h1>
  <div class="meta"><b>Line:</b> &ldquo;${esc(b.line)}&rdquo; &nbsp;·&nbsp; <b>Track:</b> ${esc(b.track)}${b.duration_s ? ` &nbsp;·&nbsp; <b>Length:</b> ${esc(b.duration_s)} s` : ''} &nbsp;·&nbsp; ${b.panels.length} panels</div></div>
  <div class="total">Build cost if locked<strong>${usd(total)}</strong></div>
  ${b.version >= 2 ? `<div class="log"><b>Changed since v${b.version - 1}:</b> ${esc(b.changelog)}</div>` : ''}
</header>
<main>${b.panels.map(card).join('')}</main>
<footer>Say &ldquo;lock the board&rdquo; to move to production. Any change after the lock is a new board version, not a patch.</footer>
</body></html>`;
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  if (!file) throw fail('Usage: node board.mjs <board.json> [--out-dir DIR]');
  const oi = args.indexOf('--out-dir');
  const jsonPath = resolve(file); const baseDir = dirname(jsonPath);
  const outDir = oi >= 0 ? resolve(args[oi + 1]) : baseDir;
  if (!existsSync(jsonPath)) throw fail(`Board file not found: ${jsonPath}`);
  let b;
  try { b = JSON.parse(readFileSync(jsonPath, 'utf8')); } catch (e) { throw fail(`${basename(jsonPath)} is not valid JSON: ${e.message}`); }
  validateBoard(b, baseDir);
  const png = join(outDir, `board-v${b.version}.png`); const html = join(outDir, `board-v${b.version}.html`);
  if (existsSync(png)) throw fail(`${png} already exists. Boards are versioned: set "version": ${b.version + 1} and a one-line "changelog".`);
  writeFileSync(html, boardHtml(b, baseDir));
  const page = await launch({ width: WIDTH, height: 1200 });
  try {
    await page.open(pathToFileURL(html).href);
    await page.evalJs('document.fonts.ready.then(() => Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = r; i.onerror = r; }))))');
    const bad = await page.evalJs('[...document.images].filter((i) => i.naturalWidth === 0).map((i) => decodeURIComponent(i.src))');
    if (bad.length) throw fail(`Image(s) failed to render on the board: ${bad.join(', ')}`);
    const height = await page.evalJs('Math.ceil(document.documentElement.scrollHeight)');
    await page.send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height, deviceScaleFactor: 1, mobile: false });
    writeFileSync(png, await page.screenshot({ x: 0, y: 0, width: WIDTH, height }));
  } finally { await page.close(); }
  const total = b.panels.reduce((s, p) => s + p.cost_usd, 0);
  console.log(`board v${b.version}: ${png} (${b.panels.length} panels, build cost ${usd(total)})`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) runMain(main);
