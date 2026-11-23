# PRODUCTION.md and the prompt book

Step 4. Written after "lock the board" and before any build or spend. It is the one brief every agent reads first. The idea and the prompt book come from the making-of notes of the Slopcore films by anabology (CLODYSSEY and BLISS): a binding brief stopped parallel agents drifting, and hand-written prompts read before spend stopped the credit burn.

## Contents

1. PRODUCTION.md template
2. Agent prompt skeleton
3. Prompt book template (generated beats only)
4. The spend gate

## 1. PRODUCTION.md template

Copy into `<film>/PRODUCTION.md` and fill every section. Leave nothing as "TBD": a blank is a question for the director now, not a guess for an agent later.

```markdown
# <Film name>: production

Locked board: board/board-v<N>.png (locked <date>, the director's words: "<verbatim>")
Length: <s> s. Delivery: <1080p review, then 4K 60 fps after the director's yes; ProRes for the event>.

## The director's words (verbatim, never paraphrased)
- The brief: "<the director's words>"
- The five agreed lines and the sentence: (copy from ledger.md)
- Rulings on this film so far: (copy every verdict row from ledger.md)

## Rules every agent follows
1. Read this file in full before any work. Reread it before you report.
2. The board is the spec. A change to the story, a line or the order of beats is not yours to make: report it, do not do it.
3. Real product only: production components, design-system tokens, the real gradient and art from <paths>. No redraws.
4. Every frame is a pure function of t. No CSS transitions, timers or unseeded randomness.
5. Every product word and number on screen matches the board's words exactly.
6. One thing moving and one thing to read per frame.
7. Edit only the files you own (table below). Shared files are report-only.
8. No spend outside the budget table. Stop and report at the cap.
9. A null review ("no fixes") on a beat you did not render and look at counts as a failure.
<add the director's film-specific rulings as rules here, each with its date>

## Look
- Type: <the product's headline and body faces>  Colours: <tokens>  Accent owned by the product: <one>
- Banned: <techniques.md section 9 plus this film's>

## Grid and sound
- Track: <music/score.wav or synth.py>, <BPM>, grid music/grid.json (confidence <x>)
- Sound cues: one per landing; effects placed by measured peak; master -14 LUFS, -1 dBTP

## Budget
| Item | Cap | Spent | Who approved |
|---|---|---|---|
| Generation (fal, Higgsfield, ...) | USD <n> | 0 | |
| Re-renders at 4K | <n> | 0 | |
| Passes per generated beat | 3 | 0 | |

## Stages, owners and gates
| Stage | Owner | Gate | Status |
|---|---|---|---|
| Timeline scenes 1 to 3 | <agent or lead> | stills match board v<N> panels 1 to 3 | |
| Score | lead | grid confidence above 0.35; the director's ear | |
| Generated plates (if any) | lead writes prompts | the director reads the prompt book or a 3-clip pilot passes | |
| 1080p review cut | lead | check.py all PASS; critic pass | |
| 4K master | lead | the director's yes on the 1080p cut | |

## File ownership
| File | Owner | Others may |
|---|---|---|
| site/timeline.js scenes 1 to 3 (lines a to b) | agent A | read |
| site/index.html, styles | lead | report only |
| synth.py | lead | report only |

## Run log
| When | Who | What ran | Result | Cost |
|---|---|---|---|---|
```

## 2. Agent prompt skeleton

For any build agent (use a strong model, never the smallest). From the Slopcore chapter scripts:

```
READ FIRST, fully: <film>/PRODUCTION.md and board/board-v<N>.png.
The director's bar, verbatim: "<the line from PRODUCTION.md>"
HARD RULES: edit only <file and line range>; shared files are report-only; pure functions of t;
no Math.random without a seed; product words exactly as on the board.
BUILD: <the beat, its panel number, its time range, its sound cue>.
VERIFY (must pass before you report): capture stills at <times> with scripts/capture.mjs and
LOOK at every one; compare each against panel <n>; list every on-screen word and check it
against the board.
RETURN: files changed, stills paths, anything you could not match, anything you think is wrong
with the board (do not fix it).
```

## 3. Prompt book template (generated beats only)

`<film>/prompts/PROMPTS.md`. The lead writes every prompt by hand in one context that holds the whole story. Agents never write generation prompts: CLODYSSEY's agent-written first round burned about 830 credits on prompts nobody read, and the director's verdict was "these prompts are really really bad and wasting money".

Per beat:

```markdown
### Beat <panel n>: <name>  (<start> to <end> s on the grid)
Story need: <one sentence: why this beat exists; delete the beat if you cannot write it>
Model and route: <model, image-to-video or text-to-video, resolution>  Cost per take: USD <n>  Takes budgeted: <n>
Reference images: <paths>  Canon string: "<fixed description of any person or product, same words every prompt>"
Prompt:
  0.0 s: <place and blocking, what is in frame>
  <t1 to t2> s (<the hit on the grid>): <action> / <reaction>
  <t2 to t3> s: <action> / <reaction>
  Environment moving: <wind, light, background motion>
  Camera: <one named move with a trigger and a stop>
  Leave empty for code: <where type or UI will go>. Nothing else enters the frame.
Never in this prompt: text, logos, UI, two actions in one clause.
Pass test: <what must be true on screen for the take to be kept>
```

## 4. The spend gate

Nothing that costs money runs until one of these is true, and the ledger records which:
1. The director has read the prompt book and said yes, or
2. A pilot of the 3 hardest beats has run, the director has seen the takes, and said yes.

When quality is flagged mid-run, stop every job that can spend before you discuss the fix (CLODYSSEY lesson). After three failed passes on one beat, stop and ask whether the beat should exist (rule 31), and do not raise the pass cap yourself (rule 30).

A code-only film (USD 0) still writes PRODUCTION.md, with the budget table showing 0. The gate then is the director's yes on the locked board plus the 4K rule.
