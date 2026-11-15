#!/bin/bash
# Terminal 1: reads the MacBook's hidden motion / lid / light sensors (needs sudo for IOKit HID).
cd "$(dirname "$0")/.."
if [ "$1" = "--probe" ]; then sudo .venv/bin/python src/sensor_server.py --probe; else sudo .venv/bin/python src/sensor_server.py; fi
