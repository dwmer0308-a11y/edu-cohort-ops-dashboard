#!/bin/zsh
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON="/Users/zhangliang/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"

if [[ ! -x "$PYTHON" ]]; then
  PYTHON="$(command -v python3)"
fi

cd "$PROJECT_DIR"
export HOST="${HOST:-0.0.0.0}"
export PORT="${PORT:-8765}"
exec "$PYTHON" server.py
