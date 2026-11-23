---
name: showrunner
description: Turns a story someone needs told (a launch, an explainer, a customer win) into a short film of 20 to 60 seconds, from the first question to a locked master. Each step ends at a gate the director signs off: taste references, a grill kept in a ledger, a track and a measured beat grid, a versioned storyboard with its build cost, an animatic and a sound-off cold-viewer test, a production file and prompt book before any spend, the real product drawn in code (seek(t), headless Chrome, ffmpeg), measured gates, a separate critic, and 4K only after a yes. Use it for a launch film, promo, teaser, product demo, explainer or brand film; when someone says make a film, storyboard this, show me the board, lock the board, render it, or why does this cut feel average; or when they share films they like. Use it for one part too (a board, a re-cut, a 4K render).
---

# Showrunner

A short film is a story first. The tools (product UI drawn in code, motion graphics, a mascot, kinetic type, generated footage) are only the means. This skill runs a film from the first ask to the locked master, and stops at each place where a "no" is still cheap.

"The director" below is the person the film is for: the one who asked, and the only one who can pass a gate.

Two real films set the method.

- **Film A** was the real product drawn in code, cut to a score written for it, agreed board by board, and locked at USD 0 of spend.
- **Film B** was generated before the story was agreed. It kept regenerating shots that would not hold, scored 11 of 12 on its own gates, and was abandoned after about USD 78 and 19 cuts, with the verdict that it was "not coherent at all".

Almost every step below exists because of the gap between those two.

## Validation gate: read this before you plan

Before you trust any film plan, explain from `references/learnings.md` section 9 why Film A was locked and why Film B was not coherent. If you cannot say it in a few lines, read that section first. The short version:

- **Film A won** because the real product was the protagonist and its real flow (problem, spec, examples, trial run, reveal) was the spine. The product's range sat inside that one story. Every part was the production part. Each frame had one thing to read. The score was written for the cut, on a structure that already worked. Every change was agreed on a board before a render.
- **Film B failed** because it built before the story was agreed. Its symbols needed explaining, and the payoff frame was missing. One line contradicted the premise, and the film showed the wrong job for the product. Generated people and props morphed. Score and voice-over were layered on afterwards. It optimised its own gates and never watched itself as a viewer.

## How to talk to the director

- **Plain prose and one recommendation.** No question menus. When two answers are close, recommend one and mention the other in a clause.
- **Grill one question at a time**, each with your recommended answer and the evidence for it. Write the answer in the ledger before the next question.
- **Show, do not describe.** A board image, a still, an animatic, a cut. Directors judge pictures, fast. A sound described in words is not a sound that syncs.
- **Quote the director back exactly.** Their words go into the ledger verbatim, typos kept, because the next film learns from them.
- **A craft rule is a recommendation the director can overrule.** On Film A the director waved off a missing "obstacle" beat, because a 20 second demo did not need one. Say what a rule recommends, then follow their call.
- **Go all out on the first pass.** A one-pass output reads as low effort even when its base is right. Put that ambition into the first board, which costs nothing to make beautiful. It does not mean building before the gate.
- Plain words, numbers instead of adjectives, no em dashes.

## The flow

Seven steps, each closed by a gate only the director can pass. Do not start a step before the previous gate is in the ledger. Building ahead of agreement caused every expensive failure on record.

| Step | You make | Gate (the director's words, recorded) |
|---|---|---|
| 0. References | Their 2 or 3 "magic" films and 1 "average", measured | They agree what the films have in common |
| 1. Grill | `ledger.md`: five agreed lines and one sentence | One yes on the six lines |
| 2. Music and grid | A track picked by ear; `grid.json` | They agree the track |
| 3. Storyboard | `board-vN.png`, animatic, cold-viewer retell | "lock the board" |
| 4. Production file | `PRODUCTION.md`, prompt book if anything is generated | They approve the spend (or USD 0 is recorded) |
| 5. Build | The film, in code by default | A 1080p cut that passes the measured gates |
| 6. Critique and refine | Gate report, critic scores, routed fixes | Final lock; 4K only after their yes |

Make one folder per film and keep every board, track, cut and master there. Keep heavy media (frames, renders, fonts, `out/`) out of git with a `.gitignore`, so the ledger, PRODUCTION.md, board JSON, cue files and scripts are versioned while the heavy files stay on disk. The layout is in `references/pipeline.md` section 1. Start `ledger.md` at step 0, using the template in `references/grill.md` section 2. Script paths below are relative to this skill's folder.

If the director is away when you reach a gate, stop there with the artefact ready and a one-line summary of what you need. Do not pass a gate on their behalf, and do not raise a cap they set. While its director was away, Film B's loop logged "GATE OVERRIDE: fourth pass" and spent money on a beat that did not matter.

### Step 0. References

Ask for 2 or 3 films the director calls magic and 1 they call average, in one plain message. Taste comes from masters and measured references. Averaging popular explainers produces the median.

- Measure each film: cuts and shot lengths, loudness with `ffmpeg -i ref.mp4 -af ebur128=peak=true -f null -`, and tempo with `python3 -I scripts/beatgrid.py ref.mp4` (it reads any file ffmpeg can decode).
- Compare them with `references/taste-library.md`.
- Write down what the magic films share and how the average one differs, in numbers where you can (cuts a minute, hook time, where the turn lands, words on screen). Then add them to the taste library.
- If there is no time for this, use the taste library as it stands, and say so in the ledger.

### Step 1. Grill

Run `references/grill.md`: 23 questions drawn from published storytelling craft (Dicks, Duarte, Raskin, Fadell and others), deduplicated and cited. Resolve what you can by looking (the product, the launch doc, past ledgers) and ask only taste and direction questions.

**Gate:** six lines in the ledger, read back as one block, with one yes:
1. The viewer and their next action.
2. Old game to new game.
3. The turn: the five-second moment, as a frame.
4. The last frame.
5. The one line, in exact words.
6. The film in one sentence, with one image in it.

For a product film, recommend the real product flow as the spine and the viewer's own job as the protagonist. Do not invent a customer the viewer has no reason to care about. Check every line against the premise and against what the product does today, both ways. Over-claiming, and under-claiming from a stale doc, each cost a rewrite.

### Step 2. Music and grid

Picture and music are made together, never layered. Pick the track before the board, so the board is timed in beats.

- Bring 3 to 5 candidates the director can hear. A score synthesised in code is a proven option: on Film A it beat two stock tracks, one of which the director had picked. Licensed tracks are feel references only. Use them to agree the feel, and never put them in the film.
- The director picks by ear. Once a score fits, keep it. A swap is a downgrade until they hear otherwise.
- Measure the grid: `python3 -I scripts/beatgrid.py music/score.wav --out music/grid.json`. If it reports low confidence, it writes no beats on purpose. Mark the cut points by ear instead of trusting a guess. Check the downbeat by ear.
- Note the 1 to 3 strong cues (a drop, a swell, an accent) the biggest moments will lock to. Locking every landing feels mechanical; the rule is in `references/techniques.md` section 7.

**Gate:** the director agrees the track. Record it, with the BPM and grid confidence.

### Step 3. Storyboard, animatic, cold viewer

This is the cheap place to say no, so iterate here as much as the director wants. Spec and versioning are in `references/board-format.md`.

- One image, 6 to 9 panels, laid on the grid. Each panel shows the frame, the time, the exact on-screen words, the tool that makes it, the sound cue and the cost. Build it with `node scripts/board.mjs board/board-vN.json`, which refuses a panel that leaves any of these out. The sheet shows the total build cost, so every board says what a yes costs.
- For a code film, capture the panel stills from a rough timeline (`capture.mjs --stills`), so the board and the film share pixels. That rough timeline is board work at USD 0, not the build. Keep it to what the panels need.
- For a doubtful beat, show options side by side and recommend one.
- Each panel's on-screen words must fit their hold: a short label settled at least 0.8 s, a sentence about 0.3 s per word, counted from when the whole line is on screen. Fast in, then hold; never fast in, then gone. Texture text is exempt. Lock only 1 to 3 panels to strong music cues: a major reveal may move up to 0.15 s toward a cue, a smaller entrance up to 0.10 s toward a beat, and story and readability win over cues. Details in `references/techniques.md` section 7.
- Versioning: board-v1, then v2 with a one-line changelog. Never overwrite a version. Before you show a board, re-capture the stills from the current timeline, diff the board against the last one shown, and check that nothing rejected has come back.
- Animatic: the stills on the real track at their grid times, or a fast 1080p render for a code film.
- Cold-viewer retell, sound off: a fresh agent with only the frames retells the film in three sentences. Each of the six lines it misses is a story fault on the board. This test supports the director's eye and never replaces it (a Film B animatic passed it and was rejected on sight).

**Gate:** the words "lock the board", recorded with the version number.

### Step 4. Production file

Write `PRODUCTION.md` from `references/production-template.md`. It holds the director's words verbatim, the rules every agent follows, the look, the budget, the stages with owners and gates, file ownership for parallel agents, and a run log. Every agent reads it first. One binding file like this is what keeps many agents on one film.

If any beat is generated, write the prompt book by hand, in one context that holds the whole story. Each prompt is timestamped blocking with an action and a reaction on each beat. Agents never write generation prompts: in one public making-of, agent-written prompts burned about 830 credits before anyone read them.

**Gate:** nothing spends until the director has read the prompts or a 3-clip pilot of the hardest beats has passed in front of them. Record which one. For a film built only in code, record "USD 0".

### Step 5. Build

The default is the real product drawn in code. Every frame is a pure function of time through `seek(t)`, captured in headless Chrome and encoded with ffmpeg. The full method and the gotchas already paid for are in `references/pipeline.md`.

- **One look:** the product's real brand tokens, real components, real gradient and art. A redraw falls below the product, and directors see it at a glance.
- **Real components, the way the product's own specs use them.** Build every product screen from the product's design-system components. Hand-build only what the system lacks (a chat thread, a phone frame). Where a spec already drew the screen, start from it so the film and the spec match.
- **One grid:** every landing on the measured beats. **One score:** written for the cut.
- **One thing moving and one thing to read per frame.** The first 2 to 3 seconds must move.
- Generated footage, when the story truly needs real people or places, is a background plate. Type, UI and logos go on top in code. If it cannot hold identity, props and physics, cut the beat rather than regenerate it.
- Build and render the hardest 2 to 4 seconds first, and show the director before you build the rest. A wrong look is cheapest to catch on one beat.
- Before any full render, look at stills from every scene and from the start, middle and end of every transition (`capture.mjs --stills`, `references/pipeline.md` section 5). A plain crossfade between two busy layouts makes a muddy double image, so stagger it (old out, then new in) or dip through the background. Run `scripts/contrast.mjs` at the same times.
- Brand elements may follow the music subtly (glow, card presence, background warmth) from an envelope made ahead of time with `scripts/envelope.py` and sampled by time in `seek(t)`. Never waveforms, equaliser bars, strobing or text that scales. Effects sit in the score's key and space, under the music (`references/techniques.md` section 8).
- Serve the page over http, capture with `scripts/capture.mjs`, encode with `scripts/render.sh`. Review at 1080p.
- Use parallel agents only with the file-ownership table from PRODUCTION.md.
- Pick techniques per beat from `references/techniques.md`: product UI, concept, character, kinetic type, generated footage, openings and endings, timing and sound numbers.

**Gate:** a 1080p cut exists and `scripts/check.py` passes, with every SKIP explained.

### Step 6. Critique and refine

Follow `references/critic.md`.

1. **Measured gates first:** assets loaded, duration, resolution, fps, frame count, loudness (-14 LUFS, -1 dBTP), no unplanned black or frozen stretch, cuts on the grid. Then the WCAG contrast gate: `node scripts/contrast.mjs --url <page> --times <board still times>,<every scene's settled time>`, 4.5:1 for normal text and 3:1 for large; UNVERIFIED is not a pass. Then, by looking at stills: every product word and number on screen matches the board and the real product, every line holds long enough to read, and every claim holds both ways.
2. **Then a separate critic**, in a fresh context, scores 7 dimensions (story, wow, motion, design, finish, sound, truth) against anchored scores. It returns 5 to 10 timecoded fixes with numbers, and at least one fix that raises the wow.
3. **Route each fix back to the cheapest step that owns it.** Story goes to a new board version. Track goes to step 2. Timing and finish go to the build. Show the cost before any re-render.
4. **Show the director** the cut, the gate report, the top three fixes with your recommendation, and their cost. Their verdict goes in the ledger verbatim.

**Gate:** the final lock, in the director's words. 4K only after their yes. After the lock, any change is a new board version, never a patch on the master. Deliver from `out/final/` with a `LOCKED.md` (version, files, SHA-256, the director's words), and delete frame folders once their encodes are verified.

Deliverables in `out/final/`: the master, with the poster baked into frame 0 by `sh scripts/poster.sh --in master.mp4 --at <strongest settled time> --poster poster.png --out master-poster.mp4` (only frame 0's pixels change; it checks frame count and duration are unchanged and fails otherwise), plus `poster.png` itself for platforms that take an uploaded thumbnail. Pick a frame with its text fully in, never a fade or mid-transition, because Slack, X and Discord grab frame 0 as the thumbnail.

## The rules that matter most

The full set is in `references/learnings.md`. These are the ones that decided past films:

1. **Agree the story in words and one picture before any build or spend.** A change costs minutes on a board and a re-render after a build.
2. **The film must read for a viewer with no context, with the sound off.** Watch the whole cut as a viewer before you judge any frame.
3. **Every beat states its need.** Cut any symbol that needs explaining, and show the payoff on screen.
4. **The real product, made beautiful, is the protagonist of a product film.** Show its range inside one story.
5. **Use production components and the real brand.** Never a lookalike.
6. **One thing per frame.** Clutter, decorative colour and parallel cards all lose.
7. **Picture and score are made together, on a measured grid.** Keep a tempo and a score that work.
8. **Truth both ways.** Do not over-claim, and do not under-claim from a stale doc. For UI states in a demo, polish them and do not argue.
9. **Your reviewers and gate scores support the director's eye; they never replace it.** Show real frames early.
10. **Spend only after the director has read the prompts or a pilot has passed.** After three failed passes on one beat, question the beat, not the model. A pass cap is theirs to raise, not yours.
11. **Review cheap, master after a yes.** 1080p to review, 4K only after approval.
12. **Keep the good parts of earlier versions,** and never let a rejected element come back.

## Optional companions

The original private version of this skill handed craft questions to four companion skills (story craft, shot craft, generated-video prompting, and shot-by-shot measurement of a reference film). They are not part of this release. Showrunner works without them: the grill, the techniques file and the scripts here cover a code-built film end to end. If you have your own skills for those jobs, call them at the matching step.

## Scripts

All are in `scripts/`. They use Node 22+ built-ins, Python 3 stdlib, ffmpeg and ffprobe, with no installs, and each one fails loudly with a clear message. Tests live in `scripts/tests/`.

| Script | Job |
|---|---|
| `capture.mjs` | Takes stills or every frame of a `seek(t)` page with headless Chrome. It checks `window.ready`, `window.DURATION`, `window.seek`, image loads and fonts. It refuses `file://` for media pages and resumes after a drop with `--resume`. |
| `board.mjs` | Builds a storyboard sheet PNG from a JSON of 6 to 9 panels. It validates every field, shows the total cost, and never overwrites a version. |
| `render.sh` | Turns frames plus audio into an MP4: bt709 tags, faststart, optional tmix blur of 8 or more subframes. It deletes frames only after a verified encode. |
| `check.py` | Runs the measured gates on a finished file and prints PASS, FAIL or SKIP per gate. It exits non-zero on a fail. |
| `beatgrid.py` | Builds a beat grid from audio, using energy flux and a comb fit. If its confidence is low, it says so instead of guessing. |
| `contrast.mjs` | WCAG contrast gate on a `seek(t)` page at given times: per text element ratio, from DOM colours or screenshot pixels behind the text. Exit 1 on a FAIL, 2 when unverified (zero text checked). |
| `poster.sh` | Bakes a poster into frame 0 of a film (optionally pulling it with `--at T`). Verifies frame count, duration and audio unchanged; never overwrites without `--force`. |
| `envelope.py` | Writes a per-frame RMS envelope JSON of any audio file at a given fps, for subtle audio-reactive treatment. Fails on silent audio. |

Run the tests from this folder:
```sh
node --test 'scripts/tests/*.test.mjs'
python3 -m unittest discover -s scripts/tests -p 'test_*.py'
sh scripts/tests/test_render.sh
sh scripts/tests/test_poster.sh
```

## References

| File | Read it |
|---|---|
| `references/learnings.md` | Before the grill, and before you show any board or cut. 33 rules from real verdicts, plus the validation gate. |
| `references/grill.md` | At step 1. The question sequence, the ledger template and the gate. |
| `references/taste-library.md` | At step 0, and when choosing a technique. Each entry says how we know it. |
| `references/techniques.md` | At steps 3 and 5. Moves by beat type, timing numbers, sound rules and the banned list. |
| `references/board-format.md` | At step 3. Panel spec, versioning, the animatic and the cold-viewer test. |
| `references/production-template.md` | At step 4. PRODUCTION.md, the agent prompt skeleton and the prompt book. |
| `references/pipeline.md` | At step 5. The code-render pipeline, 4K and blur, gotchas, and the cost and time table. |
| `references/critic.md` | At step 6. Measured gates, the critic rubric and fix routing. |
| `references/sources.md` | When you need provenance. Every public source this skill draws on. |
