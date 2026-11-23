"""Tests for beatgrid.py. Fixtures are made with ffmpeg at test time.

Run: python3 -m unittest discover -s scripts/tests -p 'test_*.py'
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(os.path.dirname(HERE), 'beatgrid.py')


def ffmpeg(*args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *args], check=True)


def clicks(path, bpm, dur, offset=0.0):
    """A click track: a 10 ms 1 kHz burst on every beat, starting at offset."""
    period = 60.0 / bpm
    expr = f"if(gte(t,{offset})*lt(mod(t-{offset},{period}),0.01),0.8*sin(2*PI*1000*t),0)"
    ffmpeg('-f', 'lavfi', '-i', f"aevalsrc='{expr}':s=44100:d={dur}", path)


def run(*args):
    return subprocess.run([sys.executable, '-I', SCRIPT, *args], capture_output=True, text=True)


@unittest.skipUnless(shutil.which('ffmpeg'), 'ffmpeg is not installed, so these tests cannot run')
class BeatgridTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()

    def tearDown(self):
        shutil.rmtree(self.tmp)

    def grid(self, wav, *extra):
        out = os.path.join(self.tmp, 'grid.json')
        r = run(wav, '--out', out, *extra)
        if not os.path.exists(out):
            return r, None
        with open(out) as f:
            return r, json.load(f)

    def test_click_track_120_bpm(self):
        wav = os.path.join(self.tmp, 'c120.wav')
        clicks(wav, 120, 12)
        r, g = self.grid(wav)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(g['status'], 'ok')
        self.assertAlmostEqual(g['bpm'], 120.0, delta=1.0)
        self.assertGreater(g['confidence'], 0.5)
        self.assertLess(abs(g['beats'][0] - 0.0), 0.03)
        gaps = [b - a for a, b in zip(g['beats'], g['beats'][1:])]
        for gap in gaps:
            self.assertAlmostEqual(gap, 0.5, delta=0.03)
        self.assertGreaterEqual(len(g['beats']), 22)

    def test_offset_and_other_tempo(self):
        wav = os.path.join(self.tmp, 'c96.wav')
        clicks(wav, 96, 15, offset=0.3)
        r, g = self.grid(wav)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertAlmostEqual(g['bpm'], 96.0, delta=1.0)
        self.assertLess(abs(g['beats'][0] - 0.3), 0.03)

    def test_hats_on_the_eighths_do_not_fool_the_tempo(self):
        # Regression: a comb with an off-beat penalty read a 120 BPM synthesised score as 80 BPM,
        # because real music has hats half-way between the beats.
        wav = os.path.join(self.tmp, 'groove.wav')
        kick = "if(lt(mod(t,0.5),0.08),0.9*sin(2*PI*60*t)*exp(-30*mod(t,0.5)),0)"
        hat = "if(lt(mod(t,0.25),0.02),0.35*sin(2*PI*7000*t),0)"
        ffmpeg('-f', 'lavfi', '-i', f"aevalsrc='{kick}+{hat}':s=44100:d=12", wav)
        r, g = self.grid(wav)
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertAlmostEqual(g['bpm'], 120.0, delta=1.0)
        self.assertLess(abs(g['beats'][0]), 0.03)

    def test_bars_assume_four_four_and_say_so(self):
        wav = os.path.join(self.tmp, 'c120.wav')
        clicks(wav, 120, 10)
        _, g = self.grid(wav)
        self.assertIn('4/4', g['meter_note'])
        self.assertAlmostEqual(g['bars'][1]['t'] - g['bars'][0]['t'], 2.0, delta=0.05)

    def test_onsets_are_measured(self):
        wav = os.path.join(self.tmp, 'c120.wav')
        clicks(wav, 120, 6)
        _, g = self.grid(wav)
        self.assertGreaterEqual(len(g['onsets']), 10)
        self.assertLess(abs(g['onsets'][1] - 0.5), 0.03)

    def test_steady_tone_is_low_confidence_not_a_guess(self):
        wav = os.path.join(self.tmp, 'sine.wav')
        ffmpeg('-f', 'lavfi', '-i', 'sine=frequency=440:duration=8', wav)
        r, g = self.grid(wav)
        self.assertEqual(r.returncode, 3, r.stderr)
        self.assertEqual(g['status'], 'low_confidence')
        self.assertIsNone(g['bpm'])
        self.assertEqual(g['beats'], [])
        self.assertIn('low confidence', r.stderr.lower())

    def test_noise_is_low_confidence(self):
        wav = os.path.join(self.tmp, 'noise.wav')
        ffmpeg('-f', 'lavfi', '-i', 'anoisesrc=d=8:c=white:a=0.5:seed=3', wav)
        r, g = self.grid(wav)
        self.assertEqual(r.returncode, 3, r.stderr)
        self.assertIsNone(g['bpm'])

    def test_accept_low_keeps_the_best_guess_and_labels_it(self):
        wav = os.path.join(self.tmp, 'noise.wav')
        ffmpeg('-f', 'lavfi', '-i', 'anoisesrc=d=8:c=white:a=0.5:seed=3', wav)
        r, g = self.grid(wav, '--accept-low')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(g['status'], 'low_confidence_accepted')
        self.assertIsNotNone(g['bpm'])

    def test_missing_file_fails_loudly(self):
        r = run(os.path.join(self.tmp, 'nope.wav'))
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('not found', r.stderr.lower())

    def test_too_short_fails_loudly(self):
        wav = os.path.join(self.tmp, 'short.wav')
        clicks(wav, 120, 1.5)
        r = run(wav)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('too short', r.stderr.lower())


if __name__ == '__main__':
    unittest.main()
