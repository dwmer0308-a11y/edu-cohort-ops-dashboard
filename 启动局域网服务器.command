#!/bin/zsh
cd "$(dirname "$0")"
PYTHON="/Users/zhangliang/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
if [[ ! -x "$PYTHON" ]]; then
  PYTHON="$(command -v python3)"
fi
HOST=0.0.0.0 PORT=8765 "$PYTHON" server.py
