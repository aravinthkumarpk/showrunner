#!/usr/bin/env python3
"""Measured gates on a finished film file. Python standard library plus ffmpeg and ffprobe.

Prints one line per gate: PASS, FAIL or SKIP, then a summary. Exit 1 on any FAIL. A gate with no
expected value is SKIPPED, and skipped is not passed: give --duration, --size and --fps for a
real check, or use --strict to fail on any skip (exit 2).

Usage:
  python3 -I check.py film.mp4 --duration 20 --size 1920x1080 --fps 30
  python3 -I check.py film-4k.mp4 --duration 20 --size 3840x2160 --fps 60 --grid grid.json
  python3 -I check.py film.mp4 --black-ok 19.5-20.1 --max-freeze 2.5

Gates:
  duration    container length within --duration-tol (default 0.05 s) of --duration
  resolution  width x height equals --size
  fps         frame rate equals --fps
  frames      video frame count equals round(duration x fps), plus or minus 1
  audio       an audio stream exists and ends within 0.1 s of the picture
  loudness    integrated loudness within --lufs-tol (1.0) of --lufs (-14, the social-feed norm)
  true_peak   true peak at or below --tp-max (-1.0 dBTP)
  black       no black stretch of 0.1 s or more, except inside --black-ok ranges
  freeze      no fully frozen stretch of --max-freeze seconds (default 3.0) or more
  sync        with --grid: every detected hard cut lands within --sync-tol (0.04 s) of a beat or half-beat
"""
import argparse
import json
import os
import re
import shutil
import subprocess
import sys

RESULTS = []


def die(msg):
    sys.stderr.write(f'ERROR: {msg}\n')
    sys.exit(1)


def gate(status, name, detail):
    RESULTS.append(status)
    print(f'{status:<4} {name:<11} {detail}')


def ff(args):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode != 0:
        die(f'{args[0]} failed: {r.stderr.strip()[-400:]}')
    return r


def probe(path):
    r = ff(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', path])
    return json.loads(r.stdout)


def rate(s):
    n, _, d = s.partition('/')
    return float(n) / float(d or 1) if float(d or 1) else 0.0


def count_frames(path):
    r = ff(['ffprobe', '-v', 'error', '-count_packets', '-select_streams', 'v:0', '-show_entries',
            'stream=nb_read_packets', '-of', 'default=nw=1:nk=1', path])
    return int(r.stdout.strip())


def loudness(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-map', '0:a:0', '-af', 'ebur128=peak=true',
                        '-f', 'null', '-'], capture_output=True, text=True)
    summary = r.stderr[r.stderr.rfind('Summary:'):]
    i = re.search(r'I:\s+(-?[\d.]+|-inf) LUFS', summary)
    p = re.search(r'Peak:\s+(-?[\d.]+|-inf) dBFS', summary)
    if not i or not p:
        die('could not read loudness from ffmpeg ebur128 output')
    return float(i.group(1)), float(p.group(1))


def video_scan(path, max_freeze):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-map', '0:v:0', '-vf',
                        f'blackdetect=d=0.1:pix_th=0.10,freezedetect=n=-60dB:d={max_freeze}', '-f', 'null', '-'],
                       capture_output=True, text=True)
    blacks = [(float(a), float(b)) for a, b in re.findall(r'black_start:([\d.]+) black_end:([\d.]+)', r.stderr)]
    starts = [float(x) for x in re.findall(r'freeze_start: ([\d.]+)', r.stderr)]
    ends = [float(x) for x in re.findall(r'freeze_end: ([\d.]+)', r.stderr)]
    return blacks, starts, ends


def cuts(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-map', '0:v:0', '-vf',
                        "select='gt(scene,0.3)',showinfo", '-f', 'null', '-'], capture_output=True, text=True)
    return [float(x) for x in re.findall(r'pts_time:([\d.]+)', r.stderr)]


def ranges(text):
    out = []
    for part in filter(None, (text or '').split(',')):
        m = re.fullmatch(r'\s*([\d.]+)\s*-\s*([\d.]+)\s*', part)
        if not m:
            die(f'--black-ok wants ranges like 19.5-20.1,0-0.2, got "{part}"')
        out.append((float(m.group(1)), float(m.group(2))))
    return out


def main():
    ap = argparse.ArgumentParser(description='Measured gates on a finished film.')
    ap.add_argument('film')
    ap.add_argument('--duration', type=float)
    ap.add_argument('--duration-tol', type=float, default=0.05)
    ap.add_argument('--size', help='WIDTHxHEIGHT, for example 1920x1080')
    ap.add_argument('--fps', type=float)
    ap.add_argument('--lufs', type=float, default=-14.0)
    ap.add_argument('--lufs-tol', type=float, default=1.0)
    ap.add_argument('--tp-max', type=float, default=-1.0)
    ap.add_argument('--black-ok', default='')
    ap.add_argument('--max-freeze', type=float, default=3.0)
    ap.add_argument('--grid', help='beat grid JSON from beatgrid.py, for the sync gate')
    ap.add_argument('--sync-tol', type=float, default=0.04)
    ap.add_argument('--strict', action='store_true', help='exit 2 when any gate was skipped')
    a = ap.parse_args()

    for tool in ('ffmpeg', 'ffprobe'):
        if not shutil.which(tool):
            die(f'{tool} is not installed (brew install ffmpeg)')
    if not os.path.isfile(a.film):
        die(f'film not found: {a.film}')
    info = probe(a.film)
    v = next((s for s in info['streams'] if s['codec_type'] == 'video'), None)
    au = next((s for s in info['streams'] if s['codec_type'] == 'audio'), None)
    if not v:
        die(f'{a.film} has no video stream')
    dur = float(info['format'].get('duration', 0))
    vdur = float(v.get('duration', dur))
    fps = rate(v.get('avg_frame_rate') or v.get('r_frame_rate', '0/1'))
    print(f'film: {a.film}  ({v["width"]}x{v["height"]}, {fps:.3f} fps, {dur:.3f} s)')

    if a.duration is None:
        gate('SKIP', 'duration', f'{dur:.3f} s measured; no --duration given')
    else:
        ok = abs(dur - a.duration) <= a.duration_tol
        gate('PASS' if ok else 'FAIL', 'duration', f'{dur:.3f} s (want {a.duration:g} plus or minus {a.duration_tol:g})')

    got = f'{v["width"]}x{v["height"]}'
    if not a.size:
        gate('SKIP', 'resolution', f'{got} measured; no --size given')
    else:
        gate('PASS' if got == a.size.lower() else 'FAIL', 'resolution', f'{got} (want {a.size})')

    if a.fps is None:
        gate('SKIP', 'fps', f'{fps:.3f} measured; no --fps given')
    else:
        gate('PASS' if abs(fps - a.fps) < 0.01 else 'FAIL', 'fps', f'{fps:.3f} (want {a.fps:g})')

    n = count_frames(a.film)
    if a.duration is None or a.fps is None:
        gate('SKIP', 'frames', f'{n} frames counted; needs --duration and --fps')
    else:
        want = round(a.duration * a.fps)
        gate('PASS' if abs(n - want) <= 1 else 'FAIL', 'frames', f'{n} counted (want {want} plus or minus 1)')

    if not au:
        gate('FAIL', 'audio', 'no audio stream. A film is picture and sound together.')
        gate('FAIL', 'loudness', 'no audio to measure')
        gate('FAIL', 'true_peak', 'no audio to measure')
    else:
        adur = float(au.get('duration', dur))
        gap = abs(adur - vdur)
        gate('PASS' if gap <= 0.1 else 'FAIL', 'audio', f'{au["codec_name"]}, ends {gap:.3f} s from the picture (want 0.1 or less)')
        lufs, tp = loudness(a.film)
        gate('PASS' if abs(lufs - a.lufs) <= a.lufs_tol else 'FAIL', 'loudness', f'{lufs:.1f} LUFS integrated (want {a.lufs:g} plus or minus {a.lufs_tol:g})')
        gate('PASS' if tp <= a.tp_max else 'FAIL', 'true_peak', f'{tp:.1f} dBTP (want {a.tp_max:g} or lower)')

    blacks, fstarts, fends = video_scan(a.film, a.max_freeze)
    allowed = ranges(a.black_ok)
    bad = [(s, e) for s, e in blacks if not any(lo <= s and e <= hi for lo, hi in allowed)]
    gate('FAIL' if bad else 'PASS', 'black', ('black at ' + ', '.join(f'{s:.2f} to {e:.2f} s' for s, e in bad)) if bad else f'no unplanned black ({len(blacks)} allowed stretch(es))')
    frozen = [(s, fends[i] if i < len(fends) else vdur) for i, s in enumerate(fstarts)]
    gate('FAIL' if frozen else 'PASS', 'freeze', ('frozen at ' + ', '.join(f'{s:.2f} to {e:.2f} s' for s, e in frozen) + '. A hold needs something still moving.') if frozen else f'no frozen stretch of {a.max_freeze:g} s or more')

    if not a.grid:
        gate('SKIP', 'sync', 'no --grid given')
    else:
        try:
            g = json.loads(open(a.grid).read())
        except (OSError, ValueError) as e:
            die(f'cannot read grid {a.grid}: {e}')
        beats = g.get('beats') or []
        if not beats:
            gate('FAIL', 'sync', f'grid has no beats (status {g.get("status")}); measure the track again or mark beats by hand')
        else:
            marks = sorted(beats + [(x + y) / 2 for x, y in zip(beats, beats[1:])])
            found = cuts(a.film)
            off = [c for c in found if min(abs(c - m) for m in marks) > a.sync_tol]
            if not found:
                gate('PASS', 'sync', 'no hard cuts detected (moves and fades are not checked)')
            else:
                gate('FAIL' if off else 'PASS', 'sync', (f'{len(off)} of {len(found)} cuts off the grid at ' + ', '.join(f'{c:.3f} s' for c in off)) if off else f'{len(found)} cuts, all within {a.sync_tol:g} s of a beat or half-beat')

    fails, skips = RESULTS.count('FAIL'), RESULTS.count('SKIP')
    print(f'\n{RESULTS.count("PASS")} passed, {fails} failed, {skips} skipped. Skipped is not passed.')
    if fails:
        sys.exit(1)
    if skips and a.strict:
        sys.exit(2)


if __name__ == '__main__':
    main()
