#!/bin/sh
# Bake a poster into frame 0 of a film, so every platform thumbnail shows it.
# Slack, X and Discord make their own thumbnails and almost all of them grab frame 0, so the only
# reliable way to choose the idle image is to make frame 0 be the poster. Only frame 0's pixels change:
# the duration, the frame count and the audio (copied, not re-encoded) stay the same. At 30 fps the
# poster shows for 1/30 s, which nobody sees on playback. Source: brag (github.com/latent-spaces/brag,
# MIT), skills/brag/references/step-4-deliver.md.
#
# Usage:
#   sh poster.sh --in cut.mp4 --poster poster.png --out cut-poster.mp4
#   sh poster.sh --in cut.mp4 --at 14.4 --poster poster.png --out cut-poster.mp4   # pull the still first
#   sh poster.sh --in cut.mp4 --poster poster.png --out cut.mp4 --force            # replace in place
# Flags:
#   --in FILE       the finished film
#   --poster FILE   the poster image, the film's exact size (a still from the same render). PNG or JPG.
#   --at T          pull the poster from the film at T seconds and write it to --poster first.
#                   Pick the strongest settled frame: text fully in, not mid-transition.
#   --out FILE      the film to write. Refuses to overwrite (including --in) unless --force.
#   --crf N         default 14, as render.sh.  --preset P  default slow.
#   --force         allow overwriting --out, and --poster when --at is given.
set -eu

die() { echo "ERROR: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "$1 is not installed (brew install ffmpeg)"; }
need ffmpeg; need ffprobe

IN=""; POSTER=""; AT=""; OUT=""; CRF=14; PRESET=slow; FORCE=0
while [ $# -gt 0 ]; do
  case "$1" in
    --in) IN=${2:-}; shift 2 ;;
    --poster) POSTER=${2:-}; shift 2 ;;
    --at) AT=${2:-}; shift 2 ;;
    --out) OUT=${2:-}; shift 2 ;;
    --crf) CRF=${2:-}; shift 2 ;;
    --preset) PRESET=${2:-}; shift 2 ;;
    --force) FORCE=1; shift ;;
    *) die "unknown flag $1 (see the usage at the top of poster.sh)" ;;
  esac
done

[ -n "$IN" ] || die "--in FILE is required"
[ -f "$IN" ] || die "film not found: $IN"
[ -n "$POSTER" ] || die "--poster FILE is required"
[ -n "$OUT" ] || die "--out FILE is required"
case "$CRF" in ''|*[!0-9]*) die "--crf must be a whole number, got '$CRF'" ;; esac
if [ -e "$OUT" ] && [ "$FORCE" = 0 ]; then die "$OUT exists. Pass --force to overwrite it."; fi

vprobe() { ffprobe -v error -select_streams v:0 -show_entries "stream=$2" -of default=nw=1:nk=1 "$1"; }
frames() { ffprobe -v error -count_packets -select_streams v:0 -show_entries stream=nb_read_packets -of default=nw=1:nk=1 "$1"; }
duration() { ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$1"; }
acodec() { ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of default=nw=1:nk=1 "$1"; }

W=$(vprobe "$IN" width); H=$(vprobe "$IN" height)
[ -n "$W" ] && [ -n "$H" ] || die "$IN has no video stream"
N0=$(frames "$IN"); D0=$(duration "$IN"); A0=$(acodec "$IN")

if [ -n "$AT" ]; then
  python3 -I -c "import sys; t=float(sys.argv[1]); d=float(sys.argv[2]); sys.exit(0 if 0 <= t < d else 1)" "$AT" "$D0" 2>/dev/null \
    || die "--at must be a time from 0 to below the film's length ($D0 s), got '$AT'"
  if [ -e "$POSTER" ] && [ "$FORCE" = 0 ]; then die "$POSTER exists. Pass --force to overwrite it, or drop --at to use it as the poster."; fi
  ffmpeg -v error -y -ss "$AT" -i "$IN" -frames:v 1 "$POSTER" || die "could not pull a still at $AT s from $IN"
  [ -s "$POSTER" ] || die "no still was written at $AT s"
fi
[ -f "$POSTER" ] || die "poster not found: $POSTER"

PW=$(vprobe "$POSTER" width); PH=$(vprobe "$POSTER" height)
[ "${PW}x${PH}" = "${W}x${H}" ] || die "the poster is ${PW}x${PH} but the film is ${W}x${H}. Pull the poster from the same render (--at T) so frame 0 lines up exactly."

TMPOUT="$OUT.poster-tmp.mp4"
rm -f "$TMPOUT"
# The poster is converted with the bt709 matrix so its colours match the film, then shown on frame 0 only.
if ! ffmpeg -v error -y -i "$IN" -loop 1 -i "$POSTER" \
  -filter_complex "[1:v]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p[p];[0:v][p]overlay=0:0:enable='eq(n,0)':shortest=1:format=yuv420[v]" \
  -map "[v]" -map "0:a?" -c:v libx264 -crf "$CRF" -preset "$PRESET" -pix_fmt yuv420p \
  -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
  -c:a copy -movflags +faststart "$TMPOUT"; then
  rm -f "$TMPOUT"; die "ffmpeg failed to bake the poster"
fi

N1=$(frames "$TMPOUT"); D1=$(duration "$TMPOUT"); A1=$(acodec "$TMPOUT")
if [ "$N1" != "$N0" ]; then rm -f "$TMPOUT"; die "frame count changed from $N0 to $N1; nothing was written"; fi
python3 -I -c "import sys; sys.exit(0 if abs(float(sys.argv[1]) - float(sys.argv[2])) <= 0.02 else 1)" "$D0" "$D1" \
  || { rm -f "$TMPOUT"; die "duration changed from $D0 to $D1 s; nothing was written"; }
if [ "$A1" != "$A0" ]; then rm -f "$TMPOUT"; die "audio changed from '$A0' to '$A1'; nothing was written"; fi

mv -f "$TMPOUT" "$OUT"
echo "PASS poster baked into frame 0 of $OUT: $N1 frames, $D1 s, audio ${A1:-none} copied (unchanged from the input)"
