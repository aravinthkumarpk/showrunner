// Shared helpers for the Node tests: a static file server, a script runner, PNG and pixel readers.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execFile } from 'node:child_process';

const TYPES = { '.html': 'text/html', '.png': 'image/png', '.js': 'text/javascript', '.json': 'application/json' };

export function serve(dir) {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const path = join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      if (!path.startsWith(dir) || !existsSync(path)) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
      res.end(readFileSync(path));
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

// Async on purpose: a sync spawn would block the in-process server and hang the page load.
export function runNode(script, args, env = {}) {
  return new Promise((resolve) => {
    execFile(process.execPath, [script, ...args], { env: { ...process.env, ...env }, timeout: 120000 }, (err, stdout, stderr) => {
      resolve({ code: err ? (typeof err.code === 'number' ? err.code : 1) : 0, stdout, stderr });
    });
  });
}

export function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { encoding: 'buffer', maxBuffer: 1 << 26 }, (err, stdout, stderr) => (err ? reject(new Error(stderr.toString())) : resolve(stdout)));
  });
}

export function pngSize(file) {
  const b = readFileSync(file);
  if (b.toString('ascii', 1, 4) !== 'PNG') throw new Error(`${file} is not a PNG`);
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

// Average colour of a 10 by 10 patch at the centre, via ffmpeg.
export async function centrePixel(file) {
  const raw = await run('ffmpeg', ['-v', 'error', '-i', file, '-vf', 'crop=10:10:(iw-10)/2:(ih-10)/2,scale=1:1', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']);
  return [...raw.subarray(0, 3)];
}

export async function makePng(file, colour = 'red', size = '64x36') {
  await run('ffmpeg', ['-v', 'error', '-y', '-f', 'lavfi', '-i', `color=c=${colour}:size=${size}`, '-frames:v', '1', file]);
}
