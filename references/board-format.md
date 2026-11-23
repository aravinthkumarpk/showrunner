# The storyboard: panel spec and versioning

Step 3. The board is where the director says no cheaply. The director's words: "iterate as much as feasible here ... so that cost is reduced later". On Film A, every "show me the board" round cost minutes; every change after a render cost a re-render.

## What a board is

One PNG image, 6 to 9 panels, laid on the measured grid from step 2. Made with `scripts/board.mjs` from a JSON file. Panel images are real stills: for a code film, capture them from the timeline with `capture.mjs --stills` (so the board and the film are the same pixels, the BLISS "build the tool first" lesson); before any code exists, use rough frames, and say so on the panel.

## Panel spec

Every panel carries all six. `board.mjs` refuses a panel that misses one.

| Field | What goes in it | Example |
|---|---|---|
| `time` | Start to end on the grid, in seconds, or "on beat n" | "12 s, on the beat" |
| `image` | The frame (a still) | `t_12.95.png` |
| `frame` | What the viewer sees, in one sentence. Where the eye lands. | "The mascot hatches; the panel lists the team." |
| `words` | Every on-screen word, exactly as it will appear. `""` means none, on purpose. | "Failed payment win-back" |
| `tool` | What makes it: code (seek(t)), product art, generated (model), live footage | "code + product art" |
| `sound` | The cue that lands on this panel | "snare + sparkle on beat 25" |
| `cost_usd` | Money to build this panel if locked. 0 for code. | 0 |

Optional `options`: two or more `{ label, image }` for a doubtful beat. They render side by side with a "choose one" tag. Recommend one in your message; do not leave the director a menu.

Board-level fields: `film`, `version`, `changelog` (required from v2, one line), `track`, `duration_s`, `line` (the agreed one line). The sheet shows the total build cost at the top right, so every board says what a yes costs.

```sh
node scripts/board.mjs <film>/board/board-v2.json
```

## Before you show a board

1. Re-capture every still from the current timeline. A stale still is how the rejected floating box came back on an earlier Film A board.
2. Diff it against the last board the director saw: list what changed in the changelog, and check nothing the director rejected has returned (keep a "rejected" list at the bottom of the ledger).
3. Check alignment, highlights and finish on every still (rule 17). Run the `impeccable` critique on the frames if anything looks generic.
4. Read the words on every panel against the board JSON and against the real product.
5. Check that each panel's on-screen words fit their hold. Time the hold from when the whole line is settled to when it starts to leave, and compare: a short label needs at least 0.8 s, a sentence about 0.3 s per word (at least 1.2 s). Fast in, then hold; never fast in, then gone. A panel whose words do not fit gets a longer hold, fewer words, or a staggered reveal that holds the full set. Text that is only texture is exempt; say so in the panel's `words` field. The full rule is in `techniques.md` section 7. Source: brag (github.com/latent-spaces/brag, MIT), `references/step-2-plan.md`. Why: the board is the cheapest place to find a line that flashes past, and a feed viewer gets one pass at it.
6. If a panel locks to a music cue, say so in its `sound` field (`cue lock: beat 12`). Use 1 to 3 cue locks per film (`techniques.md` section 7).
7. Open the PNG and look at it yourself.

## Versioning rules

- `board-v1.png`, `board-v2.png`, and so on. Never overwrite a version; `board.mjs` refuses.
- From v2, a one-line changelog on the sheet. The detail goes in the ledger.
- Keep what worked. Each new version lists, in the ledger, what it kept from earlier versions (the director asked "what can we bring in from the previous version" three times on Film A).
- "Lock the board" is the director's words, recorded verbatim in the ledger with the version. Nothing else locks it.
- After the lock, any change to story, words, order or timing is a new board version, shown to the director, before it reaches the build. Polish inside a panel (finish, easing, glow) is not a story change.

## The animatic

After the board looks right and before the lock:
1. Put the panel stills on the real track at their grid times: `ffmpeg -f concat` of the stills with each one's duration, plus the score. For a code film, a 1080p render with low effort settings is the animatic.
2. Show it to the director with sound.
3. Run the cold-viewer test (below).

## The cold-viewer retell test (sound off)

1. Give a fresh agent with no project context only the animatic frames in order, as stills or a contact sheet, with no sound and no captions beyond what is on screen.
2. Ask it to retell the film in three sentences: who it is for, what changes, what the viewer should do.
3. Compare against the five agreed lines. Each line it misses is a story fault on the board, not a polish fault.
4. Report the result to the director with the animatic. This test supports the director's eye; it never replaces it. Film B's animatic passed a model retell and it was rejected on sight (rule 28).

Feeds autoplay muted, so a film that fails sound-off fails in the feed.
