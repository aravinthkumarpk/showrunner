# The code-render pipeline

How the locked Film A was built, made general. Every frame is a pure function of time, captured by headless Chrome, encoded by ffmpeg. It cost USD 0 for v4 to v7 and never morphed a prop. Use it as the default build for every beat that is product UI, type, graphics, a mascot or a diagram.

The scripts in this skill generalise the ones Film A was built with.

## Contents

1. Folder layout
2. The page contract
3. Writing the timeline
4. Serving the page
5. Stills for boards and checks
6. The score
7. Frames and encode
8. 4K, 60 fps and motion blur
9. Measured gates
10. Gotchas already paid for
11. Cost and time table

## 1. Folder layout

One folder per film. Version folders keep the good parts of earlier cuts findable (rule 33).

```
<film>/
  ledger.md            grill answers and every verdict, verbatim
  PRODUCTION.md        written at step 4 (production-template.md)
  prompts/             prompt book, only if any beat is generated
  music/               candidates, the picked track or synth.py, grid.json
  board/               board-v1.json, board-v1.png, board-v2.json ...
  v1/ v2/ ...          one folder per build version
    site/              index.html, timeline.js, fonts/, art/ (real product assets)
    audio/score.wav
    frames/            temporary, deleted after a verified encode
    out/               review cuts; out/final/ only after the lock
```

## 2. The page contract

`scripts/capture.mjs` refuses a page that breaks any of these:

| Global | Meaning |
|---|---|
| `window.DURATION` | Length in seconds, above 0 |
| `window.seek(t)` | Sets every style from `t` alone. May return a promise (for example to await an image decode). |
| `window.ready` | A promise that resolves truthy once fonts, images and shaders are ready |

It also checks that every `<img>` loaded (it names the ones that did not), waits for `document.fonts.ready`, and before each frame pauses and seeks every CSS or Web Animation to `t`, so a stray transition cannot drift.

Film A's version of ready, worth copying:
```js
window.ready = document.fonts.ready.then(glassReady)
  .then(() => Promise.all([...document.images].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = r; im.onerror = r; })))))
  .then(() => { measure(); seek(0); return true; });
```
`glassReady` polls until the WebGL wave reports it is initialised, with an 8 s cap.

## 3. Writing the timeline

- **One file of scene times** at the top of `timeline.js` (Film A's `const T = { typeStart: 3.7, typeEnd: 5.9, send: 6.5, ... }`). Change a number, re-render. The board's panel times come from the same numbers.
- **Pure functions of t.** No CSS transitions, no `setTimeout`, no `Math.random()` without a seed, no state carried between frames. Seeking to 12.0 then 3.0 must give the same frame at 3.0 as playing from 0. Film A used a seeded LCG (`seed = (seed * 16807) % 2147483647`) for its crowd of mascots.
- **Small helpers do most of the work**: `p(t, a, b)` progress clamped to 0..1, ease-out cubic `eo`, ease-in-out `eio`, an overshoot `back`, `lerp`, and `vis(el, t, tin, tout)` to fade and rise an element in and out.
- **Measure, do not guess, positions** for glides and match cuts (Film A's `FLY` was measured from the page).
- **Time remap at the end, not inside.** Film A sped up its opening without touching scene code: `window.seek = (ft) => seekSource(ft < 2.0 ? ft * 1.5 : ft + 1.0)`, with `DURATION` cut by 1 s.
- **Lay out in logical 1920x1080 pixels.** 4K comes from device scale 2, so hairlines and type stay right. (mexicat ENGINE.md.)
- **Real assets only**: the product's fonts (`fonts/`), art (`art/` webp), design-system tokens as CSS variables (`--border-muted`, `--text-muted`), the real gradient code (the gradient code).

## 4. Serving the page

Serve over http, always:
```sh
python3 -m http.server 8471 --bind 127.0.0.1 --directory <film>/v3/site
```
Why: from `file://`, the WebGL wave could not read its gradient images (cross-origin taint), so the shader never started and the frames silently lacked the glass. `capture.mjs` now refuses `file://` for any page with images, canvas or video unless you pass `--allow-file`.

## 5. Stills for boards and checks

```sh
S=scripts
node $S/capture.mjs --url http://127.0.0.1:8471/index.html --stills 0.7,1.45,4.3,9.3,11.75,12.95,14.4,15.8,19.9 --out <film>/board/v3
```
Writes `t_00.70.png` and so on. Use the same call for the critic's frames and for checking every product word on screen. A still costs about a second; take many.

Then compose the board: `node $S/board.mjs <film>/board/board-v3.json` (format in `board-format.md`).

**Mid-transition stills, before any full render** (brag, `skills/brag/SKILL.md`). Look at a still from every scene's settled time and from the start, middle and end of every transition. For a seam from 4.0 to 4.6 s:
```sh
node $S/capture.mjs --url http://127.0.0.1:8471/index.html --stills 3.5,4.0,4.15,4.3,4.45,4.6,5.2 --out <film>/v3/checks/seams
```
Fix overflow, collisions and low contrast there. A plain crossfade between two busy layouts makes a muddy double image at its midpoint: stagger it (old content out, then new content in) or dip through the background. Why: a seam is invisible in settled stills and costs a full render to find in the cut.

**Contrast at the same times.** Run the WCAG gate at every board still time and every scene's settled time:
```sh
node $S/contrast.mjs --url http://127.0.0.1:8471/index.html --times 0.7,1.45,4.3,9.3,11.75,12.95,14.4,15.8,19.9
```
It prints PASS, FAIL or UNVERIFIED per time and one line per text element (ratio, size, colours, and whether the background came from the DOM or from screenshot pixels). The bar is 4.5:1 for normal text and 3:1 for large text. UNVERIFIED (exit 2) means zero text was checked at a time, or an element could not be measured, and it is not a pass. Mark texture text with `data-texture` to exempt it. On the Film A page it took about 4 s for 5 times and flagged a grey chat placeholder (`#96a0a6` on white, 2.66:1).

## 6. The score

Two routes, both proven:
- **Synthesised in code** (Film A's `synth.py`: Python stdlib, 44.1 kHz 16-bit stereo, C major at 120 BPM, drums, bass, pad, a plucked arpeggio, effects in the same key through the same reverb). It won over two stock tracks (rule 21). Its scene times must match the timeline; better, read them from one JSON both files share.
- **A licensed track as a feel reference only.** Play it to agree the feel, then write or commission the score. Never put the licensed track in the film.

For a subtle audio-reactive treatment, write the per-frame envelope once the score is fixed, at the capture fps, and load it in the page (`techniques.md` section 8):
```sh
python3 -I $S/envelope.py <film>/music/score.wav --fps 30 --out <film>/v3/site/envelope-30.json
```

Measure the grid before the board:
```sh
python3 -I $S/beatgrid.py <film>/music/score.wav --out <film>/music/grid.json
```
Exit 3 means low confidence: no grid is written into `beats`, and the message says so. Mark cut points by ear instead, or pass `--accept-low` to keep a labelled guess. Check the downbeat by ear: the script assumes 4/4 from the first detected beat. On the Film A score it measured 120.05 BPM, first beat at 0.0 s, confidence 0.76.

## 7. Frames and encode

```sh
# frames: DURATION x fps PNGs, f_00000.png ...; a manifest.json records size, fps and status
node $S/capture.mjs --url http://127.0.0.1:8471/index.html --frames --fps 30 --out <film>/v3/frames
# after a dropped run: same command plus --resume captures only the missing frames
sh $S/render.sh --frames <film>/v3/frames --fps 30 --audio <film>/v3/audio/score.wav --out <film>/v3/out/cut-v3-1080p.mp4
```
`render.sh` checks the sequence has no gaps, encodes H.264 (CRF 14, preset slow, aq-mode 3, Lanczos scale to bt709 with full chroma, bt709 primaries, transfer and matrix tags), AAC 320k, `+faststart`, trims the audio to the picture, verifies the output frame count, and only then deletes the frames. `--keep-frames` keeps them.

**Poster as frame 0** (brag, `references/step-4-deliver.md`). Slack, X and Discord make their own thumbnails, and almost all of them grab frame 0, so make frame 0 the poster. Pick the strongest settled frame (text fully in, not mid-transition), then:
```sh
sh $S/poster.sh --in <film>/v3/out/cut-v3-1080p.mp4 --at 14.4 --poster <film>/v3/out/poster.png --out <film>/v3/out/cut-v3-1080p-poster.mp4
```
It replaces only frame 0's pixels (libx264 at CRF 14, bt709, faststart, audio copied), then checks that the frame count, duration and audio are unchanged and prints PASS; on any difference it deletes its output and fails. It refuses a poster that is not the film's size and never overwrites a file without `--force`. Keep `poster.png` beside the film: it is the upload thumbnail for Instagram, YouTube and LinkedIn and the `poster=` image for any web embed.

Event masters: ProRes 422 HQ from the same frames, as Film A did:
```sh
ffmpeg -framerate 30 -i frames/f_%05d.png -i score.wav -c:v prores_ks -profile:v 3 -pix_fmt yuv422p10le -c:a pcm_s16le out.mov
```
Run it before `render.sh` deletes the frames, or pass `--keep-frames`.

## 8. 4K, 60 fps and motion blur

Only after the director's yes on the 1080p cut (rule 29).
```sh
# clean 4K 60 fps, no blur (the Film A master): about 20 min for 20 s on the author's laptop
node $S/capture.mjs --url http://127.0.0.1:8471/index.html --frames --fps 60 --scale 2 --out <film>/v7/frames4k
sh $S/render.sh --frames <film>/v7/frames4k --fps 60 --audio score.wav --out out/final/film-4k-60fps.mp4

# true motion blur: 8 subframes per output frame, capture at 480 fps; about 2.5 to 3 h for 20 s
node $S/capture.mjs --url ... --frames --fps 480 --scale 2 --out frames4k-blur
sh $S/render.sh --frames frames4k-blur --fps 60 --blur 8 --audio score.wav --out out/final/film-4k-60fps-blur.mp4
```
`render.sh --blur N` averages each N captured frames (`tmix`) into one output frame. It refuses N from 2 to 7: the Film A 2-sample blur showed two separate copies of the title on the fast glide (16 Oct). Use 8 or more, or none. The clean render was locked; the director never asked for the blur again.

## 9. Measured gates

```sh
python3 -I $S/check.py out/cut-v3-1080p.mp4 --duration 20 --size 1920x1080 --fps 30 --grid music/grid.json --black-ok 16.9-17.2
```
Gates: duration, resolution, fps, frame count, audio present and aligned, loudness (-14 LUFS plus or minus 1), true peak (-1 dBTP or lower), unplanned black, frozen stretches of 3 s or more, and hard cuts on the beat grid. Exit 1 on any FAIL; skipped is not passed. Contrast runs on the page, not the file: `contrast.mjs` (section 5). Gates that need eyes (every product word and number correct, read time, seams, the poster) are in `critic.md`.

Calibration on the locked Film A 4K master: 8 of 10 pass. Loudness measured -15.6 LUFS (1.6 below target; the director locked it, so treat loudness as a note to fix next time, not a reason to reopen a lock). Black at 16.98 to 17.13 s is the deliberate dip to the end card: pass it with `--black-ok`.

## 10. Gotchas already paid for

| Gotcha | What happened | Rule now |
|---|---|---|
| Shader images from `file://` | The glass wave never started; frames lacked it | Serve over http; capture refuses `file://` for media pages |
| 2-sample motion blur | Two copies of the title on the fast glide | 8+ subframes or none; render.sh refuses 2 to 7 |
| 4K before approval | Three 4K renders made obsolete within minutes (13 and 16 Oct) | 1080p for review; 4K after the director's yes |
| Broken file delivered | A music swap render that would not play | Run `check.py` on every file before you send it |
| Board regression | A panel edit brought back a rejected opening | Every board change re-renders all stills from the current timeline; diff against the last board before showing |
| Hand-drawn product UI | A redrawn status tab looked poorer than the product | Copy production components and tokens |
| Home-made gradient | A hand-made gradient was not the product's and looked low quality | Use the product's real gradient code |
| Stale 4K files beside the master | Two moved to `out/alternates/` by hand | `out/final/` only after lock; everything else in `out/` or `out/alternates/` with a reason in the name |
| Frames left on disk | 189 MB for 600 1080p frames; 4K is about 0.85 MB a frame | render.sh deletes frames after a verified encode |
| Crossfade between busy layouts | A muddy double image mid-seam (brag) | Look at mid-transition stills before any full render; stagger or dip |
| Arbitrary thumbnail | Platforms grab frame 0, often a fade or blank intro (brag) | `poster.sh` bakes the strongest settled frame into frame 0 |
| Licensed track temptation | "popular free music that has no attribution" brief | Feel reference only; the score is written for the cut |

## 11. Cost and time table

Measured on the author's laptop (M-series, Chrome headless), Film A, 20 s film:

| Job | Frames | Time | Disk while frames exist |
|---|---|---|---|
| One still | 1 | about 1 s | under 1 MB |
| 1080p 30 fps | 600 | about 5 min (estimated from the 4K rate, not timed) | about 190 MB |
| 4K 60 fps, no blur | 1,200 | about 20 min | about 1 GB |
| 4K 60 fps, 8-subframe blur | 9,600 | about 2.5 to 3 h | about 8 GB |
| Synth score | | under a minute | |

Money for a code-rendered film: USD 0. Put this on every board so the director sees what a "yes" costs.
