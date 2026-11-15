#!/bin/bash
# Terminal 2: the bridge + web page. Opens Safari (Safari reports Force Touch trackpad pressure).
cd "$(dirname "$0")/.."
(sleep 1.5; open -a Safari http://localhost:8765) &
python3 src/bridge.py
