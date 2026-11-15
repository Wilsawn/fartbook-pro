#!/bin/bash
# One-time setup: a private virtual environment inside this folder (nothing touches system Python).
set -e
cd "$(dirname "$0")/.."
python3 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -r requirements.txt
echo "Setup done. Next: ./scripts/run_sensors.sh (terminal 1) and ./scripts/run_app.sh (terminal 2)"
