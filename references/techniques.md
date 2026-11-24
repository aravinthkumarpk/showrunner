# Techniques by beat type

Moves that transfer, each with its source. Pick per beat on the board. Shot craft (lens, light, camera moves) and generated-video prompting are only touched on here. This file covers code-drawn product films, type, and timing numbers.

## Contents

1. Product UI beats
2. Concept beats (explaining an idea)
3. Character beats (mascot or person)
4. Kinetic type and captions
5. Generated footage beats
6. Openings and endings
7. Timing rules
8. Sound rules
9. Banned list

## 1. Product UI beats

- **Use the production UI, not a redraw.** Copy the real components, tokens, gradient and art from the product repo or the design system. Redraws fall below the product and directors see it (rule 15). Film A used the real product gradient, production option rows and real buttons.
- **Show the mechanism once, early, then only results.** A hand or cursor drops an input into the real prompt bar, the request is typed in the user's own words, then the film shows outputs. (Google, 0 to 6 s.)
- **Input next to output.** A real customer artefact on one side (a WhatsApp thread, a CSV of abandoned carts, a scribbled requirement), the agent's working result on the other. Cut the two halves out of step to double the pace while each pair stays readable. (Google.)
- **The flow is the spine.** Describe, spec, examples, Trial run, reveal (rule 6). Put capabilities inside the steps, not on a separate card (rule 7).
- **One-take screen camera.** Whip-pans between panes, zoom never below 1, every label true to the product, each action causes a real state change. (lemo "Living Screencast".)
- **UI expansions land on the beat a frame early**, so the beat frame is already about 80 percent open. (lemo Dark Tech Keynote.)
- **Closed-form springs.** A value that changes target several times is the sum of one spring per change, so it stays a pure function of t. Give two edges of one element different springs for stretch. (@twoclipping #15.)
- **Polish the product's own parts.** Hatching, glow, connectors, ticks. In a demo, UI states the product can show are fair (rule 26).
- **Measure the live DOM for match cuts and mascot placement**, never hard-code positions. (lemo; @twoclipping #16.)
- **A mocked messaging app shows only what the real app can send.** Text with words, bold and emoji, and no inline images. Images with captions. At most 3 reply buttons. A button reply that echoes the button's title. Voice notes, date chips between days, a "Forwarded" label, and the real long-press menu and forward sheet. Icons go only inside sent images. Check every frame against the app's real message types (rule 40). (Film D.)
- **Images the product sends look like sent photos**: square, one hero number, about 4 words at most, a small mark, no rows, buttons or app chrome inside. The caption carries the rest, with the time at its end (rule 41). (Film D.)
- **One message at a time, with the camera on it.** Push in on the one bubble that matters (Film D used 2.6x, which took chat type from 29 to 44 px), and dim and blur the older bubbles. Frame the input bar and the sent bubble together so the camera does not creep after a send (rule 42).

## 2. Concept beats

- **Old game against new game in one contrast line.** "Every screen changed. The keyboard didn't." Then a held beat, then the reveal. (Glaido; Raskin.)
- **Make the abstract physical.** Google turns paper into a model (a trail map into terrain, a sketch into a working kite). A B2B version: a messy sheet that becomes a clean table. (Google 18.5 to 20 s, "Beach Finds".)
- **Shape match cuts** carry an idea across scale: a circle to Earth, a shell to a galaxy. (Google.)
- **A running motif object** that changes form across scenes holds continuity (the "spark" in mexicat's P(doom)). In a product film the mascot can do this job.
- **Never a symbol that needs explaining.** If the cold viewer asks "why is there a paperweight", cut it (rule 3).
- **One accent colour owned by the product; a "problem colour" that disappears after the turn.** (lemo Dark Tech Keynote; mexicat palette.)

## 3. Character beats

- **Write the reads.** For each shot, list the things the viewer must understand, each with a start and an end, never overlapping. "Fast actions, slow meanings." Lead the eye before each read. Let the reads set the length. (ClaudeAnimationBase ANIMATION_GUIDE.)
- **Nothing is ever fully still.** Breathing, a blink, a slow scale (Film A's end card scales 1.2 percent over its hold). `check.py` fails a fully frozen stretch of 3 s.
- **Avoid twinning.** Offset arms, blinks and random seeds per element. (ClaudeAnimationBase.)
- **A mascot's action must cause something**, not decorate. (lemo "Clawd Moves In".)
- **A person must be real or not there.** No invented protagonist (rule 5). Photoreal generated people only with everyday realism (rule 19) and a canon string in every prompt (the Slopcore films by anabology).

## 4. Kinetic type and captions

- **Every spoken word on screen, function words small, the key word huge.** (Glaido.)
- **Exactly two emphasis styles.** One accent highlight for verbs and outcomes; one contrast style for the problem word ("DIDN'T."). Hold the brand colour until the product appears. (Glaido.)
- **The hook lands word by word on the beats.** Masked type reveals. No full stops in on-screen text. (@twoclipping #16.)
- **Words are found by content, never by hard-coded time**, so a VO change re-times them. (mexicat.)
- **Short lines and short bubbles.** Giant lines have at most 5 words a line and 2 lines. A chat bubble has at most 12 words, reply buttons included. Pick the plainest line that works, and offer lines as 3 or 4 pairs in a table with one pick (rules 38, 42, 50). (Film D.)
- **Read holds.** Subtitles hold at least the larger of 1.8 s or the line plus 0.6 s. Animated text holds letters / 15 + 1.5 s (English). Title cards hold at least 4 s, unless they are a beat-cut opener the director has approved. (lemo DIRECTOR.md.) The floor under all of these, counted from when the whole line is settled on screen, is in section 7 (reading time).
- **Text-light frames.** Models overuse text. Show, do not label. (ClaudeAnimationBase; PDoomVideo.)
- **Type sits on the brand system**: the product's own headline and body faces and colour tokens, never a default webfont.

## 5. Generated footage beats

Only when the story needs real people or places that code cannot draw. Default is code.
- **Generated footage is the plate. Meaning goes on top in code**: words on time, UI, graphics. (The Slopcore films, all three.)
- **Never ask a generator for text, logos or UI.** It bends lines and letters. (BLISS making-of.)
- **Leave room for code.** Give the performer something to play against without drawing it: "something enormous just out of frame to the right". End green-screen prompts with "Nothing else enters the frame." (BLISS.)
- **Prompts are timestamped blocking with action and reaction**, written by hand by the lead in one context, read before spend. (CLODYSSEY round two; `production-template.md`.)
- **Real clips inside a code film**: extract to JPEG sequences at the film's fps and swap the image source per frame; `seek(t)` awaits decode. (@twoclipping #16.)
- **Keep inputs in colour; apply the look in post.** (ESCAPE VELOCITY v1 to v2.)
- Everything else (models, word counts, references, candidate counts) belongs to your generated-video prompting practice.

## 6. Openings and endings

- **Open on the viewer's own problem, in their own terms**, not on the product's agents asking for things (rule 34). Let it escalate to a point the viewer feels. Film C's alerts went from 27 to more than 99, the swipes slowed, and the screen dimmed and locked at 3.0 s. (Films C and D.)
- **Hand each problem to its solver on screen.** After the turn, each alert lifts off the phone and flies to the agent or assistant that owns it, and the count drains to zero (rule 35). (Films C and D.)
- **The turn is a bang, then a breather.** Cut the music to silence (Film C: 0.7 s before the hit), strike through the problem line, slam the answer in on the hit. Then hold one bar with nothing new in it, so the new state can be read (rule 36). (Film C.)
- **A day as the spine.** For a day-in-the-life film, a clock carries the structure: odometer type, a hairline day line with a sun and a moon, light that moves across the day, no boxed card. Each landing sits on a beat, and mid-roll the clock steps through readable times. Every clock in frame reads the same source. Open on a stressed night and end on a calm evening (rule 39). (Film D.)
- **Open on a place and an action**, not a title. (Dicks: "I am in a place and I'm doing a thing.") Google opens on a hand and a notebook.
- **Plant an elephant**: something in the first 2 s that makes the viewer ask what happens next. (Dicks.)
- **The opening is the ending's opposite.** (Dicks.)
- **End on a held image, not a card doing the image's job.** (Neubert's ad.)
- **End on a mark made from the world.** Google stamps "gemini" then "4" on 20 real walls, a new wall every 2 frames, then holds 2 s. Film A ends on a crowd of the product's own mascot art.
- **If there must be a call to action**: the mark, one URL pill, one qualifier (platform or price). (Glaido end card.)
- **Bookend**: the last beat finishes the first (lemo "Room to Think": the cursor completes its first sentence).

## 7. Timing rules

**Measured on 21 launch films (huashu-motion `references/rhythm.md`):**
- Hook within 3 s (14 of 21 films).
- Most cut 10 or more times a minute; music-led films average a shot every 1.8 to 3.5 s.
- The densest 5 s sits at about 37 percent of the running time.
- The hero lands on the strongest musical point.
- An optional stop of 0.5 to 1.6 s before the biggest hit.
- No stretch longer than about two bars without something new.
- At every section boundary, change at least two of: shot scale, speed, ease family, camera, density, colour, music texture.
- At least 1.5 s on the final mark.

**From lemo DIRECTOR.md:** hook in 3 s; one subject, one goal, one turn; at least two real silences before the peak, and the first sound after a silence is one of the most important in the film; at least two J-cuts or L-cuts.

**From Google (measured):** one continuous move for the first 7 s, the turn at about 15 percent (7.5 of 50 s) on a music jump, then about one cut a second with out-of-step diptychs, full-frame rests, a 2-frame burst, a 2 s hold, black.

**From the director's verdicts:** the first 2 to 3 s must move (rule 24); keep a tempo that works and never stretch a cut to a new track (rule 20); a pause is required.

**Reading time** (brag, `skills/brag/SKILL.md` and `references/step-2-plan.md`). Pace comes from motion and cuts, never from pulling text away before it can be read:
- A short label (1 to 3 words) stays settled on screen at least 0.8 s.
- A sentence stays about 0.3 s per word, at least 1.2 s. The hook line gets the most.
- Count from when the whole line is on screen and still, not from when it starts to enter, and stop when it starts to leave.
- Fast in, then hold. Never fast in, then gone. A line can slam in over 0.3 to 0.6 s and still read, if it then holds.
- Sequential text on a fast grid outruns reading: at 110 BPM and up, beats land about 0.5 s apart. Snap readable lines to every other beat, or reveal them fast and hold the full set. Accents (a tick, a glow, a dot) may still hit every beat.
- Text that is only texture (a scrolling log, a blurred list behind the hero) is exempt. Mark it on the board as texture.
Why: brag's own spec rows rushed at 110+ BPM until it set this floor, and a feed viewer gets one pass at each line. The board gate in `board-format.md` and the critic gate in `critic.md` check it.

**Messages in a mocked app** (Film D): each message stays fully readable for 0.3 s a word plus 1 s, one after another. Measure it in the page and keep the table described in `board-format.md`. These holds set the film's length: Film D's readable board ran 67 s against a 54 s brief, and tightening every transition later saved only 0.5 s (rules 42, 44).

**Motion pace** (Film D, after "laggard" on an approved cut). Snappy moves and full holds go together:
- Transitions and camera moves take 250 to 450 ms with a strong ease-out.
- Push-ins land in about 400 ms (an exponential with a time constant of about 0.1 s), then drift under 2% through the hold, so nothing fully freezes.
- Message pops take about 200 ms: scale 0.96 to 1, plus a fade.
- Clock rolls take 700 to 900 ms, step through readable times, and land on the beat.
- Characters move in about 450 ms with a small overshoot and settle.
- No dead air between beats, and no black gap before the end card.
Measured on Film D, the average transition went from 0.393 to 0.326 s across 91 moves (rule 46).

**Formats for messaging apps.** A 16:9 film plays about 400 px wide inside a chat, where chat text falls to about 9 px. Make a 9:16 cut from the same timeline with its own layout: the giant line above the phone, a small clock in a corner, the phone pushed in (2.75x on Film D), chat text at 44 to 48 px, and every label at least 30 px. Run every gate on both cuts (rule 45).

**Cue locks** (brag, `references/step-3-compose.md` and `references/audio.md`):
- Lock only 1 to 3 strong music cues per film (a drop, a swell, an accent) to the biggest moments: the turn, the hero reveal, the mark landing.
- A major reveal may move up to 0.15 s toward a strong cue. A smaller entrance may move up to 0.10 s toward a beat. Never further.
- Story and readability win over cues. If a lock would cut a hold short or bunch two reads together, keep the natural time.
- Mark each lock in `timeline.js` with its cue (`// cue lock: 5.80 s, beat 12`), so the board and the critic can see which landings are deliberate.
Why: locking every landing to the grid makes the film feel mechanical, and a reveal more than about 0.15 s off its musical point reads as late, not as synced. Hard cuts still sit on the grid (`check.py --grid`).

**Pick one route per film**: one long transforming move, or a burst of short cuts around one hold. Never between.

## 8. Sound rules

- **The score is the clock.** Measure it with `scripts/beatgrid.py` before the board; every panel time sits on its beats. (Slopcore films; @twoclipping #16.)
- **A score written in code for the cut** (Film A's `synth.py`) beat a stock track the director picked (rule 21). Licensed tracks are feel references only and never go in the film.
- **One event list drives picture and sound.** Film A's `synth.py` and `timeline.js` shared scene times. Better still: export the timeline's events as JSON and read them in the synth, so a change in one cannot drift from the other. (lemo `window.EV`; mg-styles cues.)
- **Place each effect by its measured peak**, not its file start. A whoosh syncs on its pass-by peak, a riser on its end. (mg-styles audio; @twoclipping #16.)
- **Two sound families**: disorder sounds scattered and detuned before the turn; product sounds one family in one key after it. (lemo Dark Tech Keynote.)
- **Duck the music about 3 dB under each effect and about 8 dB under VO.** VO about 10 dB over the bed. (mg-styles; lemo.)
- **Master to -14 LUFS integrated, true peak -1 dBTP or lower**; two-pass loudnorm, then verify. (lemo mux.sh; mg-styles.) `check.py` gates it.
- **VO minimal, with pauses**, or none (rule 23). ASR-check any TTS line before mixing (lemo `asr_check.py`).
- **Effects in the music's key and space** (brag, `skills/brag/SKILL.md` and `references/audio.md`). Write the music and the effects as one piece: effects in the same key and through the same reverb as the score, blended in, not laid on top. Effects sit softly under the music, nothing harsh or spiky, and a repeated small sound (a tick per row, a key per letter) gets quieter on each repeat and stays in the background. For repeated or polished moments, prefer effects with little high-frequency energy: a bright click repeated ten times turns into a hiss. Why: a stock effect in another key is what makes a mix sound assembled, and the Film A's `synth.py` effects worked because they were in C major through the score's reverb.
- **Free effects that work.** brag (github.com/latent-spaces/brag, MIT) bundles 13 CC0 effects (public domain, no attribution): 8 by Kenney (click, drop, bell and glass impacts, a soft impact) and 5 keypresses from unicae_games' "Keyboard Soundpack #1". Pitch or filter them into the score's key before use, and place each by its measured peak.
- **ende.app music is CC BY 4.0** (Sascha Ende, bundled with brag). CC BY needs attribution, so credit "Music by ende.app" wherever the film is posted. A score written in code for the cut is still the better choice, so treat these tracks as feel references like any licensed track.
- **Subtle audio-reactive treatment** (brag, `references/audio.md`, "Audio-reactive visuals"). Brand elements may follow the music's energy: the hero glow, a product card's presence (a little lift or shadow), background warmth. Compute the envelope ahead of time with `python3 -I scripts/envelope.py music/score.wav --fps 30 --out music/envelope-30.json` (per-frame RMS, plus a 0..1 copy), load it with the page, and sample it by time inside `seek(t)` (`ENV.norm[Math.min(ENV.frames - 1, Math.floor(t * ENV.fps))]`), so every frame stays a pure function of t. Make it at the capture fps (60 for the 4K master). Keep the range small (an opacity of 0.85 to 1.0, a scale under 1 percent) and smooth it in the page if it flickers. Never waveforms, equaliser bars, musical notes, strobing, heavy pulsing, or text that scales with the music. Why: a small movement tied to the score makes the frame feel alive (section 3: nothing is ever fully still), while a visualiser is a template tell and pulsing text hurts reading.

## 9. Banned list

Template tells the director and the best references reject. Add to it per film in PRODUCTION.md.
- Shockwave rings, particle bursts, RGB split, camera shake, lens flares, neon glows, grid floors, flashing backgrounds, bouncy easing everywhere. (@twoclipping #16.)
- Glowing brains, Matrix code rain, purple and cyan cyberpunk, stock "AI" imagery. (mexicat TREATMENT.)
- Decorative colour fields (rule 16: "the blue si a bit gimmicky??").
- Home-made gradients when the product has a real one (rule 15).
- Constant easing on every move. (Vault note `remotion-vs-hyperframes-agentic-video.md`: "constant easing is the AI tell".)
- Default crossfades. Every seam is a designed transition or a cut on action. (ClaudeAnimationBase.) A plain crossfade between two busy layouts makes a muddy double image at its midpoint: stagger it (old content out, then new content in) or dip through the background. (brag.)
- A boxed clock card, and a clock that blurs past unreadable mid-roll (rule 39). (Film D.)
- Rich cards, widgets or inline icons inside a mocked chat, when the real app cannot send them (rule 40). (Film D.)
- Waveforms, equaliser bars, musical notes, strobing, and text that scales with the music. Audio-reactive means a subtle glow or presence on brand elements only. (brag.)
