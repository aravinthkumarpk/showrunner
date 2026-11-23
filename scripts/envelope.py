#!/usr/bin/env python3
"""Per-frame loudness envelope of a track, for a subtle audio-reactive treatment. Stdlib plus ffmpeg.

Decodes any file ffmpeg can read to mono 48 kHz, splits it into one window per film frame, and writes
the RMS of each window plus a 0..1 normalised copy (divided by the loudest frame). The film page loads
the JSON and samples it by time inside seek(t), so every frame stays a pure function of t:

    const i = Math.min(ENV.frames - 1, Math.floor(t * ENV.fps));
    glow.style.opacity = 0.85 + 0.15 * ENV.norm[i];   // small range: presence, never a pulse

Make the envelope at the capture fps (30 for review, 60 for the 4K master) so frame f reads value f.
Use it on brand elements (glow, card presence, background warmth), never on text size, and never as
waveform or equaliser bars. Source: brag (github.com/latent-spaces/brag, MIT), references/audio.md.

Usage:
  python3 -I envelope.py music/score.wav --fps 30 --out music/envelope-30.json
  python3 -I envelope.py music/score.wav --fps 60            # prints the JSON to stdout

Fails loudly on a missing file, a bad fps, an undecodable file, or silent audio (nothing to follow).
"""
import argparse
import json
import math
import os
import shutil
import subprocess
import sys
from array import array

RATE = 48000


def die(msg):
    sys.stderr.write(f'ERROR: {msg}\n')
    sys.exit(1)


def decode(path):
    if not shutil.which('ffmpeg'):
        die('ffmpeg is not installed (brew install ffmpeg)')
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-vn', '-ac', '1', '-ar', str(RATE), '-f', 'f32le', '-'],
                       capture_output=True)
    if r.returncode != 0:
        die(f'ffmpeg could not decode {path}: {r.stderr.decode(errors="replace").strip()[-400:]}')
    samples = array('f')
    samples.frombytes(r.stdout[: len(r.stdout) // 4 * 4])
    if sys.byteorder != 'little':
        samples.byteswap()
    if not samples:
        die(f'{path} decoded to no audio samples')
    return samples


def envelope(samples, fps):
    duration = len(samples) / RATE
    frames = round(duration * fps)
    if frames < 1:
        die(f'the audio is {duration:.3f} s long, shorter than one frame at {fps} fps')
    rms = []
    for f in range(frames):
        a = int(round(f * RATE / fps))
        b = min(len(samples), int(round((f + 1) * RATE / fps)))
        n = b - a
        rms.append(math.sqrt(sum(s * s for s in samples[a:b]) / n) if n > 0 else 0.0)
    peak = max(rms)
    if peak < 1e-5:
        die('the audio is silent (peak frame RMS under -100 dBFS), so there is nothing for picture to follow')
    return {
        'fps': fps,
        'frames': frames,
        'duration': round(duration, 4),
        'sample_rate': RATE,
        'peak_rms': round(peak, 6),
        'rms': [round(v, 6) for v in rms],
        'norm': [round(v / peak, 6) for v in rms],
    }


def main():
    ap = argparse.ArgumentParser(description='Per-frame RMS envelope of an audio file, as JSON.')
    ap.add_argument('audio', help='any file ffmpeg can decode (wav, mp3, m4a, ogg, mp4)')
    ap.add_argument('--fps', required=True, type=float, help='the film frame rate the envelope is sampled at')
    ap.add_argument('--out', help='JSON file to write; prints to stdout when left out')
    a = ap.parse_args()
    if not (math.isfinite(a.fps) and a.fps > 0):
        die(f'--fps must be a number above 0, got {a.fps}')
    if not os.path.isfile(a.audio):
        die(f'audio not found: {a.audio}')
    fps = int(a.fps) if a.fps.is_integer() else a.fps
    env = envelope(decode(a.audio), fps)
    env['source'] = os.path.basename(a.audio)
    text = json.dumps(env, separators=(',', ':'))
    if a.out:
        with open(a.out, 'w') as f:
            f.write(text)
        sys.stderr.write(f'wrote {env["frames"]} frames at {fps} fps ({env["duration"]} s) to {a.out}\n')
    else:
        print(text)


if __name__ == '__main__':
    main()
