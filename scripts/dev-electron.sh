#!/bin/bash
set -e

export VITE_DEV_PORT="${VITE_DEV_PORT:-5173}"

node scripts/ensure-electron-installed.mjs

# 启动 vite，让它输出实际使用的端口到临时文件
npx vite --port "$VITE_DEV_PORT" > /tmp/vite-dev-server-url.txt 2>&1 &
VITE_PID=$!

# 等待 vite 输出包含 "Local:" 的行，提取实际端口
while ! grep -q "Local:" /tmp/vite-dev-server-url.txt 2>/dev/null; do
  sleep 0.1
done

ACTUAL_PORT=$(grep -oP "localhost:\K\d+" /tmp/vite-dev-server-url.txt | head -1)
echo "Vite running on port: $ACTUAL_PORT"

# 等待 vite server 完全就绪
wait-on "http://localhost:$ACTUAL_PORT" --timeout 30000

# 用实际端口启动 electron
VITE_DEV_PORT=$ACTUAL_PORT node scripts/dev-electron.mjs &
ELECTRON_PID=$!

# 等待任一进程退出
wait $VITE_PID $ELECTRON_PID