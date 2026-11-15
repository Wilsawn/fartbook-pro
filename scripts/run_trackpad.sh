#!/bin/bash
# Terminal 3: reads finger positions on the real trackpad (no sudo). Add --print to see raw touches.
cd "$(dirname "$0")/.."
python3 src/trackpad_server.py "$@"
