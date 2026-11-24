# Critique: measured gates, then a separate critic

Step 6. Measured gates run first, because a film with a wrong number on screen or a broken file is not worth a taste review. Then a critic in a separate context scores the cut on 7 dimensions and returns timecoded fixes. Then the director watches. The critic supports the director's eye and never replaces it (rule 28).

The rubric adapts mg-styles-15 `rubric.md` (independent jury, anchored scores, timecoded fixes with numbers, at least one fix that raises the wow factor).

## Contents

1. Measured gates
2. The critic
3. Routing fixes back to their step
4. What the director sees

## 1. Measured gates

Run all of them on every cut before anyone looks at it. Any FAIL is fixed first.

| Gate | How | Pass |
|---|---|---|
| Assets loaded | `capture.mjs` refuses to capture if any image failed, fonts are not ready, or the page contract is broken | Capture ran |
| File specs | `check.py --duration --size --fps` | duration, resolution, fps, frame count PASS |
| Sound | `check.py` | audio present and aligned; -14 LUFS plus or minus 1; true peak -1 dBTP or lower |
| Dead picture | `check.py` | no unplanned black (`--black-ok` for planned dips); no fully frozen 3 s |
| Sync to grid | `check.py --grid music/grid.json` | every hard cut within 0.04 s of a beat or half-beat. UI moves are checked by eye on the strips below. |
| Every product word and number | Capture a still at every panel time (and every 0.5 s through text-heavy beats). Read each still. Compare every word and number with the board JSON `words` and with the real product. | 100 percent match, N of N. List any mismatch with its timecode. |
| Claims, both ways | For each capability or outcome on screen, name where the current product does it (doc, code, a real run). Also list real capabilities the board left out by mistake. | No over-claim; no under-claim from a stale doc (rule 25) |
| Read time | For each text on screen, time it from when the whole line is settled to when it starts to leave. Compare with the reading floor in `techniques.md` section 7 (a label at least 0.8 s, a sentence about 0.3 s per word) and the read holds in section 4. Texture text is exempt. | Every line holds long enough. Fast in, then hold; never fast in, then gone. (brag) |
| Reading time, per message | For a film with chat messages or other text in sequence, measure in the page every 0.05 s how long each message is fully readable: opaque, unblurred, inside the frame, and not covered by a menu or scrim. Count words without time stamps, and with reply buttons. Write the table described in `board-format.md`. | Every message holds 0.3 s a word plus 1 s; every giant line has at most 5 words a line. A message that fails goes back to the board, not into the cut (rules 42, 44). |
| Legibility, per element | Measure each text element's rendered size and cap height at the middle of its hold, in every format the film ships in | Hero numbers at least 64 px; other words in an image at least 28 px; chat cap height at least 30 px at 1080p; in 9:16, a chat font of at least 40 px and labels of at least 30 px (rule 43) |
| Clocks agree | Sample the stage clock and every clock in frame through the whole film | 0 mismatches. A clock may differ only mid-roll during a time-lapse. No clock rests earlier than the message time under it (rule 39). |
| Small screen | If the film will be sent inside a messaging app, view it at about 400 px wide | The words still read. If they do not, make a relaid 9:16 cut and run every gate on it too (rule 45). |
| Copy review | A second model reads every on-screen word against the house writing rules and, for a mocked app, the real app's message types | Button replies echo their buttons, no figure overstates, money figures carry a time period, no message holds more words than its time allows (rule 47) |
| Contrast (WCAG) | `node scripts/contrast.mjs --url <page> --times <every board still time>,<every scene's settled time>` on the served page | PASS at every time: 4.5:1 for normal text, 3:1 for large (24 px, or 18.66 px bold). Exit 2 (UNVERIFIED: zero text checked at a time, or an element it could not measure) is not a pass; find what was skipped. (brag) |
| Seams | Stills from every scene's settled time and from the start, middle and end of every transition (`capture.mjs --stills`, see `pipeline.md` section 5). Look at each one. | No muddy double image, no overflow, no collision, no unreadable text mid-seam. Fix with a stagger or a dip through the background. (brag) |
| Poster | After `scripts/poster.sh`: `ffmpeg -i cut.mp4 -frames:v 1 f0.png`, then look at it | Frame 0 is the chosen poster, a settled frame with its text fully in; poster.sh printed PASS (frame count and duration unchanged). (brag) |

**Motion pace**, when a cut feels slow: measure the per-frame difference (ffmpeg `tblend=all_mode=difference`, then `signalstats` YAVG on a 480 px proxy), flag frames whose change is above 1.0 and more than 4x the median of the 6 frames on each side, and open every flagged window at full size. Report the average transition length and the longest still stretch outside reading holds, before and after. On Film D the average went from 0.393 to 0.326 s (rule 46).

Words, claims, read time, seams and the poster are gates with eyes, not scripts. Do them by looking at the stills, every time. "Skipped" is not "passed".

## 2. The critic

Spawn a fresh agent (your strongest judgment model) with only: the cut, the locked board PNG, the five agreed lines, `learnings.md`, and this rubric. Not the build history, not your opinion of the cut.

**What it looks at, at three zoom levels** (ClaudeAnimationBase, lemo, mg-styles):
```sh
# contact sheet, one frame every 0.5 s
ffmpeg -i cut.mp4 -vf "fps=2,scale=480:-1,tile=8x5" -frames:v 1 sheet.png
# a strip of every frame around the fastest move (here 12.4 to 13.0 s)
ffmpeg -ss 12.4 -t 0.6 -i cut.mp4 -vf "scale=320:-1,tile=9x2" -frames:v 1 strip.png
# full-size frames at 5 to 8 key times: use capture.mjs --stills on the page, or
ffmpeg -ss 12.95 -i cut.mp4 -frames:v 1 key_12.95.png
```
It watches the whole cut end to end first, as a viewer, with sound, before any frame review (rule 2).

**Scores, 1 to 10, on 7 dimensions.** Anchors: 5 is competent student work; 6 is decent template level; 7 is solid professional; 8 is high-end agency work; 9 and 10 are rare. Most first renders deserve 5 to 7. Do not inflate.

| Dimension | The question | The director's rules it carries |
|---|---|---|
| story | With no context, does a viewer get the five agreed lines? Does every beat have a need? Is the payoff on screen? Does it open on the viewer's own problem, and does the picture show the product taking it away? | 2, 3, 4, 8, 34, 35, 37 |
| wow | Is there one moment a stranger would replay or send on? | 12, 14 |
| motion | Does every move have a cause, a start and a stop? One thing moving per frame? Is the first 3 s moving? Any dead air between beats? | 16, 24, 36, 46 |
| design | Real product, real brand, one look, one accent. Type on the brand system. | 15, 16 |
| finish | Alignment, highlights, buttons, edges, every frame at the product's own finish. Every word legible at the size it is watched, and every clock in agreement. | 17, 39, 40, 41, 43 |
| sound | Does the score hit the picture? A pause where it matters? Effects on their landings? | 13, 20 to 23 |
| truth | Does what is shown match what the product does, both ways? | 25, 26 |

**Fixes.** 5 to 10, most important first. Each one: timecode, what is wrong, why it matters (name the rule), the fix with numbers ("move the chip landing from 11.80 to 11.73 s, one frame before beat 23"; not "make it snappier"), the step it routes to, and its cost. At least one fix must raise the wow score.

**Output, so it can be checked:**
```json
{ "scores": { "story": 7, "wow": 6, "motion": 7, "design": 8, "finish": 6, "sound": 7, "truth": 9 },
  "pass": false,
  "fixes": [ { "t": "12.95", "problem": "...", "why": "rule 16: ...", "fix": "...", "step": 5, "cost": "USD 0, 1080p re-render about 5 min" } ] }
```
`pass` is true only if no dimension is below 7 and no measured gate failed. A critic that returns no fixes on a cut it did not watch end to end has failed, not passed.

## 3. Routing fixes back to their step

A fix goes back to the cheapest step that owns it. Show the director the cost before any re-render.

| The fix is about | Goes back to | Cost to show |
|---|---|---|
| What the film says, the order of beats, a line, the ending | Step 1 (ledger) and step 3: a new board version | Board round: minutes, USD 0 |
| The track, tempo, where the stop is | Step 2, then re-time the board | Board plus re-render |
| A generated beat's content | Step 4 prompt book, then pilot | USD per take times takes |
| A message or line that cannot be read in its hold, or text below the pixel floors | Step 3: a new board version with fewer words, a longer hold or a camera push. Never shorten the hold to keep the length (rule 44). | Board round, then re-render |
| Timing, easing, finish, a wrong word inside a locked beat | Step 5 build | Re-render time at 1080p |
| Loudness, encode, black, frames | Step 5 render | Minutes |

After the final lock, a change is a new board version, never a patch on the master.

## 4. What the director sees

1. The 1080p cut, with the `check.py` and `contrast.mjs` output pasted under it (all PASS, or each FAIL and UNVERIFIED explained), and the poster still.
2. The critic's scores and its top three fixes, in plain words, with your recommendation on which to do.
3. The cost of doing them.

Then the director's verdict goes in the ledger, verbatim. 4K only after the director's yes. The final lock is the director's words, recorded with the version.
