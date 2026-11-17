#!/usr/bin/env bash
# Start one Surflog dev server and wait until the signed-out landing is usable.
# Does not kill whatever already owns the port. Writes state under run/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
STATE="$ROOT/.cursor/skills/verify-surflog/run"
PORT="${PORT:-3000}"
HOST="127.0.0.1"
BASE="http://${HOST}:${PORT}"

cd "$ROOT"

if [[ ! -x node_modules/.bin/next && ! -d node_modules/next ]]; then
  echo "launch: node_modules is missing. From the repo root run: npm ci" >&2
  exit 1
fi

python3 - "$ROOT/.env.local" <<'PY'
import os, secrets, sys
path = sys.argv[1]
lines = []
if os.path.exists(path):
    with open(path) as f:
        lines = f.read().splitlines()

def value_of(key):
    for line in lines:
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        if k.strip() == key:
            return v.strip().strip('"').strip("'")
    return None

if value_of("AUTH_SECRET"):
    sys.exit(0)

secret = secrets.token_urlsafe(33)
block = [
    "# Local Auth.js signing secret minted by verify-surflog/scripts/launch.sh.",
    "# Signs the session cookie only. Not a Google client secret and not a",
    "# Supabase key. This file is gitignored (.env*.local).",
    f"AUTH_SECRET={secret}",
]
if lines and lines[-1].strip():
    lines.append("")
lines.extend(block)
with open(path, "w") as f:
    f.write("\n".join(lines) + "\n")
os.chmod(path, 0o600)
print("launch: wrote AUTH_SECRET into .env.local (cookie signing secret only; value not printed)")
PY

mkdir -p "$STATE"

ready() {
  local body
  body="$(curl -fsS --max-time 5 "$BASE/" 2>/dev/null || true)"
  [[ "$body" == *"Log it easy. Surf it better."* ]]
}

# Pids with a TCP listen socket on $1. ss when it can see them, else /proc/net/tcp.
listener_pids() {
  local port="$1" out
  if command -v ss >/dev/null 2>&1; then
    out="$(ss -ltnp "sport = :$port" 2>/dev/null | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' | sort -u || true)"
    if [[ -n "$out" ]]; then
      printf '%s\n' "$out"
      return 0
    fi
  fi
  python3 - "$port" <<'PY'
import glob, os, sys
port = f"{int(sys.argv[1]):04X}"
inodes = set()
for name in ("/proc/net/tcp", "/proc/net/tcp6"):
    try:
        lines = open(name)
    except FileNotFoundError:
        continue
    next(lines, None)
    for line in lines:
        parts = line.split()
        if len(parts) < 10 or parts[3] != "0A":
            continue
        if parts[1].rsplit(":", 1)[-1] == port:
            inodes.add(parts[9])
if not inodes:
    sys.exit(0)
pids = set()
for fd in glob.glob("/proc/[0-9]*/fd/*"):
    try:
        target = os.readlink(fd)
    except OSError:
        continue
    if target.startswith("socket:[") and target[8:-1] in inodes:
        pids.add(fd.split("/")[2])
print("\n".join(sorted(pids, key=int)))
PY
}

if [[ -f "$STATE/pid" ]]; then
  old="$(cat "$STATE/pid")"
  if [[ -n "$old" && -d "/proc/$old" ]]; then
    cmd="$(tr '\0' ' ' < "/proc/$old/cmdline" || true)"
    if [[ "$cmd" == *npm* || "$cmd" == *next* ]]; then
      echo "launch: dev server already running pid $old"
      echo "launch: waiting until $BASE/ renders the landing"
      for _ in $(seq 1 90); do
        if ready; then
          echo "$PORT" > "$STATE/port"
          echo "launch: ready $BASE/"
          exit 0
        fi
        sleep 2
      done
      echo "launch: pid $old is ours but $BASE/ never rendered the landing. See $STATE/dev.log" >&2
      exit 1
    fi
  fi
  rm -f "$STATE/pid"
fi

mapfile -t busy < <(listener_pids "$PORT")
if (( ${#busy[@]} > 0 )); then
  echo "launch: port $PORT is already in use by pid(s): ${busy[*]}. Refusing to kill them." >&2
  echo "launch: stop that process yourself, or re-run with a free PORT=." >&2
  exit 1
fi

echo "launch: starting npm run dev on ${HOST}:${PORT}"
# python setsid+exec so $! is the session leader (npm) and cleanup can kill the group.
python3 -c 'import os,sys; os.setsid(); os.execvp("npm", ["npm","run","dev","--","--hostname",sys.argv[1],"--port",sys.argv[2]])' \
  "$HOST" "$PORT" >"$STATE/dev.log" 2>&1 &
echo $! > "$STATE/pid"
echo "$PORT" > "$STATE/port"
echo "launch: pid $(cat "$STATE/pid"), log $STATE/dev.log"

for _ in $(seq 1 90); do
  if ! kill -0 "$(cat "$STATE/pid")" 2>/dev/null; then
    echo "launch: dev server exited. Tail of $STATE/dev.log:" >&2
    tail -n 80 "$STATE/dev.log" >&2 || true
    exit 1
  fi
  if ready; then
    echo "launch: ready $BASE/"
    exit 0
  fi
  sleep 2
done

echo "launch: timed out waiting for the landing hero at $BASE/. Tail of $STATE/dev.log:" >&2
tail -n 80 "$STATE/dev.log" >&2 || true
exit 1
