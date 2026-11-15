# CLAUDE.md: context for working on FartBook Pro

Hackathon project (one day, solo). Keep changes small, test with the mock, keep the demo working.

## Architecture
- `src/sensor_server.py` (runs with sudo) reads the undocumented Apple Silicon IMU via
  `macimu` (accel + gyro ~800 Hz, lid angle, ambient light) and sends JSON over UDP to
  127.0.0.1:47474: `{t, a:[x,y,z] g, g:[x,y,z] gyro, lid: deg, light: lux}`.
  `--mock` fakes data, `--probe` prints the macimu API (method names are discovered at runtime).
- `src/bridge.py` (stdlib only, no sudo) = drum-module style trigger pipeline:
  high-pass, threshold (noise floor), 4 ms scan for the peak, velocity curve, 70 ms mask,
  k-NN zone match on [accel dir + gyro dir] with a confidence score. Serves `web/` on
  http://localhost:8765, pushes events over SSE `/events`, takes commands on POST `/cmd`.
  Events: `tap{zone,conf,vel,peak,accepted}`, `state`, `cal_tap`, `vel_tap`, `noise_done`, `cal_summary`.
  Commands: `noise`, `zone_start`, `soft_start/stop`, `hard_start/stop`, `stop`, `reset`,
  `threshold`, `curve`, `suppress` (ignore taps caused by key/trackpad presses).
- `web/app.js` = visuals + sound with bundled Tone.js 14.7.77: `Tone.Players` for samples,
  `Tone.Sampler` (melody_base.wav at A2, pitch-shifted) for notes, `Tone.Part` 2-bar loop
  quantized to 16ths at 92 BPM, choke groups (vocal, uncle), Limiter on master,
  `lookAhead = 0` for low latency, calibration wizard (4 steps).

## Run / test
- Real: `./scripts/run_sensors.sh` + `./scripts/run_app.sh` (Safari for Force Touch pressure).
- Mock: `./scripts/run_mock.sh` + `python3 src/bridge.py`, open http://localhost:8765.
- Every change: reload the page, check the console is clean, hit keys A Z K , 1 8 Q G SPACE.

## Rules
- Never break the keyboard fallback; the demo must work with sensors offline.
- Do not add the uncle clip or Uppbeat clips to git (see .gitignore, docs/CREDITS.md).
- Install packages only inside `.venv`. No system-wide installs.
- User-facing text: plain words, no em dashes.

## Ideas not built yet
- Real absolute trackpad position + force via the private MultitouchSupport framework
  (see github.com/neolite/kickpads) instead of cursor-on-screen pads.
- Swipe gestures for riser / drop, tilt stomach gurgle, fart song preset (PRD F9, F10).
