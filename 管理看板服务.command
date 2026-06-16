#!/bin/zsh
set -u

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
PLIST_FILE="$HOME/Library/LaunchAgents/com.calligraphy.dashboard.lan.plist"
LAN_LABEL="com.calligraphy.dashboard.lan"
LOCAL_LABEL="com.calligraphy.dashboard.local"
USER_ID="$(id -u)"

cd "$PROJECT_DIR"

show_listeners() {
  echo ""
  echo "当前 8765 端口监听："
  lsof -nP -iTCP:8765 -sTCP:LISTEN 2>/dev/null || echo "  没有发现监听进程"
}

show_health() {
  echo ""
  echo "服务健康检查："
  curl -sS "http://127.0.0.1:8765/api/health" 2>/dev/null || echo "  当前无法访问 http://127.0.0.1:8765/api/health"
  echo ""
}

stop_label() {
  local label="$1"
  launchctl bootout "gui/$USER_ID/$label" >/dev/null 2>&1 || true
  launchctl remove "$label" >/dev/null 2>&1 || true
}

start_lan() {
  if [[ ! -f "$PLIST_FILE" ]]; then
    echo "未找到常驻服务配置，请先双击：安装为局域网常驻服务.command"
    return 1
  fi
  stop_label "$LOCAL_LABEL"
  stop_label "$LAN_LABEL"
  launchctl bootstrap "gui/$USER_ID" "$PLIST_FILE" >/dev/null 2>&1 || launchctl load "$PLIST_FILE"
  launchctl kickstart -k "gui/$USER_ID/$LAN_LABEL" >/dev/null 2>&1 || true
}

echo "========================================"
echo "看板服务管理"
echo "========================================"
echo "项目目录：$PROJECT_DIR"
echo ""
echo "1. 查看状态"
echo "2. 重启局域网常驻服务（推荐）"
echo "3. 停止所有看板后台服务"
echo "4. 只清理重复的本机 local 服务"
echo ""
printf "请选择 1-4 后按回车："
read choice

case "$choice" in
  1)
    show_listeners
    show_health
    ;;
  2)
    echo "正在重启局域网常驻服务..."
    start_lan
    sleep 1
    show_listeners
    show_health
    ;;
  3)
    echo "正在停止所有看板后台服务..."
    stop_label "$LOCAL_LABEL"
    stop_label "$LAN_LABEL"
    sleep 1
    show_listeners
    ;;
  4)
    echo "正在清理重复的本机 local 服务..."
    stop_label "$LOCAL_LABEL"
    sleep 1
    show_listeners
    show_health
    ;;
  *)
    echo "没有执行操作。"
    ;;
esac

echo ""
echo "按回车关闭窗口。"
read _
