#!/bin/bash
set -e

export VITE_DEV_PORT="${VITE_DEV_PORT:-5173}"

node scripts/ensure-electron-installed.mjs

npx vite --port "$VITE_DEV_PORT" > /tmp/vite-dev-server-url.txt 2>&1 &
VITE_PID=$!

while ! grep -q "Local:" /tmp/vite-dev-server-url.txt 2>/dev/null; do
  sleep 0.1
done

ACTUAL_PORT=$(sed -n 's/.*localhost:\([0-9]*\).*/\1/p' /tmp/vite-dev-server-url.txt | tail -1)
echo "Vite running on port: $ACTUAL_PORT"

wait-on "http://localhost:$ACTUAL_PORT" --timeout 30000

VITE_DEV_PORT=$ACTUAL_PORT node scripts/dev-electron.mjs &
ELECTRON_PID=$!

wait $VITE_PID $ELECTRON_PID