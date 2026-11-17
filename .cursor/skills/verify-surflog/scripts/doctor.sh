#!/usr/bin/env bash
# Read-only check of the dev server this skill started.
# Prints a report. Optional first argument: a directory to also write doctor.txt into.
# Never POSTs, never clicks, never prints secret values.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
STATE="$ROOT/.cursor/skills/verify-surflog/run"
REPORT="${1:-}"
cd "$ROOT"
mkdir -p "$STATE"

fail=0
lines=()
note() { lines+=("$1"); }
bad() { lines+=("FAIL $1"); fail=1; }
ok() { lines+=("ok   $1"); }

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

env_set() {
  local key="$1" line val
  if [[ -n "${!key:-}" ]]; then return 0; fi
  [[ -f "$ROOT/.env.local" ]] || return 1
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" == "$key="* ]] || continue
    val="${line#"$key="}"
    val="${val%\"}"; val="${val#\"}"
    val="${val%\'}"; val="${val#\'}"
    [[ -n "$val" ]] && return 0
  done < "$ROOT/.env.local"
  return 1
}

if [[ ! -f "$STATE/pid" || ! -f "$STATE/port" ]]; then
  bad "no run/pid or run/port — launch.sh has not been run"
  PORT=3000
  pid=""
else
  pid="$(cat "$STATE/pid")"
  PORT="$(cat "$STATE/port")"
fi
BASE="http://127.0.0.1:${PORT}"

if [[ -z "${pid:-}" || ! -d "/proc/$pid" ]]; then
  bad "pid ${pid:-missing} is not running"
else
  cmd="$(tr '\0' ' ' < "/proc/$pid/cmdline" || true)"
  if [[ "$cmd" == *npm*run*dev* || "$cmd" == *next*dev* || "$cmd" == *"next dev"* || "$cmd" == *npm* ]]; then
    ok "process $pid is ours ($(echo "$cmd" | cut -c1-120))"
  else
    bad "pid $pid cmdline is not the dev server: $cmd"
  fi
fi

descendants() {
  local p="$1" c
  echo "$p"
  for c in $(ps -o pid= --ppid "$p" 2>/dev/null); do
    descendants "$c"
  done
}

if [[ -n "${pid:-}" && -d "/proc/$pid" ]]; then
  mapfile -t tree < <(descendants "$pid")
  mapfile -t listeners < <(listener_pids "$PORT")
  if (( ${#listeners[@]} == 0 )); then
    bad "nothing is listening on port $PORT"
  else
    owned=0
    for lp in "${listeners[@]}"; do
      for tp in "${tree[@]}"; do
        if [[ "$lp" == "$tp" ]]; then owned=1; fi
      done
    done
    if [[ "$owned" == 1 ]]; then
      ok "port $PORT is owned by pid $pid or a descendant (listeners: ${listeners[*]})"
    else
      bad "port $PORT listeners (${listeners[*]}) are not descendants of pid $pid"
    fi
  fi
fi

# One GET, no redirects. Retries a 500: next dev sometimes answers
# "Manifest file is empty" for a request that lands mid-compile.
fetch() {
  local path="$1" attempt code
  for attempt in 1 2 3; do
    code="$(curl -sS --max-time 20 -D "$STATE/doctor.headers" -o "$STATE/doctor.body" -w "%{http_code}" --max-redirs 0 "$BASE$path" || echo "curl-fail")"
    if [[ "$code" != "500" ]]; then
      printf '%s' "$code"
      return 0
    fi
    sleep 1
  done
  printf '%s' "$code"
}

code="$(fetch "/")"
body="$(cat "$STATE/doctor.body" 2>/dev/null || true)"
if [[ "$code" == "200" && "$body" == *"Log it easy. Surf it better."* ]]; then
  ok "GET / 200 and the signed-out hero is in the HTML"
else
  bad "GET / returned $code and did not include the landing hero"
fi

code="$(fetch "/signin")"
body="$(cat "$STATE/doctor.body" 2>/dev/null || true)"
if [[ "$code" == "200" && "$body" == *"Continue with Google"* ]]; then
  ok "GET /signin 200 with Continue with Google"
else
  bad "GET /signin returned $code without Continue with Google"
fi

code="$(fetch "/spots")"
loc="$(awk 'tolower($1)=="location:" {print $2}' "$STATE/doctor.headers" | tr -d '\r')"
if [[ "$code" == "307" || "$code" == "302" ]] && [[ "$loc" == *"/signin"* ]] && [[ "$loc" == *"callbackUrl"* ]]; then
  ok "GET /spots $code to sign-in (${loc:0:140})"
else
  bad "GET /spots expected a redirect to /signin, got $code location=${loc:-none}"
fi

code="$(fetch "/api/sessions")"
body="$(cat "$STATE/doctor.body" 2>/dev/null || true)"
if [[ "$code" == "401" && "$body" == *"unauthorized"* ]]; then
  ok "GET /api/sessions 401 unauthorized (no cookie)"
else
  bad "GET /api/sessions expected 401 unauthorized, got $code body=${body:0:120}"
fi

code="$(fetch "/dev")"
if [[ "$code" == "200" ]]; then
  ok "GET /dev 200 — this is the dev server, not a production build"
else
  bad "GET /dev returned $code (production 404s /dev; a dev server must answer 200)"
fi

code="$(fetch "/api/auth/session")"
body="$(cat "$STATE/doctor.body" 2>/dev/null || true)"
if [[ "$code" == "200" && ( "$body" == "null" || "$body" == "{}" || "$body" != *"\"id\""* ) ]]; then
  ok "GET /api/auth/session 200 with no user (signed-out is valid for unsigned surfaces)"
else
  bad "GET /api/auth/session expected a signed-out 200, got $code body=${body:0:160}"
fi

code="$(fetch "/api/health")"
body="$(cat "$STATE/doctor.body" 2>/dev/null || true)"
if env_set SUPABASE_URL && env_set SUPABASE_SECRET_KEY; then
  if [[ "$code" == "200" && "$body" == *'"ok":true'* ]]; then
    ok "GET /api/health 200 — Supabase env is set and the spots read succeeded"
  else
    bad "Supabase env is set but GET /api/health returned $code body=${body:0:120}"
  fi
else
  if [[ "$code" == "503" && "$body" == *'"ok":false'* ]]; then
    note "info database: SUPABASE_URL / SUPABASE_SECRET_KEY unset, /api/health 503 as designed"
  else
    bad "Supabase env unset but /api/health returned $code body=${body:0:120} (expected 503 {ok:false})"
  fi
fi

if env_set AUTH_GOOGLE_ID && env_set AUTH_GOOGLE_SECRET; then
  note "info google: AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are set (values not printed). OAuth can be started; a human Google login is still required to finish it."
else
  note "info google: AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET unset. Sign in redirects to accounts.google.com with no client id. Signed-in journeys cannot finish. Do not invent a backdoor."
fi

if env_set CWA_API_KEY; then
  note "info cwa: CWA_API_KEY is set (Taiwan tide on save can run)"
else
  note "info cwa: CWA_API_KEY unset. A Taiwan session can still be saved once Supabase is configured; the CWA tide tile stays empty. Open-Meteo does not need this key."
fi

if command -v cmux >/dev/null 2>&1; then
  note "info cmux: on PATH — use it for signed-in drives (that browser may already be signed in)"
else
  note "info cmux: not on PATH. Signed-in drives have no pre-authenticated browser here."
fi

rm -f "$STATE/doctor.headers" "$STATE/doctor.body"

printf '%s\n' "${lines[@]}"
if [[ -n "$REPORT" ]]; then
  mkdir -p "$REPORT"
  printf '%s\n' "${lines[@]}" > "$REPORT/doctor.txt"
  echo "doctor: wrote $REPORT/doctor.txt"
fi

if [[ "$fail" -eq 0 ]]; then
  echo "doctor: ok"
  exit 0
fi
echo "doctor: fail" >&2
exit 1
