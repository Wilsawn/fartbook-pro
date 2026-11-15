#!/bin/bash
# One command for the whole show: bridge + web page (Chrome, Safari if no Chrome) + trackpad reader + motion sensors.
#   ./scripts/start.sh          real sensors (asks for your Mac password once, for the motion sensor)
#   ./scripts/start.sh --mock   fake taps, no sudo (practice anywhere)
# Ctrl+C stops everything.
cd "$(dirname "$0")/.."
PIDS=()
cleanup() { echo; echo "Stopping FartBook..."; kill "${PIDS[@]}" 2>/dev/null; wait 2>/dev/null; exit 0; }
trap cleanup INT TERM

python3 src/bridge.py & PIDS+=($!)
sleep 1
python3 src/trackpad_server.py & PIDS+=($!)
(sleep 1; open -a "Google Chrome" http://localhost:8765 2>/dev/null || open -a Safari http://localhost:8765) &

if [ "$1" = "--mock" ]; then
  python3 src/sensor_server.py --mock & PIDS+=($!)
else
  if [ ! -x .venv/bin/python ]; then echo "Run ./scripts/setup.sh first (one time)."; cleanup; fi
  echo "Motion sensor needs your Mac password (sudo):"
  sudo -v || cleanup
  sudo .venv/bin/python src/sensor_server.py & PIDS+=($!)
fi
echo "FartBook running: http://localhost:8765   (Ctrl+C to stop)"
wait
