"""Write a 6 second score for the hello film, Python standard library only.

120 BPM in C major: a soft kick on every beat, a pad chord, and a bell on beat 7 (3.0 s),
where the card lands. Usage: python3 -I make_score.py out.wav
"""
import math
import struct
import sys
import wave

RATE = 44100
BPM = 120
LEN = 6.0
BEAT = 60 / BPM


def render():
    n = int(RATE * LEN)
    buf = [0.0] * n
    pad = [261.63, 329.63, 392.00]  # C4, E4, G4
    for i in range(n):
        t = i / RATE
        env = min(1.0, t / 0.8) * min(1.0, (LEN - t) / 0.8)
        buf[i] += 0.06 * env * sum(math.sin(2 * math.pi * f * t) for f in pad)
    for b in range(int(LEN / BEAT)):
        start = int(b * BEAT * RATE)
        for j in range(int(0.25 * RATE)):
            if start + j >= n:
                break
            tt = j / RATE
            f = 110 * math.exp(-tt * 18) + 45
            buf[start + j] += 0.5 * math.exp(-tt * 14) * math.sin(2 * math.pi * f * tt)
    bell = int(3.0 * RATE)
    for j in range(int(1.5 * RATE)):
        if bell + j >= n:
            break
        tt = j / RATE
        buf[bell + j] += 0.18 * math.exp(-tt * 3) * (math.sin(2 * math.pi * 1046.5 * tt) + 0.4 * math.sin(2 * math.pi * 1568 * tt))
    return buf


def main():
    if len(sys.argv) != 2:
        sys.exit('usage: python3 -I make_score.py out.wav')
    buf = render()
    # Soft-limit with tanh so the master sits near -14 LUFS with true peak under -1 dBTP.
    peak = max(abs(x) for x in buf) or 1.0
    buf = [0.86 * math.tanh(1.5 * x / peak) for x in buf]
    scale = 1.0
    with wave.open(sys.argv[1], 'wb') as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(RATE)
        frames = bytearray()
        for x in buf:
            v = int(max(-1.0, min(1.0, x * scale)) * 32767)
            frames += struct.pack('<hh', v, v)
        w.writeframes(bytes(frames))
    print(f'wrote {sys.argv[1]}: {LEN} s, {BPM} BPM, 44.1 kHz stereo')


if __name__ == '__main__':
    main()
