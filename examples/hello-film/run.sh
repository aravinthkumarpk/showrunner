#!/bin/sh
# Make the 6 second starter film end to end: score, beat grid, board stills, frames, MP4, gates, poster.
# Usage: sh examples/hello-film/run.sh [OUT_DIR]     (default: ./hello-film-out)
# Takes about a minute on a laptop. Needs what scripts/doctor.sh checks; no API keys.
set -eu
HERE=$(cd "$(dirname "$0")" && pwd)
S="$HERE/../../scripts"
OUT=${1:-hello-film-out}
PORT=${PORT:-8471}
mkdir -p "$OUT"
OUT=$(cd "$OUT" && pwd)
[ -e "$OUT/hello-film.mp4" ] && { echo "$OUT/hello-film.mp4 exists. Pick another folder or delete it." >&2; exit 1; }

echo "1/7 score";  python3 -I "$HERE/make_score.py" "$OUT/score.wav"
echo "2/7 grid";   python3 -I "$S/beatgrid.py" "$OUT/score.wav" --out "$OUT/grid.json" || echo "   (low confidence grid is fine for this demo)"

python3 -m http.server "$PORT" --bind 127.0.0.1 --directory "$HERE/site" >/dev/null 2>&1 &
SRV=$!
trap 'kill $SRV 2>/dev/null || true' EXIT INT TERM
sleep 1
URL="http://127.0.0.1:$PORT/index.html"

echo "3/7 stills"; node "$S/capture.mjs" --url "$URL" --stills 1.0,2.5,3.5,5.0 --out "$OUT/stills"
echo "4/7 frames"; node "$S/capture.mjs" --url "$URL" --frames --fps 30 --out "$OUT/frames"
echo "5/7 encode"; sh "$S/render.sh" --frames "$OUT/frames" --fps 30 --audio "$OUT/score.wav" --out "$OUT/hello-film.mp4"
echo "6/7 gates";  python3 -I "$S/check.py" "$OUT/hello-film.mp4" --duration 6 --size 1920x1080 --fps 30 --black-ok 5.5-6.0 --grid "$OUT/grid.json"
echo "7/7 poster"; sh "$S/poster.sh" --in "$OUT/hello-film.mp4" --at 4.0 --poster "$OUT/poster.png" --out "$OUT/hello-film-poster.mp4"
echo "Done. Watch $OUT/hello-film-poster.mp4"
