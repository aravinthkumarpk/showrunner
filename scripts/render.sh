#!/bin/sh
# Frames plus audio to an MP4 master: H.264, bt709 tags, faststart, AAC 320k.
# Optional motion blur: capture at fps x N, then average every N frames (tmix) into one output frame.
# Frames are deleted only after the encode is verified, unless --keep-frames.
#
# Usage:
#   sh render.sh --frames DIR --fps 30 --audio score.wav --out film.mp4
#   sh render.sh --frames DIR --fps 60 --blur 8 --audio score.wav --out film-4k60.mp4
# Flags:
#   --frames DIR      PNG sequence from capture.mjs (f_00000.png ...)
#   --pattern P       default f_%05d.png
#   --fps N           OUTPUT frame rate. With --blur N the frames must be captured at fps x N.
#   --blur N          subframes per output frame, 8 or more. 2 to 7 is refused (see below).
#   --audio FILE      the score. Trimmed to the picture length. Or --no-audio to say so on purpose.
#   --crf N           default 14 (visually lossless for UI; 12 to 16 is the useful range)
#   --preset P        default slow
#   --out FILE        the MP4 to write. Refuses to overwrite unless --force.
#   --keep-frames     keep the frames after a good encode
#   --blur-unsafe     allow 2 to 7 subframes anyway
#
# Why 8 or more subframes: an earlier 4K60 render blended 2 samples per frame and the fast title
# glide showed two separate copies of the text (16 Oct 2026). Use 8+ subframes, or no blur at all.
set -eu

die() { echo "ERROR: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "$1 is not installed (brew install ffmpeg)"; }
need ffmpeg; need ffprobe

FRAMES=""; PATTERN="f_%05d.png"; FPS=""; BLUR=1; AUDIO=""; NOAUDIO=0; CRF=14; PRESET=slow; OUT=""; KEEP=0; UNSAFE=0; FORCE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --frames) FRAMES=${2:-}; shift 2 ;;
    --pattern) PATTERN=${2:-}; shift 2 ;;
    --fps) FPS=${2:-}; shift 2 ;;
    --blur) BLUR=${2:-}; shift 2 ;;
    --audio) AUDIO=${2:-}; shift 2 ;;
    --no-audio) NOAUDIO=1; shift ;;
    --crf) CRF=${2:-}; shift 2 ;;
    --preset) PRESET=${2:-}; shift 2 ;;
    --out) OUT=${2:-}; shift 2 ;;
    --keep-frames) KEEP=1; shift ;;
    --blur-unsafe) UNSAFE=1; shift ;;
    --force) FORCE=1; shift ;;
    *) die "unknown flag $1 (see the usage at the top of render.sh)" ;;
  esac
done

isint() { case "$1" in ''|*[!0-9]*) return 1 ;; *) return 0 ;; esac; }
[ -n "$FRAMES" ] || die "--frames DIR is required"
[ -d "$FRAMES" ] || die "frames dir not found: $FRAMES"
[ -n "$OUT" ] || die "--out FILE is required"
isint "$FPS" && [ "$FPS" -gt 0 ] || die "--fps must be a whole number above 0, got '$FPS'"
isint "$BLUR" && [ "$BLUR" -ge 1 ] || die "--blur must be a whole number, got '$BLUR'"
isint "$CRF" || die "--crf must be a whole number, got '$CRF'"
if [ "$BLUR" -gt 1 ] && [ "$BLUR" -lt 8 ] && [ "$UNSAFE" = 0 ]; then
  die "--blur $BLUR is refused: with fewer than 8 subframes, fast moves show ghost copies instead of a smooth blur (seen on an earlier 4K60 render). Use --blur 8 or more, or no blur. --blur-unsafe overrides."
fi
if [ "$NOAUDIO" = 0 ]; then
  [ -n "$AUDIO" ] || die "--audio FILE is required. A film without sound is a choice: say --no-audio."
  [ -f "$AUDIO" ] || die "audio not found: $AUDIO"
fi
[ -e "$OUT" ] && [ "$FORCE" = 0 ] && die "$OUT already exists. Pick a new name (versions are cheap) or pass --force."

# Count the sequence and check it has no gaps.
GLOB=$(printf '%s' "$PATTERN" | sed 's/%0*[0-9]*d/*/')
COUNT=$(find "$FRAMES" -maxdepth 1 -name "$GLOB" | wc -l | tr -d ' ')
[ "$COUNT" -gt 0 ] || die "no frames matching $PATTERN in $FRAMES"
FIRSTFILE=$(find "$FRAMES" -maxdepth 1 -name "$GLOB" | sort | head -n 1)
START=$(basename "$FIRSTFILE" | sed 's/[^0-9]//g' | sed 's/^0*\([0-9]\)/\1/')
LASTIDX=$((START + COUNT - 1))
# Walk every index, so a hole in the middle is caught and named, not just a short tail.
i=$START
while [ "$i" -le "$LASTIDX" ]; do
  # shellcheck disable=SC2059
  NAME=$(printf "$PATTERN" "$i")
  [ -f "$FRAMES/$NAME" ] || die "missing frames: $NAME is not in $FRAMES ($COUNT files from index $START). Re-run capture.mjs with --resume to fill the gap."
  i=$((i + 1))
done
[ $((COUNT % BLUR)) -eq 0 ] || die "$COUNT frames do not divide by --blur $BLUR. Capture exactly fps x $BLUR x duration frames."

OUTFRAMES=$((COUNT / BLUR))
INRATE=$((FPS * BLUR))
DUR=$(python3 -I -c "print(f'{$OUTFRAMES / $FPS:.6f}')")
VF="scale=out_color_matrix=bt709:out_range=tv:flags=lanczos+accurate_rnd+full_chroma_int,format=yuv420p,setparams=color_primaries=bt709:color_trc=bt709:colorspace=bt709:range=tv"
if [ "$BLUR" -gt 1 ]; then
  VF="tmix=frames=$BLUR,select='eq(mod(n\\,$BLUR)\\,$((BLUR - 1)))',setpts=N/($FPS*TB),$VF"
fi

TMP_OUT="$OUT.partial.mp4"
rm -f "$TMP_OUT"
echo "encoding $COUNT frames ($OUTFRAMES out at $FPS fps, blur $BLUR) to $OUT"
if [ "$NOAUDIO" = 1 ]; then
  ffmpeg -v error -y -framerate "$INRATE" -start_number "$START" -i "$FRAMES/$PATTERN" \
    -vf "$VF" -r "$FPS" -c:v libx264 -preset "$PRESET" -crf "$CRF" -x264-params aq-mode=3 \
    -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
    -movflags +faststart -t "$DUR" "$TMP_OUT"
else
  ffmpeg -v error -y -framerate "$INRATE" -start_number "$START" -i "$FRAMES/$PATTERN" -i "$AUDIO" \
    -map 0:v:0 -map 1:a:0 -vf "$VF" -r "$FPS" -c:v libx264 -preset "$PRESET" -crf "$CRF" -x264-params aq-mode=3 \
    -colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv \
    -c:a aac -b:a 320k -movflags +faststart -t "$DUR" "$TMP_OUT"
fi

# Verify before anything is deleted: frame count and duration must match what went in.
GOT=$(ffprobe -v error -count_packets -select_streams v:0 -show_entries stream=nb_read_packets -of default=nw=1:nk=1 "$TMP_OUT")
[ "$GOT" = "$OUTFRAMES" ] || die "encode check failed: $GOT frames in the output, expected $OUTFRAMES. Frames kept in $FRAMES, partial file at $TMP_OUT."
mv "$TMP_OUT" "$OUT"
echo "verified: $GOT frames, $DUR s"

if [ "$KEEP" = 0 ]; then
  find "$FRAMES" -maxdepth 1 -name "$GLOB" -delete
  rm -f "$FRAMES/manifest.json"
  rmdir "$FRAMES" 2>/dev/null || echo "note: $FRAMES still holds other files, so it was kept"
  echo "frames deleted (pass --keep-frames to keep them)"
fi
echo "done: $OUT"
