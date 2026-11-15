# QA: stage readiness (05:40; app.js 05:32, bridge/sensor 05:27)

Method: isolated bridge (port 8766, data/ never written), Playwright Chromium, synthetic 800 Hz taps into `bridge.Trigger`. Scripts: /tmp/qa/. Shared 2-core sandbox: p95s are pessimistic. "(re-test)" = failed on the 05:10 code, passes now.

## Results

| Test | Result | Numbers |
|---|---|---|
| 1 Latency (software) | PASS | sensor to Tone start median 12 ms, p95 58 (scan 6.5, SSE 4.7, JS 0.2); key median 3 to 5 ms, p95 12 to 39; +~10 ms audio out. Acoustic: not testable |
| 2 One tap = one hit | PASS | 20/20, no doubles |
| 3 Rolls | PASS to 11/s | 120 ms 41/41, 90 ms 55/55; 70 ms 44/71, alternating 29/71 |
| 4 Velocity | PASS | 10 rising levels, 0.15 to 0.997 |
| 5 Accuracy | PASS (synthetic) | 200/200; wizard 100%; 20/20 right sound |
| 6 Crosstalk | PASS | 0/20 |
| 7 False triggers | FAIL | key suppress OK; table bump 0.15 g: 2 hits; lid-pump wobble: 9 hits in 4 s; noise 1.7x calibrated: 29 in 10 s |
| 8 Speaker feedback | FAIL (sim) | hum at threshold: 22 hits in 2 s; guard misaligned (#3) |
| 9 Polyphony | PASS | 10 keys x5: 50/50, nothing stuck |
| 10 Timing (re-test) | PASS | loop 50 to 72 ms ahead, 0 ms grid error at 43 s (was 34 ms late) |
| 11 Sensors offline | PASS | red pill in 1.05 s, keys work |
| 12 Venue | not testable | |
| Every key, 26 pad clicks | PASS | S X L . only in 8 squares |
| Loop record/undo/clear (re-test) | PASS | 7, 6, 0 events; record flam 0/7 (was 5/7) |
| Overdub same step | FAIL | #1 |
| Choke, ducking, air, stink, freshener | PASS | -6 dB then 0; no air, no note |
| Drop-ins (re-test) | PASS | kick.wav used; broken file skipped, show starts |
| Sensor server path (re-test) | PASS (fake IMU) | every sample sent (851/s), lux now sent |
| Wizard happy / skip-all | PASS | 26 s, 100%; calibration kept |
| Wizard Close mid-squares | FAIL | #4 |
| Reload x6 | PASS | 1 SSE client left |
| Soak 3 min | PASS | DOM 680 to 775, heap 10 to 32 MB, no growth; 7 errors, all #1 |
| Layout 1024x768 to 1920x1080 | PASS | nothing off screen |

## Failures, ranked

1. **Overdub on the same 16th kills that step.** web/app.js:128 (`p.start`), via record() app.js:149. Same sound twice on one step starts at the same time; Tone throws "Start time must be strictly greater..." and the rest of that step is skipped every pass. Repro: kick on beat 1, next layer kick + snare on beat 1: snare 0/3 passes. Fix: record() skips an existing name+step; try/catch around start.
2. **Moving the laptop fires drums.** src/bridge.py:166, one-pole high-pass (~2.6 Hz) passes body motion, so lid pumping and the hand-off can fart. Fix: ignore taps while `T.lid` moves over 1 degree in 300 ms, or high-pass near 20 Hz. Now: M before hand-off.
3. **Speaker guard and loop visuals ~70 ms early.** app.js:115 uses `Tone.now()` (includes 0.1 s look-ahead), so the 80 ms guard ends before the vibration arrives; flash() (app.js:130) pops 68 to 72 ms before loop sounds. Fix: `time - Tone.immediate()`, `Tone.Draw.schedule(() => flash(ev), time)`.
4. **Close/Skip after Start in "Squares" erases that square.** bridge.py:243 clears it, wizClose (app.js:359) saves. LT 8 to 1. Fix: back up on zone_start, restore if under 8.
5. **`[` goes below the noise floor.** bridge.py:263 clamps at 0.01; quiet mock then gave 55 phantom taps in 25 s. Fix: clamp at the measured noise threshold.
6. scripts/*.sh are mode 644: `./scripts/setup.sh` gives "permission denied". chmod +x or README says `bash scripts/...`.
7. Bridge dies: pill stays "sensors live" (app.js:319, no onerror). Low.
8. visuals.js threw once: arc radius -2e-15; clamp to 0. Low.

Not testable here: real sensors, Safari, dark-room light sensor (needs 5+ lux), speaker vibration, HDMI audio.

## First 15 minutes at the venue
1. `bash scripts/setup.sh` (wifi once), then `bash scripts/run_sensors.sh --probe`: about 400 accel samples and a lux value.
2. Terminal 1 `bash scripts/run_sensors.sh`, terminal 2 `bash scripts/run_app.sh`. Pill: "sensors live", ~800 Hz.
3. Plug in HDMI, then Sound settings: pick the right output (macOS may switch to the projector). Volume 80%.
4. Calibrate on the stage table with room noise on. Finish every step, never Close mid-squares. Under 80%: V for 4 squares.
5. Record a heavy loop at show volume, hands off 30 s. Extra hits: `]` twice, retest.
6. Pump the lid and watch for drum farts. If so, use M while pumping, or G.
7. Cover the camera light: freshener must fire, else use F.
8. Avoid overdubbing one sound on the same beat. Press C before going on.
9. One full 60 s run; Safari full screen (Cmd+Ctrl+F).

## Verdict
**GO with the keyboard as safety net; sensors unproven.** Keys, pads, loop, wizard and audio pass. Fix #1 and #3 before 5 PM (a few lines each); lid pumping and speaker feedback stay unknown until tried on the real table.
