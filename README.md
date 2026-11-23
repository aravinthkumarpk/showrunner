# Showrunner

A Claude Code skill that turns a story you need told (a launch, an explainer, a customer win) into a 20 to 60 second film, and stops you at every point where saying "no" is still cheap.

Most AI video goes wrong in the same way. The agent starts generating before anyone agreed what the film says, keeps regenerating shots that will not hold, and grades its own homework. Showrunner puts seven gates in front of that, and only a person can pass them:

| Step | What you get | Gate |
|---|---|---|
| 0. References | 2 or 3 films you call magic and 1 you call average, measured | You agree what the good ones share |
| 1. Grill | A ledger with five agreed lines and one sentence | One yes on the six lines |
| 2. Music and grid | A track picked by ear, and a measured beat grid | You agree the track |
| 3. Storyboard | A versioned board with the build cost on it, an animatic, a sound-off cold-viewer test | "lock the board" |
| 4. Production file | PRODUCTION.md, plus a hand-written prompt book if anything is generated | You approve the spend |
| 5. Build | The film, drawn in code by default (`seek(t)`, headless Chrome, ffmpeg) | A 1080p cut that passes the measured gates |
| 6. Critique | Gate report, a separate critic's scores, timecoded fixes | Your final lock. 4K only after it |

## Why these gates

The rules come from two real films by the author.

- **Film A** was the real product drawn in code, cut to a score written for it, agreed board by board, and locked. Spend: USD 0.
- **Film B** was generated before the story was agreed. It scored 11 of 12 on its own checks, was called "not coherent at all", and was abandoned after 19 cuts and about USD 78 of generation credit.

`references/learnings.md` has the 33 rules that came out of the gap between them.

## What is in the box

```
SKILL.md                 the flow, the gates and the rules
references/              grill, learnings, techniques, board format, production template, pipeline, critic, taste library, sources
scripts/                 capture.mjs, board.mjs, render.sh, check.py, beatgrid.py, contrast.mjs, poster.sh, envelope.py
scripts/tests/           tests for every script
scripts/doctor.sh        checks your machine and links the skill into Claude Code
examples/hello-film/     a 6 second starter film and run.sh that makes it end to end
```

The scripts use Node 22+ built-ins, the Python 3 standard library, ffmpeg, ffprobe and Google Chrome. Nothing to install from npm or pip.

| Script | What it does |
|---|---|
| `capture.mjs` | Stills or every frame of a `seek(t)` page in headless Chrome; refuses a page that is not ready |
| `board.mjs` | A storyboard sheet PNG from JSON; refuses a panel with a missing field; never overwrites a version |
| `render.sh` | Frames plus audio to MP4 (bt709, faststart, optional 8+ subframe blur); deletes frames only after a verified encode |
| `check.py` | Measured gates on a finished file: duration, size, fps, frames, loudness, true peak, black, frozen stretches, cuts on the grid |
| `beatgrid.py` | A beat grid from audio; says "low confidence" instead of guessing |
| `contrast.mjs` | WCAG contrast at given times on a `seek(t)` page |
| `poster.sh` | Bakes a poster into frame 0 without changing frame count or duration |
| `envelope.py` | A per-frame loudness envelope for subtle audio-reactive motion |

## Getting started

### What you need

| Need | Why | Get it |
|---|---|---|
| Claude Code | The skill is instructions Claude follows: it asks the questions, writes the film page, runs the scripts and stops at each gate for you | https://claude.com/claude-code |
| Node 22 or later | `capture.mjs`, `board.mjs`, `contrast.mjs` | https://nodejs.org |
| Python 3.10 or later | `check.py`, `beatgrid.py`, `envelope.py`, the starter score | macOS: `brew install python` |
| ffmpeg and ffprobe | Encoding, loudness, gates | macOS: `brew install ffmpeg`. Ubuntu: `sudo apt install ffmpeg` |
| Google Chrome | Draws every frame headless | Install Chrome, or set `CHROME` to any Chrome or chrome-headless-shell binary |

No API keys and no paid services. A film drawn in code costs USD 0. You only need an account with a video model (Runway, Veo, Kling and so on) if your story needs generated footage of real people or places, and the skill makes you agree a prompt book or a 3-clip pilot before any of that spend.

### Five minutes to your first film

```sh
git clone https://github.com/aravinthkumarpk/showrunner
cd showrunner
sh scripts/doctor.sh --install      # checks the tools above, links the skill into ~/.claude/skills/showrunner
sh examples/hello-film/run.sh       # makes a 6 second film end to end
```

`run.sh` writes a score in code, measures its beat grid, takes board stills, captures 180 frames, encodes the MP4, runs the measured gates (10 of 10 should pass) and bakes a poster into frame 0. Open `hello-film-out/hello-film-poster.mp4`. It takes about 25 seconds on a laptop.

The starter film is `examples/hello-film/site/index.html`: one HTML page with `window.DURATION`, a pure `window.seek(t)` and `window.ready`. Every film this skill builds follows the same contract (`references/pipeline.md` section 2), so reading that one file is the fastest way to see how it works.

### Your own film

Open Claude Code in the folder where you want the film to live and say what you need, for example:

> Make a 20 second launch film for our new export button. Here is the product: <link or repo>.

Claude runs the steps in `SKILL.md`: it asks for 2 or 3 films you like, grills you one question at a time, picks a track with you, shows a storyboard with its cost, and only builds after you say "lock the board". You can also ask for one step on its own: "storyboard this", "re-cut v3", "render the 4K master".

For a product film, give Claude access to the product's real UI code or design tokens. The rules expect the real components, and a redraw is the first thing a viewer notices.

### If something goes wrong

- `sh scripts/doctor.sh` says exactly what is missing and how to install it.
- Frame capture stops after a few frames on some Linux servers with full Chrome. Use chrome-headless-shell instead: `npx @puppeteer/browsers install chrome-headless-shell@stable`, then `export CHROME=<path it prints>`.
- Running as root (Docker, CI): Chrome's sandbox is turned off automatically.

### Run the tests

From this folder:

```sh
node --test 'scripts/tests/*.test.mjs'
python3 -m unittest discover -s scripts/tests -p 'test_*.py'
sh scripts/tests/test_render.sh
sh scripts/tests/test_poster.sh
```

The capture tests need Chrome (set `CHROME` if it is not on the usual path).

## What is not included

- The private case notes behind the two films (verbatim verdicts, dates, product details).
- Four companion skills the private version hands off to (story craft, shot craft, generated-video prompting, measuring a reference film). You do not need them: the grill, `references/techniques.md` and the scripts cover a code-built film end to end. Without them, step 0 measures reference films with ffmpeg and `beatgrid.py` only (no per-shot cut list), and generated footage gets less prompt guidance.
- Any music or sound files. `references/sources.md` points to free ones and their licences.

## Licence

MIT. See `LICENSE`.
