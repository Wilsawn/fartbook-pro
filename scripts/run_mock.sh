#!/bin/bash
# No sensors? Fake taps + lid movement so you can work on the app anywhere (no sudo).
cd "$(dirname "$0")/.."
python3 src/sensor_server.py --mock
