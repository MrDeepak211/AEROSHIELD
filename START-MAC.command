#!/bin/bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then echo "Node.js 18+ is required."; read -p "Press Enter to exit..."; exit 1; fi
node server.cjs &
SERVER_PID=$!
sleep 2
open "http://127.0.0.1:5173"
wait $SERVER_PID
