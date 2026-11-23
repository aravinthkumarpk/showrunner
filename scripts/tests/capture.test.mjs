// Tests for capture.mjs. Needs Google Chrome and ffmpeg. Run: node --test 'scripts/tests/*.test.mjs'
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, copyFileSync, readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, runNode, pngSize, centrePixel, makePng } from './helpers.mjs';
import { parseArgs } from '../capture.mjs';
import { findChrome } from '../lib/chrome.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CAPTURE = join(here, '..', 'capture.mjs');
const chrome = findChrome();
const skip = chrome ? false : 'Google Chrome not found (set CHROME to its binary); capture tests did not run';
let site; let tmp; let srv;

before(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'cap-'));
  site = join(tmp, 'site');
  mkdirSync(site);
  copyFileSync(join(here, 'fixtures', 'page.html'), join(site, 'index.html'));
  await makePng(join(site, 'dot.png'), 'white', '8x8');
  srv = await serve(site);
});
after(() => { srv.server.close(); rmSync(tmp, { recursive: true, force: true }); });

const cap = (args) => runNode(CAPTURE, args);

test('parseArgs: needs a url and a mode', () => {
  assert.throws(() => parseArgs(['--stills', '0'], {}), /--url/);
  assert.throws(() => parseArgs(['--url', 'http://x/'], {}), /--stills or --frames/);
});

test('parseArgs: defaults are 1920 by 1080 at 30 fps, scale 1', () => {
  const o = parseArgs(['--url', 'http://x/', '--frames', '--out', 'f'], {});
  assert.deepEqual([o.width, o.height, o.fps, o.scale], [1920, 1080, 30, 1]);
});

test('parseArgs: env fills what flags leave out, flags win', () => {
  const o = parseArgs(['--frames', '--fps', '60'], { SITE_URL: 'http://e/', FPS: '24', WIDTH: '1280', OUT_DIR: 'o' });
  assert.equal(o.url, 'http://e/'); assert.equal(o.fps, 60); assert.equal(o.width, 1280); assert.equal(o.out, 'o');
});

test('parseArgs: rejects bad numbers', () => {
  assert.throws(() => parseArgs(['--url', 'http://x/', '--frames', '--out', 'f', '--fps', '0'], {}), /fps/);
  assert.throws(() => parseArgs(['--url', 'http://x/', '--stills', 'a,b', '--out', 'f'], {}), /stills/);
});

test('stills: one PNG per time, at the asked size, and the picture follows t', { skip }, async () => {
  const out = join(tmp, 'stills');
  const r = await cap(['--url', `${srv.base}/index.html`, '--stills', '0,0.5', '--width', '320', '--height', '180', '--out', out]);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(readdirSync(out).filter((f) => f.endsWith('.png')).sort(), ['t_00.00.png', 't_00.50.png']);
  assert.deepEqual(pngSize(join(out, 't_00.00.png')), { width: 320, height: 180 });
  const [r0, , b0] = await centrePixel(join(out, 't_00.00.png'));
  const [r1, , b1] = await centrePixel(join(out, 't_00.50.png'));
  assert.ok(b0 > 200 && r0 < 50, `t=0 should be blue, got ${r0},${b0}`);
  assert.ok(r1 > 200 && b1 < 50, `t=0.5 should be red, got ${r1},${b1}`);
});

test('scale 2 gives a true double-size frame', { skip }, async () => {
  const out = join(tmp, 'scale2');
  const r = await cap(['--url', `${srv.base}/index.html`, '--stills', '0.25', '--width', '320', '--height', '180', '--scale', '2', '--out', out]);
  assert.equal(r.code, 0, r.stderr);
  assert.deepEqual(pngSize(join(out, 't_00.25.png')), { width: 640, height: 360 });
});

test('frames: DURATION times fps frames, numbered from 0, plus a manifest', { skip }, async () => {
  const out = join(tmp, 'frames');
  const r = await cap(['--url', `${srv.base}/index.html`, '--frames', '--fps', '10', '--width', '160', '--height', '90', '--out', out]);
  assert.equal(r.code, 0, r.stderr);
  const pngs = readdirSync(out).filter((f) => f.endsWith('.png')).sort();
  assert.deepEqual(pngs, ['f_00000.png', 'f_00001.png', 'f_00002.png', 'f_00003.png', 'f_00004.png']);
  const m = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'));
  assert.equal(m.frames, 5); assert.equal(m.fps, 10); assert.equal(m.duration, 0.5);
});

test('frames: refuses a non-empty out dir unless --resume, and --resume skips done frames', { skip }, async () => {
  const out = join(tmp, 'resume');
  mkdirSync(out);
  writeFileSync(join(out, 'f_00000.png'), 'not a real frame');
  const r1 = await cap(['--url', `${srv.base}/index.html`, '--frames', '--fps', '10', '--width', '160', '--height', '90', '--out', out]);
  assert.notEqual(r1.code, 0); assert.match(r1.stderr, /--resume/);
  const r2 = await cap(['--url', `${srv.base}/index.html`, '--frames', '--fps', '10', '--width', '160', '--height', '90', '--out', out, '--resume']);
  assert.equal(r2.code, 0, r2.stderr);
  assert.equal(readFileSync(join(out, 'f_00000.png'), 'utf8'), 'not a real frame');
  assert.ok(existsSync(join(out, 'f_00004.png')));
});

test('fails loudly when the page has no window.ready', { skip }, async () => {
  const r = await cap(['--url', `${srv.base}/index.html?noready`, '--stills', '0', '--out', join(tmp, 'nr')]);
  assert.notEqual(r.code, 0); assert.match(r.stderr, /window\.ready/);
});

test('fails loudly and names the image when one did not load', { skip }, async () => {
  const r = await cap(['--url', `${srv.base}/index.html?badimg`, '--stills', '0', '--out', join(tmp, 'bi')]);
  assert.notEqual(r.code, 0); assert.match(r.stderr, /missing\.png/);
});

test('refuses file:// for a page with images, says to serve it, and --allow-file overrides', { skip }, async () => {
  const url = 'file://' + join(site, 'index.html');
  const r = await cap(['--url', url, '--stills', '0', '--out', join(tmp, 'f1')]);
  assert.notEqual(r.code, 0); assert.match(r.stderr, /http/);
  const r2 = await cap(['--url', url, '--stills', '0', '--out', join(tmp, 'f2'), '--allow-file']);
  assert.equal(r2.code, 0, r2.stderr);
});

test('file:// is fine for a page with no images, canvas or video', { skip }, async () => {
  const r = await cap(['--url', 'file://' + join(site, 'index.html') + '?noimg', '--stills', '0', '--out', join(tmp, 'f3')]);
  assert.equal(r.code, 0, r.stderr);
});
