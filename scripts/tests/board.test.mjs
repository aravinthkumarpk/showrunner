// Tests for board.mjs. Needs Google Chrome and ffmpeg. Run: node --test 'scripts/tests/*.test.mjs'
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNode, pngSize, makePng } from './helpers.mjs';
import { validateBoard } from '../board.mjs';
import { findChrome } from '../lib/chrome.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const BOARD = join(here, '..', 'board.mjs');
const skip = findChrome() ? false : 'Google Chrome not found (set CHROME to its binary); board render tests did not run';
let tmp;

const panel = (i) => ({
  time: `${i * 3} to ${i * 3 + 3} s`, image: `p${i}.png`, frame: `Frame ${i}: the product window, one card moving`,
  words: `Line ${i}`, tool: 'code (seek(t))', sound: `kick on beat ${i}`, cost_usd: i === 2 ? 0.4 : 0,
});
const board = (n, extra = {}) => ({ film: 'Test film', version: 1, track: 'synth score, 120 BPM', duration_s: 20, line: 'Anyone can build an agent.', panels: Array.from({ length: n }, (_, i) => panel(i + 1)), ...extra });
const write = (name, obj) => { const f = join(tmp, name); writeFileSync(f, JSON.stringify(obj)); return f; };

before(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'board-'));
  const colours = ['red', 'green', 'blue', 'orange', 'purple', 'gray', 'yellow', 'navy', 'teal', 'pink'];
  for (let i = 1; i <= 10; i += 1) await makePng(join(tmp, `p${i}.png`), colours[i - 1], '320x180');
});
after(() => rmSync(tmp, { recursive: true, force: true }));

test('validate: 6 to 9 panels only', () => {
  assert.throws(() => validateBoard(board(5), tmp), /6 to 9/);
  assert.throws(() => validateBoard(board(10), tmp), /6 to 9/);
  assert.doesNotThrow(() => validateBoard(board(6), tmp));
  assert.doesNotThrow(() => validateBoard(board(9), tmp));
});

test('validate: every panel names frame, time, words, tool, sound and cost', () => {
  const b = board(6); delete b.panels[2].sound;
  assert.throws(() => validateBoard(b, tmp), /panel 3.*sound/);
  const c = board(6); delete c.panels[0].cost_usd;
  assert.throws(() => validateBoard(c, tmp), /panel 1.*cost_usd/);
});

test('validate: words may be empty on purpose but must be stated', () => {
  const b = board(6); b.panels[1].words = '';
  assert.doesNotThrow(() => validateBoard(b, tmp));
});

test('validate: v2 and later need a one-line change log', () => {
  assert.throws(() => validateBoard(board(6, { version: 2 }), tmp), /changelog/);
  assert.throws(() => validateBoard(board(6, { version: 2, changelog: 'one\ntwo' }), tmp), /one line/);
  assert.doesNotThrow(() => validateBoard(board(6, { version: 2, changelog: 'Opening cut to 1 s.' }), tmp));
});

test('validate: a missing image is named', () => {
  const b = board(6); b.panels[4].image = 'nope.png';
  assert.throws(() => validateBoard(b, tmp), /nope\.png/);
});

test('validate: options need two or more images with labels', () => {
  const b = board(6); b.panels[2].options = [{ label: 'A', image: 'p7.png' }];
  assert.throws(() => validateBoard(b, tmp), /options/);
});

test('render: writes board-v1.png at 2400 px wide and keeps the HTML beside it', { skip }, async () => {
  const b = board(7); b.panels[3].options = [{ label: 'A: hard cut', image: 'p8.png' }, { label: 'B: glide', image: 'p9.png' }];
  const f = write('board.json', b);
  const r = await runNode(BOARD, [f]);
  assert.equal(r.code, 0, r.stderr);
  assert.ok(existsSync(join(tmp, 'board-v1.png')));
  assert.equal(pngSize(join(tmp, 'board-v1.png')).width, 2400);
  assert.ok(existsSync(join(tmp, 'board-v1.html')));
  assert.match(r.stdout, /USD 0\.40/);
});

test('render: never overwrites an existing version', { skip }, async () => {
  const f = write('board-again.json', board(6));
  const r = await runNode(BOARD, [f]);
  assert.notEqual(r.code, 0);
  assert.match(r.stderr, /already exists/);
});

test('render: bad JSON fails loudly', async () => {
  const f = join(tmp, 'bad.json'); writeFileSync(f, '{nope');
  const r = await runNode(BOARD, [f]);
  assert.notEqual(r.code, 0); assert.match(r.stderr, /JSON/);
});
