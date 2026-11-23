"""Tests for envelope.py, the per-frame loudness envelope. Fixtures are made with ffmpeg.

Run: python3 -m unittest discover -s scripts/tests -p 'test_*.py'
"""
import json
import math
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(os.path.dirname(HERE), 'envelope.py')


def ffmpeg(*args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *args], check=True)


def run(*args):
    return subprocess.run([sys.executable, '-I', SCRIPT, *args], capture_output=True, text=True)


@unittest.skipUnless(shutil.which('ffmpeg'), 'ffmpeg is needed')
class EnvelopeTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix='env-')
        # 0.5 s of a quiet 440 Hz sine (amplitude 0.1), then 0.5 s loud (amplitude 0.8).
        self.step = os.path.join(self.tmp, 'step.wav')
        ffmpeg('-f', 'lavfi', '-i', "aevalsrc='if(lt(t,0.5),0.1,0.8)*sin(2*PI*440*t)':s=48000:d=1", self.step)

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def env(self, *extra, src=None):
        out = os.path.join(self.tmp, 'env.json')
        r = run(src or self.step, '--fps', '10', '--out', out, *extra)
        self.assertEqual(r.returncode, 0, r.stderr)
        with open(out) as f:
            return json.load(f)

    def test_one_value_per_frame(self):
        e = self.env()
        self.assertEqual(e['fps'], 10)
        self.assertEqual(e['frames'], 10)
        self.assertEqual(len(e['rms']), 10)
        self.assertEqual(len(e['norm']), 10)
        self.assertAlmostEqual(e['duration'], 1.0, places=2)

    def test_rms_follows_the_level(self):
        e = self.env()
        quiet, loud = 0.1 / math.sqrt(2), 0.8 / math.sqrt(2)
        for v in e['rms'][:5]:
            self.assertAlmostEqual(v, quiet, delta=0.01)
        for v in e['rms'][5:]:
            self.assertAlmostEqual(v, loud, delta=0.02)

    def test_norm_is_zero_to_one_with_the_peak_at_one(self):
        e = self.env()
        self.assertAlmostEqual(max(e['norm']), 1.0, places=6)
        self.assertTrue(all(0.0 <= v <= 1.0 for v in e['norm']))
        self.assertLess(e['norm'][0], 0.2)

    def test_frame_count_matches_capture_rounding(self):
        # capture.mjs makes round(DURATION x fps) frames; the envelope must match it.
        odd = os.path.join(self.tmp, 'odd.wav')
        ffmpeg('-f', 'lavfi', '-i', 'sine=frequency=440:duration=1.26', odd)
        out = os.path.join(self.tmp, 'odd.json')
        r = run(odd, '--fps', '30', '--out', out)
        self.assertEqual(r.returncode, 0, r.stderr)
        with open(out) as f:
            self.assertEqual(json.load(f)['frames'], round(1.26 * 30))

    def test_reads_compressed_stereo_audio(self):
        m4a = os.path.join(self.tmp, 'st.m4a')
        ffmpeg('-f', 'lavfi', '-i', 'sine=frequency=440:duration=1', '-ac', '2', '-c:a', 'aac', m4a)
        e = self.env(src=m4a)
        self.assertGreater(min(e['rms'][1:-1]), 0.01)

    def test_prints_to_stdout_without_out(self):
        r = run(self.step, '--fps', '10')
        self.assertEqual(r.returncode, 0, r.stderr)
        self.assertEqual(json.loads(r.stdout)['frames'], 10)

    def test_missing_file_fails_loudly(self):
        r = run(os.path.join(self.tmp, 'nope.wav'), '--fps', '30')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('nope.wav', r.stderr)

    def test_bad_fps_fails(self):
        r = run(self.step, '--fps', '0')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('fps', r.stderr)

    def test_fps_is_required(self):
        r = run(self.step)
        self.assertNotEqual(r.returncode, 0)

    def test_silent_audio_fails_instead_of_writing_zeros(self):
        silent = os.path.join(self.tmp, 'silent.wav')
        ffmpeg('-f', 'lavfi', '-i', 'anullsrc=r=48000:cl=mono', '-t', '1', silent)
        r = run(silent, '--fps', '10')
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('silent', r.stderr.lower())


if __name__ == '__main__':
    unittest.main()
