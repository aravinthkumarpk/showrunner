#!/bin/sh
# Check that this machine can run showrunner, and say exactly what to install if not.
# Usage: sh scripts/doctor.sh            (check only)
#        sh scripts/doctor.sh --install  (also link this folder to ~/.claude/skills/showrunner)
# Exit 0 when every required tool is present, 1 otherwise. No network calls, no installs.
set -u
HERE=$(cd "$(dirname "$0")/.." && pwd)
bad=0
ok()   { printf '  ok    %s\n' "$1"; }
miss() { printf '  MISS  %s\n        fix: %s\n' "$1" "$2"; bad=1; }

echo "showrunner doctor"

if command -v node >/dev/null 2>&1; then
  major=$(node -p 'process.versions.node.split(".")[0]')
  if [ "$major" -ge 22 ]; then ok "node $(node --version)"; else miss "node $(node --version) is too old (need 22+)" "install Node 22 or later from https://nodejs.org"; fi
else miss "node" "install Node 22 or later from https://nodejs.org"; fi

if command -v python3 >/dev/null 2>&1; then ok "python3 $(python3 -c 'import platform; print(platform.python_version())')"
else miss "python3" "install Python 3.10 or later (macOS: brew install python)"; fi

for t in ffmpeg ffprobe; do
  if command -v "$t" >/dev/null 2>&1; then ok "$t"; else miss "$t" "macOS: brew install ffmpeg. Debian or Ubuntu: sudo apt install ffmpeg"; fi
done

chrome=$(node -e "import('$HERE/scripts/lib/chrome.mjs').then(m => console.log(m.findChrome() || ''))" 2>/dev/null)
if [ -n "$chrome" ]; then ok "chrome $chrome"
else miss "Google Chrome" "install Google Chrome, or set CHROME to a Chrome or chrome-headless-shell binary"; fi

skills="$HOME/.claude/skills/showrunner"
if [ -e "$skills" ]; then ok "skill installed at $skills"
elif [ "${1:-}" = "--install" ]; then
  mkdir -p "$HOME/.claude/skills" && ln -s "$HERE" "$skills" && ok "linked $skills -> $HERE"
else printf '  note  skill not installed. Run: sh scripts/doctor.sh --install\n'; fi

echo "No API keys or paid services are needed for a film built in code."
if [ "$bad" -eq 0 ]; then echo "PASS: ready. Next: sh examples/hello-film/run.sh"; else echo "FAIL: install what is marked MISS, then run this again."; fi
exit "$bad"
