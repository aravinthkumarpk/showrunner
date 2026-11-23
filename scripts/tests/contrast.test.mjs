// Tests for contrast.mjs, the WCAG contrast gate. Needs Google Chrome and ffmpeg.
// Run: node --test 'scripts/tests/*.test.mjs'
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, runNode, makePng } from './helpers.mjs';
import { parseArgs, ratio, luminance, isLarge, low } from '../contrast.mjs';
import { findChrome } from '../lib/chrome.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const CONTRAST = join(here, '..', 'contrast.mjs');
const chrome = findChrome();
const skip = chrome ? false : 'Google Chrome not found (set CHROME to its binary); contrast tests did not run';
let tmp; let srv;

before(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'con-'));
  const site = join(tmp, 'site');
  mkdirSync(site);
  copyFileSync(join(here, 'fixtures', 'contrast.html'), join(site, 'index.html'));
  await makePng(join(site, 'dark.png'), 'black', '300x60');
  srv = await serve(site);
});
after(() => { srv.server.close(); rmSync(tmp, { recursive: true, force: true }); });

const con = (query, args) => runNode(CONTRAST, ['--url', `${srv.base}/index.html${query}`, '--width', '800', '--height', '200', ...args]);
const line = (out, text) => out.split('\n').find((l) => l.includes(text)) || '';

test('ratio: black on white is 21, a colour on itself is 1, order does not matter', () => {
  assert.equal(ratio([0, 0, 0], [255, 255, 255]).toFixed(2), '21.00');
  assert.equal(ratio([136, 136, 136], [136, 136, 136]), 1);
  assert.equal(ratio([255, 255, 255], [0, 0, 0]), ratio([0, 0, 0], [255, 255, 255]));
});

test('ratio: #888 on white is about 3.54, under 4.5 and over 3', () => {
  const r = ratio([136, 136, 136], [255, 255, 255]);
  assert.ok(r > 3.5 && r < 3.6, `got ${r}`);
});

test('luminance uses the sRGB transfer curve', () => {
  assert.equal(luminance([255, 255, 255]), 1);
  assert.equal(luminance([0, 0, 0]), 0);
  assert.ok(Math.abs(luminance([128, 128, 128]) - 0.2158) < 0.001);
});

test('isLarge: 24 px, or 18.66 px when bold', () => {
  assert.equal(isLarge(24, 400), true);
  assert.equal(isLarge(23.9, 400), false);
  assert.equal(isLarge(18.66, 700), true);
  assert.equal(isLarge(18.66, 600), false);
  assert.equal(isLarge(18, 700), false);
});

test('low: the value 90 percent of the samples meet', () => {
  assert.equal(low([5, 1, 9, 7, 3, 2, 8, 4, 6, 10]), 2);
  assert.equal(low([4]), 4);
});

test('parseArgs: needs a url and times, rejects bad times', () => {
  assert.throws(() => parseArgs(['--times', '1'], {}), /--url/);
  assert.throws(() => parseArgs(['--url', 'http://x/'], {}), /--times/);
  assert.throws(() => parseArgs(['--url', 'http://x/', '--times', 'a'], {}), /times/);
  const o = parseArgs(['--url', 'http://x/', '--times', '0.5,1'], {});
  assert.deepEqual(o.times, [0.5, 1]);
  assert.deepEqual([o.width, o.height, o.scale, o.normal, o.large], [1920, 1080, 1, 4.5, 3]);
});

test('a page with one failing line exits 1, names it, and passes the rest', { skip }, async () => {
  const json = join(tmp, 'report.json');
  const r = await con('', ['--times', '1', '--json', json]);
  assert.equal(r.code, 1, r.stdout + r.stderr);
  assert.match(line(r.stdout, '1.00 s'), /^FAIL/);
  assert.match(line(r.stdout, 'Faint line'), /FAIL .*3\.5\d:1/);
  assert.match(line(r.stdout, 'Late faint line'), /FAIL/);
  const rep = JSON.parse(readFileSync(json, 'utf8'));
  const rows = rep.times[0].rows;
  const by = (text) => rows.find((x) => x.text === text);
  assert.equal(by('Readable line').pass, true);
  assert.equal(by('Faint line').pass, false);
  assert.equal(by('Large faint').pass, true, 'the same grey passes at 32 px, as large text');
  assert.equal(by('Large faint').large, true);
  assert.equal(by('On the gradient').source, 'pixels');
  assert.equal(by('On the gradient').pass, true);
  assert.equal(by('Over the photo').source, 'pixels');
  assert.ok(by('Over the photo').ratio > 15, `white over a black image, got ${by('Over the photo').ratio}`);
  assert.equal(by('Readable line').source, 'dom');
  assert.equal(by('texture texture texture'), undefined, 'texture text is exempt');
  assert.equal(rep.times[0].exempt, 1);
});

test('only passing text exits 0 with PASS', { skip }, async () => {
  const r = await con('?onlygood', ['--times', '1']);
  assert.equal(r.code, 0, r.stdout + r.stderr);
  assert.match(line(r.stdout, '1.00 s'), /^PASS/);
});

test('text hidden at a time is not checked then; each time gets its own verdict', { skip }, async () => {
  const r = await con('?nofaint', ['--times', '0.2,1']);
  assert.equal(r.code, 1, r.stdout + r.stderr);
  assert.match(line(r.stdout, '0.20 s'), /^PASS/);
  assert.match(line(r.stdout, '1.00 s'), /^FAIL/);
});

test('zero text checked is UNVERIFIED, not a pass, and exits 2', { skip }, async () => {
  const r = await con('?notext', ['--times', '1']);
  assert.equal(r.code, 2, r.stdout + r.stderr);
  assert.match(line(r.stdout, '1.00 s'), /^UNVERIFIED/);
});

test('a time past window.DURATION fails loudly', { skip }, async () => {
  const r = await con('', ['--times', '5']);
  assert.equal(r.code, 1);
  assert.match(r.stderr, /DURATION/);
});
