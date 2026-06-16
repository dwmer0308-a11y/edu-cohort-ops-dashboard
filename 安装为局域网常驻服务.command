#!/bin/zsh
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_DIR="$HOME/Library/LaunchAgents"
PLIST_FILE="$PLIST_DIR/com.calligraphy.dashboard.lan.plist"
LOG_FILE="$PROJECT_DIR/lan-server.log"
ERR_FILE="$PROJECT_DIR/lan-server.err.log"
USER_ID="$(id -u)"
PYTHON="/Users/zhangliang/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3"
if [[ ! -x "$PYTHON" ]]; then
  PYTHON="$(command -v python3)"
fi

mkdir -p "$PLIST_DIR"

cat > "$PLIST_FILE" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>com.calligraphy.dashboard.lan</string>
  <key>WorkingDirectory</key>
  <string>$PROJECT_DIR</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>-lc</string>
    <string>HOST=0.0.0.0 PORT=8765 "$PROJECT_DIR/scripts/run_dashboard_server.sh"</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$LOG_FILE</string>
  <key>StandardErrorPath</key>
  <string>$ERR_FILE</string>
</dict>
</plist>
PLIST

xattr -d com.apple.provenance "$PLIST_FILE" >/dev/null 2>&1 || true

echo "正在清理重复的本机后台服务..."
launchctl bootout "gui/$USER_ID/com.calligraphy.dashboard.local" >/dev/null 2>&1 || true
launchctl remove "com.calligraphy.dashboard.local" >/dev/null 2>&1 || true
launchctl bootout "gui/$USER_ID/com.calligraphy.dashboard.lan" >/dev/null 2>&1 || true
launchctl unload "$PLIST_FILE" >/dev/null 2>&1 || true

launchctl bootstrap "gui/$USER_ID" "$PLIST_FILE" >/dev/null 2>&1 || launchctl load "$PLIST_FILE"
launchctl kickstart -k "gui/$USER_ID/com.calligraphy.dashboard.lan" >/dev/null 2>&1 || true

echo "已安装并启动局域网常驻服务。"
echo "日志：$LOG_FILE"
echo "如需管理：双击 管理看板服务.command"
echo "访问地址请查看日志，或打开 http://本机局域网IP:8765"
