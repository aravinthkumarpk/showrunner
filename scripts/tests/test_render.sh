#!/bin/sh
# Tests for render.sh. Fixtures are made with ffmpeg testsrc and sine.
# Run: sh scripts/tests/test_render.sh
set -u
HERE=$(cd "$(dirname "$0")" && pwd)
RENDER="$HERE/../render.sh"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

ok() { PASS=$((PASS + 1)); echo "ok   $1"; }
bad() { FAIL=$((FAIL + 1)); echo "FAIL $1"; }

frames() { # dir count rate
  mkdir -p "$1"
  ffmpeg -v error -y -f lavfi -i "testsrc2=size=160x120:rate=$3" -frames:v "$2" "$1/f_%05d.png"
}
probe() { ffprobe -v error -select_streams v:0 -show_entries "stream=$2" -of default=nw=1:nk=1 "$1"; }
moov_first() { # prints 1 when the moov atom comes before mdat (faststart)
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

ffmpeg -v error -y -f lavfi -i "sine=frequency=440:duration=3" "$TMP/a.wav"

# 1. A plain encode: 30 frames at 30 fps plus audio gives a 1 s MP4 with bt709 tags and faststart, then frames are gone.
frames "$TMP/f1" 30 30
if sh "$RENDER" --frames "$TMP/f1" --fps 30 --audio "$TMP/a.wav" --out "$TMP/o1.mp4" >"$TMP/log1" 2>&1; then
  n=$(ffprobe -v error -count_packets -select_streams v:0 -show_entries stream=nb_read_packets -of default=nw=1:nk=1 "$TMP/o1.mp4")
  [ "$n" = "30" ] && ok "plain encode has 30 frames" || bad "plain encode has $n frames, want 30"
  [ "$(probe "$TMP/o1.mp4" color_primaries)" = "bt709" ] && ok "bt709 primaries tagged" || bad "bt709 primaries missing"
  [ "$(probe "$TMP/o1.mp4" color_transfer)" = "bt709" ] && ok "bt709 transfer tagged" || bad "bt709 transfer missing"
  [ "$(moov_first "$TMP/o1.mp4")" = "1" ] && ok "faststart (moov before mdat)" || bad "moov is not before mdat"
  a=$(ffprobe -v error -select_streams a:0 -show_entries stream=codec_name -of default=nw=1:nk=1 "$TMP/o1.mp4")
  [ "$a" = "aac" ] && ok "audio is AAC" || bad "audio codec is '$a'"
  d=$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$TMP/o1.mp4")
  python3 -I -c "import sys; sys.exit(0 if abs(float('$d') - 1.0) < 0.05 else 1)" && ok "audio trimmed to picture length" || bad "duration $d, want 1.0"
  [ ! -e "$TMP/f1" ] && ok "frames deleted after a good encode" || bad "frames dir still there"
else
  bad "plain encode failed: $(cat "$TMP/log1")"
fi

# 2. --keep-frames keeps them.
frames "$TMP/f2" 10 30
sh "$RENDER" --frames "$TMP/f2" --fps 30 --audio "$TMP/a.wav" --out "$TMP/o2.mp4" --keep-frames >/dev/null 2>&1
[ "$(ls "$TMP/f2" | wc -l | tr -d ' ')" = "10" ] && ok "--keep-frames keeps all 10 frames" || bad "--keep-frames lost frames"

# 3. Two-sample blur is refused, because it ghosts on fast moves.
frames "$TMP/f3" 20 60
if sh "$RENDER" --frames "$TMP/f3" --fps 30 --blur 2 --audio "$TMP/a.wav" --out "$TMP/o3.mp4" >"$TMP/log3" 2>&1; then
  bad "--blur 2 was accepted"
else
  grep -qi "ghost" "$TMP/log3" && ok "--blur 2 refused with the ghosting reason" || bad "--blur 2 refused without a reason"
  [ -d "$TMP/f3" ] && ok "frames kept after a refusal" || bad "frames deleted after a refusal"
fi

# 4. Eight-sample blur: 80 frames captured at 80 fps become 10 frames at 10 fps.
frames "$TMP/f4" 80 80
if sh "$RENDER" --frames "$TMP/f4" --fps 10 --blur 8 --audio "$TMP/a.wav" --out "$TMP/o4.mp4" >"$TMP/log4" 2>&1; then
  n=$(ffprobe -v error -count_packets -select_streams v:0 -show_entries stream=nb_read_packets -of default=nw=1:nk=1 "$TMP/o4.mp4")
  [ "$n" = "10" ] && ok "blur 8 gives 10 output frames" || bad "blur 8 gives $n frames, want 10"
  r=$(probe "$TMP/o4.mp4" r_frame_rate)
  [ "$r" = "10/1" ] && ok "blur output at 10 fps" || bad "blur output rate $r"
else
  bad "blur 8 failed: $(cat "$TMP/log4")"
fi

# 5. A missing frame in the sequence fails before encoding and keeps the frames.
frames "$TMP/f5" 12 30
rm "$TMP/f5/f_00005.png"
if sh "$RENDER" --frames "$TMP/f5" --fps 30 --audio "$TMP/a.wav" --out "$TMP/o5.mp4" >"$TMP/log5" 2>&1; then
  bad "a gap in the frames was accepted"
else
  grep -qi "missing" "$TMP/log5" && ok "gap reported as missing frames" || bad "gap failed without saying why: $(cat "$TMP/log5")"
  [ ! -e "$TMP/o5.mp4" ] && ok "no output written on a gap" || bad "output written despite a gap"
fi

# 6. A blur count that does not divide the frame count fails.
frames "$TMP/f6" 20 80
sh "$RENDER" --frames "$TMP/f6" --fps 10 --blur 8 --audio "$TMP/a.wav" --out "$TMP/o6.mp4" >/dev/null 2>&1 && bad "20 frames with blur 8 accepted" || ok "frame count not divisible by blur is refused"

# 7. Missing audio fails unless --no-audio is given.
frames "$TMP/f7" 10 30
sh "$RENDER" --frames "$TMP/f7" --fps 30 --out "$TMP/o7.mp4" >/dev/null 2>&1 && bad "no audio accepted silently" || ok "no audio refused without --no-audio"
sh "$RENDER" --frames "$TMP/f7" --fps 30 --no-audio --out "$TMP/o7.mp4" >/dev/null 2>&1 && ok "--no-audio encodes picture only" || bad "--no-audio failed"

# 8. An empty or missing frames dir fails.
sh "$RENDER" --frames "$TMP/none" --fps 30 --no-audio --out "$TMP/o8.mp4" >/dev/null 2>&1 && bad "missing frames dir accepted" || ok "missing frames dir refused"

echo "$PASS passed, $FAIL failed"
[ "$FAIL" = "0" ]
