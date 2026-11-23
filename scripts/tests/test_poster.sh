#!/bin/sh
# Tests for poster.sh. Fixtures are made with ffmpeg testsrc2, color and sine.
# Run: sh scripts/tests/test_poster.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
POSTER="$HERE/../poster.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); echo "ok   $1"; }
bad() { FAIL=$((FAIL + 1)); echo "FAIL $1"; }

count() { ffprobe -v error -count_packets -select_streams v:0 -show_entries stream=nb_read_packets -of default=nw=1:nk=1 "$1"; }
dur() { ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$1"; }
acodec() { ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of default=nw=1:nk=1 "$1"; }
# Average RGB of a 10 by 10 patch at the centre of frame N, as "r g b".
centre() {
  ffmpeg -v error -i "$1" -vf "select=eq(n\,$2),crop=10:10:(iw-10)/2:(ih-10)/2,scale=1:1" -frames:v 1 -f rawvideo -pix_fmt rgb24 - |
    od -An -tu1 | tr -s ' ' | sed 's/^ //'
}
isred() { set -- $1; [ "$1" -gt 200 ] && [ "$2" -lt 60 ] && [ "$3" -lt 60 ]; }
moov_first() {
  python3 -I -c '
import struct, sys
d = open(sys.argv[1], "rb").read(); i = 0; order = []
while i + 8 <= len(d):
    size, kind = struct.unpack(">I4s", d[i:i + 8]); order.append(kind)
    if size == 1: size = struct.unpack(">Q", d[i + 8:i + 16])[0]
    if size < 8: break
    i += size
print(1 if b"moov" in order and b"mdat" in order and order.index(b"moov") < order.index(b"mdat") else 0)' "$1"
}

# A 1 s film at 30 fps with AAC audio, whose frames are never red, and a red poster the same size.
ffmpeg -v error -y -f lavfi -i "testsrc2=size=160x120:rate=30:duration=1" -f lavfi -i "sine=frequency=440:duration=1" \
  -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "$TMP/film.mp4"
ffmpeg -v error -y -f lavfi -i "color=c=red:size=160x120" -frames:v 1 "$TMP/red.png"
ffmpeg -v error -y -f lavfi -i "color=c=red:size=320x240" -frames:v 1 "$TMP/big.png"

# 1. Frame 0 becomes the poster; frame 1 is untouched; frame count, duration and audio are kept.
if sh "$POSTER" --in "$TMP/film.mp4" --poster "$TMP/red.png" --out "$TMP/o1.mp4" >"$TMP/log1" 2>&1; then
  [ "$(count "$TMP/o1.mp4")" = "$(count "$TMP/film.mp4")" ] && ok "frame count unchanged ($(count "$TMP/o1.mp4"))" || bad "frame count $(count "$TMP/o1.mp4"), want $(count "$TMP/film.mp4")"
  python3 -I -c "import sys; sys.exit(0 if abs(float('$(dur "$TMP/o1.mp4")') - float('$(dur "$TMP/film.mp4")')) < 0.02 else 1)" && ok "duration unchanged" || bad "duration changed"
  isred "$(centre "$TMP/o1.mp4" 0)" && ok "frame 0 is the poster" || bad "frame 0 is not the poster: $(centre "$TMP/o1.mp4" 0)"
  isred "$(centre "$TMP/o1.mp4" 1)" && bad "frame 1 was replaced too" || ok "frame 1 is the original frame"
  [ "$(acodec "$TMP/o1.mp4")" = "aac" ] && ok "audio copied through" || bad "audio codec is '$(acodec "$TMP/o1.mp4")'"
  [ "$(moov_first "$TMP/o1.mp4")" = "1" ] && ok "faststart (moov before mdat)" || bad "moov is not before mdat"
  grep -q "PASS" "$TMP/log1" && ok "prints a PASS verification line" || bad "no PASS line: $(cat "$TMP/log1")"
else
  bad "poster bake failed: $(cat "$TMP/log1")"
fi

# 2. Refuses to overwrite the output without --force, and --force allows it.
sh "$POSTER" --in "$TMP/film.mp4" --poster "$TMP/red.png" --out "$TMP/o1.mp4" >"$TMP/log2" 2>&1 && bad "overwrote without --force" || {
  grep -q -- "--force" "$TMP/log2" && ok "overwrite refused, says --force" || bad "overwrite refused without naming --force"; }
sh "$POSTER" --in "$TMP/film.mp4" --poster "$TMP/red.png" --out "$TMP/o1.mp4" --force >/dev/null 2>&1 && ok "--force overwrites" || bad "--force failed"

# 3. Writing over the input itself also needs --force, and still keeps the frame count.
cp "$TMP/film.mp4" "$TMP/inplace.mp4"
sh "$POSTER" --in "$TMP/inplace.mp4" --poster "$TMP/red.png" --out "$TMP/inplace.mp4" >/dev/null 2>&1 && bad "replaced the input without --force" || ok "in-place replace refused without --force"
if sh "$POSTER" --in "$TMP/inplace.mp4" --poster "$TMP/red.png" --out "$TMP/inplace.mp4" --force >/dev/null 2>&1; then
  [ "$(count "$TMP/inplace.mp4")" = "30" ] && isred "$(centre "$TMP/inplace.mp4" 0)" && ok "in-place with --force bakes frame 0" || bad "in-place result wrong"
else
  bad "in-place with --force failed"
fi

# 4. A poster that is not the film's size is refused, and nothing is written.
sh "$POSTER" --in "$TMP/film.mp4" --poster "$TMP/big.png" --out "$TMP/o4.mp4" >"$TMP/log4" 2>&1 && bad "wrong-size poster accepted" || {
  grep -q "320x240" "$TMP/log4" && ok "wrong-size poster refused, names both sizes" || bad "size refusal unclear: $(cat "$TMP/log4")"; }
[ ! -e "$TMP/o4.mp4" ] && ok "no output on a size refusal" || bad "output written despite a size refusal"

# 5. --at T pulls the poster from the film itself, writes it, then bakes it.
if sh "$POSTER" --in "$TMP/film.mp4" --at 0.5 --poster "$TMP/pulled.png" --out "$TMP/o5.mp4" >"$TMP/log5" 2>&1; then
  [ -s "$TMP/pulled.png" ] && ok "--at writes the poster file" || bad "--at wrote no poster"
  [ "$(count "$TMP/o5.mp4")" = "30" ] && ok "--at keeps the frame count" || bad "--at frame count $(count "$TMP/o5.mp4")"
else
  bad "--at failed: $(cat "$TMP/log5")"
fi
# ... and refuses to overwrite an existing poster file without --force.
sh "$POSTER" --in "$TMP/film.mp4" --at 0.5 --poster "$TMP/red.png" --out "$TMP/o5b.mp4" >/dev/null 2>&1 && bad "--at overwrote an existing poster" || ok "--at refuses to overwrite a poster without --force"
# ... and refuses a time past the end.
sh "$POSTER" --in "$TMP/film.mp4" --at 9 --poster "$TMP/late.png" --out "$TMP/o5c.mp4" >/dev/null 2>&1 && bad "--at past the end accepted" || ok "--at past the end refused"

# 6. Missing input or poster fails loudly.
sh "$POSTER" --in "$TMP/nope.mp4" --poster "$TMP/red.png" --out "$TMP/o6.mp4" >/dev/null 2>&1 && bad "missing input accepted" || ok "missing input refused"
sh "$POSTER" --in "$TMP/film.mp4" --poster "$TMP/nope.png" --out "$TMP/o6.mp4" >/dev/null 2>&1 && bad "missing poster accepted" || ok "missing poster refused"

echo "$PASS passed, $FAIL failed"
[ "$FAIL" = "0" ]
