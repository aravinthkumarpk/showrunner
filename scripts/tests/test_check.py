"""Tests for check.py, the measured gates on a finished film. Fixtures are made with ffmpeg.

Run: python3 -m unittest discover -s scripts/tests -p 'test_*.py'
"""
import os
import shutil
import subprocess
import sys
import tempfile
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
SCRIPT = os.path.join(os.path.dirname(HERE), 'check.py')
# A 1 kHz mono sine at amplitude A measures -3.01 + 20 log10(A) LUFS. A = 0.2818 gives -14 LUFS.
A14 = 0.2818


def ffmpeg(*args):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', *args], check=True)


def film(path, video_src, dur, amp=A14, size='320x240', fps=30):
    ffmpeg('-f', 'lavfi', '-i', f'{video_src}=size={size}:rate={fps}:duration={dur}',
           '-f', 'lavfi', '-i', f"aevalsrc='{amp}*sin(2*PI*1000*t)':s=48000:d={dur}",
           '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', path)


def run(*args):
    return subprocess.run([sys.executable, '-I', SCRIPT, *args], capture_output=True, text=True)


def gate_line(out, name):
    for line in out.splitlines():
        if line.split()[:2] and line.split()[1] == name:
            return line
    raise AssertionError(f'no line for gate {name} in:\n{out}')


@unittest.skipUnless(shutil.which('ffmpeg') and shutil.which('ffprobe'), 'ffmpeg and ffprobe are needed')
class CheckTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp()
        cls.good = os.path.join(cls.tmp, 'good.mp4')
        film(cls.good, 'testsrc2', 4)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp)

    def test_good_film_passes_every_gate(self):
        r = run(self.good, '--duration', '4', '--size', '320x240', '--fps', '30')
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        for name in ['duration', 'resolution', 'fps', 'frames', 'audio', 'loudness', 'true_peak', 'black', 'freeze']:
            self.assertTrue(gate_line(r.stdout, name).startswith('PASS'), r.stdout)

    def test_wrong_size_fails_and_exits_nonzero(self):
        r = run(self.good, '--duration', '4', '--size', '1920x1080', '--fps', '30')
        self.assertEqual(r.returncode, 1)
        self.assertTrue(gate_line(r.stdout, 'resolution').startswith('FAIL'))

    def test_wrong_duration_fails(self):
        r = run(self.good, '--duration', '6', '--size', '320x240', '--fps', '30')
        self.assertEqual(r.returncode, 1)
        self.assertTrue(gate_line(r.stdout, 'duration').startswith('FAIL'))
        self.assertTrue(gate_line(r.stdout, 'frames').startswith('FAIL'))

    def test_loud_file_fails_loudness_and_true_peak(self):
        loud = os.path.join(self.tmp, 'loud.mp4')
        film(loud, 'testsrc2', 3, amp=0.99)
        r = run(loud, '--duration', '3', '--size', '320x240', '--fps', '30')
        self.assertEqual(r.returncode, 1)
        self.assertTrue(gate_line(r.stdout, 'loudness').startswith('FAIL'))
        self.assertTrue(gate_line(r.stdout, 'true_peak').startswith('FAIL'))

    def test_quiet_file_fails_loudness(self):
        quiet = os.path.join(self.tmp, 'quiet.mp4')
        film(quiet, 'testsrc2', 3, amp=0.02)
        r = run(quiet)
        self.assertTrue(gate_line(r.stdout, 'loudness').startswith('FAIL'))

    def test_black_and_frozen_frames_are_caught(self):
        black = os.path.join(self.tmp, 'black.mp4')
        ffmpeg('-f', 'lavfi', '-i', 'color=c=black:size=320x240:rate=30:duration=4',
               '-f', 'lavfi', '-i', f"aevalsrc='{A14}*sin(2*PI*1000*t)':s=48000:d=4",
               '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', black)
        r = run(black, '--max-freeze', '3')
        self.assertEqual(r.returncode, 1)
        self.assertTrue(gate_line(r.stdout, 'black').startswith('FAIL'))
        self.assertTrue(gate_line(r.stdout, 'freeze').startswith('FAIL'))

    def test_allowed_black_range_passes(self):
        tail = os.path.join(self.tmp, 'tail.mp4')
        ffmpeg('-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=30:duration=3',
               '-f', 'lavfi', '-i', 'color=c=black:size=320x240:rate=30:duration=1',
               '-f', 'lavfi', '-i', f"aevalsrc='{A14}*sin(2*PI*1000*t)':s=48000:d=4",
               '-filter_complex', '[0:v][1:v]concat=n=2:v=1:a=0[v]', '-map', '[v]', '-map', '2:a',
               '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', tail)
        self.assertEqual(run(tail).returncode, 1)
        r = run(tail, '--black-ok', '2.9-4.1')
        self.assertTrue(gate_line(r.stdout, 'black').startswith('PASS'), r.stdout)

    def test_missing_expectations_are_skipped_not_passed(self):
        r = run(self.good)
        self.assertEqual(r.returncode, 0)
        self.assertTrue(gate_line(r.stdout, 'resolution').startswith('SKIP'))
        self.assertIn('skipped is not passed', r.stdout.lower())

    def test_strict_turns_skips_into_failure(self):
        r = run(self.good, '--strict')
        self.assertEqual(r.returncode, 2)

    def test_sync_gate_checks_cuts_against_the_grid(self):
        cut = os.path.join(self.tmp, 'cut.mp4')
        ffmpeg('-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=30:duration=1',
               '-f', 'lavfi', '-i', 'color=c=red:size=320x240:rate=30:duration=1',
               '-f', 'lavfi', '-i', 'mandelbrot=size=320x240:rate=30', '-f', 'lavfi', '-i', f"aevalsrc='{A14}*sin(2*PI*1000*t)':s=48000:d=3",
               '-filter_complex', '[2:v]trim=duration=1,setpts=PTS-STARTPTS[m];[0:v][1:v][m]concat=n=3:v=1:a=0[v]',
               '-map', '[v]', '-map', '3:a', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', cut)
        on = os.path.join(self.tmp, 'on.json')
        off = os.path.join(self.tmp, 'off.json')
        for path, text in ((on, '{"status": "ok", "beats": [0, 0.5, 1.0, 1.5, 2.0, 2.5]}'), (off, '{"status": "ok", "beats": [0.2, 0.9, 1.6, 2.3]}')):
            with open(path, 'w') as f:
                f.write(text)
        self.assertTrue(gate_line(run(cut, '--grid', on).stdout, 'sync').startswith('PASS'))
        r = run(cut, '--grid', off)
        self.assertTrue(gate_line(r.stdout, 'sync').startswith('FAIL'), r.stdout)
        self.assertEqual(r.returncode, 1)

    def test_no_audio_fails(self):
        mute = os.path.join(self.tmp, 'mute.mp4')
        ffmpeg('-f', 'lavfi', '-i', 'testsrc2=size=320x240:rate=30:duration=2', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', mute)
        r = run(mute)
        self.assertEqual(r.returncode, 1)
        self.assertTrue(gate_line(r.stdout, 'audio').startswith('FAIL'))

    def test_missing_file_fails_loudly(self):
        r = run(os.path.join(self.tmp, 'none.mp4'))
        self.assertNotEqual(r.returncode, 0)
        self.assertIn('not found', r.stderr.lower())


if __name__ == '__main__':
    unittest.main()
