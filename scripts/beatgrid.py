#!/usr/bin/env python3
"""Measure a track's beat grid from a WAV (or any file ffmpeg can read). Python standard library only.

Method: ffmpeg decodes to mono 16-bit PCM at 22.05 kHz. Energy per 11.6 ms hop is log-compressed,
and its rise from hop to hop (energy flux) is the onset curve. Autocorrelation of that curve, weighted
toward 120 BPM, picks the tempo. A comb fit then refines tempo and phase: the grid that puts the most
flux on its beats. Onsets are flux peaks above a local threshold.

Confidence is contrast (flux on beats against the track's mean flux) times hit ratio (share of grid beats that land on
a measured onset). Below the threshold the script says so and writes no beats, because a guessed
grid is worse than none: every cut and sound hit in the film is placed on it.

Usage:
  python3 -I beatgrid.py score.wav --out grid.json
  python3 -I beatgrid.py track.mp3 --bpm-min 80 --bpm-max 160 --out grid.json
  python3 -I beatgrid.py track.wav --accept-low      # keep the best guess, labelled as a guess
Exit codes: 0 ok, 1 error, 3 low confidence (JSON still written, bpm null, beats empty).
"""
import argparse
import json
import math
import os
import shutil
import subprocess
import sys
from array import array

SR = 22050
HOP = 256
HOP_S = HOP / SR
MIN_DURATION = 4.0
THRESHOLD = 0.35


def die(msg):
    sys.stderr.write(f'ERROR: {msg}\n')
    sys.exit(1)


def decode(path):
    if not os.path.isfile(path):
        die(f'audio file not found: {path}')
    if not shutil.which('ffmpeg'):
        die('ffmpeg is not installed (brew install ffmpeg)')
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 's16le', '-'],
                       capture_output=True)
    if r.returncode != 0:
        die(f'ffmpeg could not decode {path}: {r.stderr.decode(errors="ignore").strip()}')
    pcm = array('h')
    pcm.frombytes(r.stdout[: len(r.stdout) // 2 * 2])
    if sys.byteorder == 'big':
        pcm.byteswap()
    return pcm


def novelty(pcm):
    """Log-compressed energy per hop, then its positive rise: the onset curve."""
    n = len(pcm) // HOP
    scale = 1.0 / (32768.0 * 32768.0 * HOP)
    le = []
    for k in range(n):
        seg = pcm[k * HOP:(k + 1) * HOP]
        e = sum(x * x for x in seg) * scale
        le.append(math.log1p(1000.0 * e))
    flux = [max(0.0, le[0])] + [max(0.0, le[k] - le[k - 1]) for k in range(1, n)]
    return flux


def onsets(flux):
    """Flux peaks above a local mean plus 1.5 standard deviations, at least 50 ms apart."""
    n = len(flux)
    w = int(0.25 / HOP_S)
    top = max(flux) if flux else 0.0
    found = []
    for k in range(n):
        lo, hi = max(0, k - w), min(n, k + w + 1)
        win = flux[lo:hi]
        mean = sum(win) / len(win)
        sd = math.sqrt(sum((v - mean) ** 2 for v in win) / len(win))
        left = flux[k - 1] if k > 0 else 0.0
        right = flux[k + 1] if k + 1 < n else 0.0
        if flux[k] > left and flux[k] >= right and flux[k] > mean + 1.5 * sd and flux[k] > 0.1 * top:
            if not found or k - found[-1] >= int(0.05 / HOP_S):
                found.append(k)
    return found


def prior(bpm):
    """A log-normal preference centred on 120 BPM, about one octave wide (tempo resonance).
    It breaks ties between related tempos (80, 120 and 160 all fit a track with steady eighths)."""
    return math.exp(-0.5 * (math.log2(bpm / 120.0) / 1.0) ** 2)


def acf_tempo(flux, bpm_min, bpm_max):
    """Tempo candidate: the autocorrelation peak of the onset curve, weighted by the prior."""
    n = len(flux)
    mean = sum(flux) / n
    z = [v - mean for v in flux]
    energy = sum(v * v for v in z) or 1.0
    lo = int(60.0 / bpm_max / HOP_S) - 1
    hi = int(math.ceil(60.0 / bpm_min / HOP_S)) + 1
    r = {L: sum(z[i] * z[i + L] for i in range(n - L)) / energy for L in range(max(1, lo), min(n - 1, hi + 1))}

    def at(L):
        a = int(L)
        f = L - a
        return (1 - f) * r.get(a, 0.0) + f * r.get(a + 1, 0.0)

    best = None
    bpm = bpm_min
    while bpm <= bpm_max + 1e-9:
        score = at(60.0 / bpm / HOP_S) * prior(bpm)
        if best is None or score > best[0]:
            best = (score, bpm)
        bpm += 0.25
    return best[1]


def comb(flux, bpm):
    """Best phase for this tempo: the offset that puts the most onset flux on the beats."""
    n = len(flux)
    period = 60.0 / bpm / HOP_S
    best = (-1.0, 0.0)
    for ph in range(int(period)):
        total = 0.0
        count = 0
        t = float(ph)
        while t < n - 0.5:
            total += flux[int(round(t))]
            count += 1
            t += period
        if count and total / count > best[0]:
            best = (total / count, float(ph))
    return best


def fit(flux, bpm_min, bpm_max):
    """Coarse tempo from the autocorrelation, then fine tempo and phase from the comb, within 1.5 BPM."""
    cand = acf_tempo(flux, bpm_min, bpm_max)
    best = None
    b = max(bpm_min, cand - 1.5)
    while b <= min(bpm_max, cand + 1.5) + 1e-9:
        on, ph = comb(flux, b)
        if best is None or on > best[0] + 1e-12:
            best = (on, b, ph)
        b += 0.05
    return best


def main():
    ap = argparse.ArgumentParser(description='Measure a beat grid from audio (stdlib only).')
    ap.add_argument('audio')
    ap.add_argument('--out', help='write the JSON grid here (default: stdout)')
    ap.add_argument('--bpm-min', type=float, default=70.0)
    ap.add_argument('--bpm-max', type=float, default=180.0)
    ap.add_argument('--accept-low', action='store_true', help='keep the best guess when confidence is low, labelled as a guess')
    a = ap.parse_args()
    if not 20 <= a.bpm_min < a.bpm_max <= 300:
        die('--bpm-min and --bpm-max must satisfy 20 <= min < max <= 300')

    pcm = decode(a.audio)
    duration = len(pcm) / SR
    if duration < MIN_DURATION:
        die(f'audio is too short to measure a grid: {duration:.2f} s (need {MIN_DURATION:.0f} s or more)')
    flux = novelty(pcm)
    peaks = onsets(flux)
    on, bpm, ph = fit(flux, a.bpm_min, a.bpm_max)
    off = sum(flux) / len(flux)
    period = 60.0 / bpm / HOP_S
    beat_frames = []
    t = ph
    while t < len(flux):
        beat_frames.append(t)
        t += period
    contrast = max(0.0, (on - off) / on) if on > 0 else 0.0
    peak_set = set(peaks)
    hits = sum(1 for bf in beat_frames if any(int(round(bf)) + d in peak_set for d in (-2, -1, 0, 1, 2)))
    hit_ratio = hits / len(beat_frames) if beat_frames else 0.0
    confidence = round(contrast * hit_ratio, 3)
    low = confidence < THRESHOLD or len(peaks) < 4

    beats = [round(bf * HOP_S, 3) for bf in beat_frames]
    out = {
        'source': os.path.abspath(a.audio),
        'duration_s': round(duration, 3),
        'method': 'energy flux; autocorrelation with a 120 BPM prior for tempo; comb fit for fine tempo and phase (stdlib)',
        'hop_s': round(HOP_S, 5),
        'confidence': confidence,
        'contrast': round(contrast, 3),
        'hit_ratio': round(hit_ratio, 3),
        'threshold': THRESHOLD,
        'onsets': [round(k * HOP_S, 3) for k in peaks],
        'meter_note': 'Bars assume 4/4 with the downbeat on the first detected beat. Check by ear: the true downbeat may be beat 2, 3 or 4, and the grid can sit on the hats, not the kick.',
    }
    if low and not a.accept_low:
        out.update({'status': 'low_confidence', 'bpm': None, 'period_s': None, 'beats': [], 'bars': [],
                    'message': f'Low confidence ({confidence} < {THRESHOLD}): no steady beat found, so no grid is given. Pick cut points by ear, mark them by hand, or pass --accept-low to keep a labelled guess.'})
    else:
        out.update({'status': 'low_confidence_accepted' if low else 'ok', 'bpm': round(bpm, 2), 'period_s': round(60.0 / bpm, 4),
                    'beats': beats, 'bars': [{'bar': i // 4 + 1, 't': beats[i]} for i in range(0, len(beats), 4)]})
        if low:
            out['message'] = f'Low confidence ({confidence}); this grid is a guess. Do not cut to it until it is checked by ear.'
    text = json.dumps(out, indent=2)
    if a.out:
        with open(a.out, 'w') as f:
            f.write(text + '\n')
    else:
        print(text)
    summary = f"bpm {out['bpm']}, confidence {confidence}, {len(out['beats'])} beats, {len(out['onsets'])} onsets"
    if low and not a.accept_low:
        sys.stderr.write(f"LOW CONFIDENCE: {out['message']}\n")
        sys.exit(3)
    sys.stderr.write(('WARNING low confidence guess: ' if low else 'ok: ') + summary + '\n')


if __name__ == '__main__':
    main()
