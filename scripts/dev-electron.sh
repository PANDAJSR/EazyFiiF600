#!/bin/bash
set -e

# 默认端口
export VITE_DEV_PORT="${VITE_DEV_PORT:-5173}"

# 检查 electron 是否需要安装
node scripts/ensure-electron-installed.mjs

# 启动 vite 和 electron
npx concurrently -k "vite --port $VITE_DEV_PORT" "wait-on http://localhost:$VITE_DEV_PORT && node scripts/dev-electron.mjs"