#!/usr/bin/env bash
# Stop the dev server and the Chrome this skill started, by the pids we recorded.
# Never kills by process name. Does not delete evidence/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"
STATE="$ROOT/.cursor/skills/verify-surflog/run"

stop_group() {
  local file="$1" expect="$2"
  [[ -f "$file" ]] || { echo "cleanup: no $file"; return 0; }
  local pid
  pid="$(cat "$file")"
  rm -f "$file"
  if [[ -z "$pid" || ! -d "/proc/$pid" ]]; then
    echo "cleanup: pid ${pid:-empty} from $(basename "$file") is already gone"
    return 0
  fi
  local cmd
  cmd="$(tr '\0' ' ' < "/proc/$pid/cmdline" || true)"
  if [[ "$cmd" != *"$expect"* ]]; then
    echo "cleanup: refusing to kill pid $pid; cmdline does not contain '$expect': $cmd" >&2
    exit 1
  fi
  echo "cleanup: stopping pid $pid ($expect)"
  kill -TERM -- -"$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  local i
  for i in $(seq 1 20); do
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.5
  done
  if kill -0 "$pid" 2>/dev/null; then
    echo "cleanup: pid $pid still alive, sending SIGKILL to the group"
    kill -KILL -- -"$pid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
  fi
  if kill -0 "$pid" 2>/dev/null; then
    echo "cleanup: pid $pid did not die" >&2
    exit 1
  fi
  echo "cleanup: pid $pid stopped"
}

stop_group "$STATE/pid" "npm"
stop_group "$STATE/chrome.pid" "chrome"

# Chrome profile and the dev log are run state, not evidence.
rm -rf "$STATE/chrome-profile"
rm -f "$STATE/port" "$STATE/chrome.port" "$STATE/chrome.log"

echo "cleanup: done. Evidence under .cursor/skills/verify-surflog/evidence/ was left in place."
