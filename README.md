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

## Install

Copy this folder to `~/.claude/skills/showrunner/`. Claude Code picks it up the next time it starts. Then ask for a film ("make a 20 second launch film for this feature") or one part of one ("storyboard this", "lock the board", "render it in 4K").

## Run the tests

From this folder:

```sh
node --test 'scripts/tests/*.test.mjs'
python3 -m unittest discover -s scripts/tests -p 'test_*.py'
sh scripts/tests/test_render.sh
sh scripts/tests/test_poster.sh
```

The capture tests need Google Chrome (set `CHROME` to its binary if it is not on the usual path).

## What is not included

- The private case notes behind the two films (verbatim verdicts, dates, product details).
- Four companion skills the private version hands off to (story craft, shot craft, generated-video prompting, measuring a reference film). Showrunner runs a code-built film end to end without them.
- Any music or sound files. `references/sources.md` points to free ones and their licences.

## Licence

MIT. See `LICENSE`.
