#!/bin/zsh

set -u

echo "========================================"
echo "安全清理缓存"
echo "========================================"
echo ""
echo "这个工具只清理可再生成的缓存目录，不会清理聊天记录、文档、看板数据。"
echo "建议运行前先退出飞书、Edge 等应用，避免部分缓存正在被占用。"
echo ""

TARGET_LABELS=(
  "飞书缓存"
  "Microsoft Edge 缓存"
  "Playwright 测试浏览器缓存"
)

TARGET_PATHS=(
  "$HOME/Library/Caches/LarkShell"
  "$HOME/Library/Caches/Microsoft Edge"
  "$HOME/Library/Caches/ms-playwright"
)

echo "当前磁盘空间："
df -h "$HOME" | tail -n 1
echo ""

echo "预计清理内容："
total_kb=0
for i in {1..${#TARGET_PATHS[@]}}; do
  label="${TARGET_LABELS[$i]}"
  path="${TARGET_PATHS[$i]}"
  if [[ -e "$path" ]]; then
    size_text="$(du -sh "$path" 2>/dev/null | awk '{print $1}')"
    size_kb="$(du -sk "$path" 2>/dev/null | awk '{print $1}')"
    total_kb=$((total_kb + size_kb))
    echo "  - $label：$size_text"
    echo "    $path"
  else
    echo "  - $label：不存在，跳过"
    echo "    $path"
  fi
done

total_mb=$((total_kb / 1024))
echo ""
echo "预计最多可释放约：${total_mb} MB"
echo ""
echo "如果确认清理，请输入 CLEAN 后按回车。"
echo "如果不想清理，直接关闭窗口，或按回车退出。"
echo ""
printf "请输入确认词："
read confirm

if [[ "$confirm" != "CLEAN" ]]; then
  echo ""
  echo "已取消，没有删除任何文件。"
  echo ""
  echo "按回车关闭窗口。"
  read _
  exit 0
fi

echo ""
echo "开始清理..."
for i in {1..${#TARGET_PATHS[@]}}; do
  label="${TARGET_LABELS[$i]}"
  path="${TARGET_PATHS[$i]}"
  if [[ -e "$path" ]]; then
    echo "  - 正在清理：$label"
    rm -rf "$path"
    mkdir -p "$path"
  else
    echo "  - 跳过：$label"
  fi
done

echo ""
echo "清理完成。当前磁盘空间："
df -h "$HOME" | tail -n 1
echo ""
echo "如果空间还不够，下一步建议在微信、飞书、企业微信、WPS 的应用内清理聊天文件和历史缓存。"
echo ""
echo "按回车关闭窗口。"
read _
