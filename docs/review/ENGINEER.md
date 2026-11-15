# Senior engineer review (06:40)

Tested app.js/style.css 06:01, visuals.js 05:46, bridge.py 05:45 on a private copy (port 8792) with mock sensors and Playwright. The shared 8765 bridge started 05:26, so it runs OLD trigger code.

## Verdict: GO

Everything core holds up. Fix 1 to 3 before the show (a few lines each).

## Verified issues, ranked

1. **On-beat side taps are dropped.** app.js:116, :292. The speaker guard skips any tap within 80 ms of a loop sound, before or after. Measured: from 40 ms early to 50 ms late, 0/4 played. "Add SQUEAK" loses every hit on a beat the loop already uses. Fix: keep the last 16 loop sound times at :116; at :292 skip only when `msg.peak < 2.5 * threshold && autoSounds.some(t => now - t > -5 && now - t < 70)`.
2. **"8 taps" stickers stay on every drum after calibrating.** app.js:362 (made at :473). Visible on the projector. Fix: in wizClose add `document.querySelectorAll('.cal-count').forEach(n => n.remove());`.
3. **M is silent in stage mode.** app.js:545 shows no toast, and visuals.js has no `tapsmuted` listener. Forget the second M after the hand-off and side taps stay dead. Fix: always show the toast, or toggle `body.taps-muted` and add a visible CSS cue.
4. **After the end card, the loop plays while the UI says "loop off".** app.js:486. Enter, Enter: 4 loop hits in 3 s with `state.looping` false, and the next SPACE records over them. Sensor taps also play during the end card. Fix: call `clearLoop()` when it turns on; in onSensor return early while `show-endcard` is set.
5. **If the bridge dies, the pill stays "sensors live"** and every key shows a "bridge not running" toast (app.js:323, :332). Keys still play; reconnect works. Fix: `es.onerror = () => onSensor({ type: 'state', connected: false, rate: 0 });`.
6. **Loop ring runs 102 ms ahead of the audio** (app.js:279, ticks include look-ahead). Fix: `Tone.Transport.getTicksAtTime(Tone.immediate())`.
7. **Wizard covers LT2/RT2 targets** in 8-square mode: 31% at 1280x720, 72% at 1024x768 (style.css:255). Fix: `width: min(620px, 56vw)`.
8. **Reduced motion still runs the freshener sweep and spray can** (visuals.js:871). Fix: if RM, skip `sweep` and set `hazeLevel = 0`.

## Suspected (needs the real Mac)

- The 35 Hz high-pass reads slow presses weaker (sim 0.2 g: 2.5 ms push 0.196, 10 ms 0.134) and changes fingerprints. A calibration.json saved before this change is stale: delete it and recalibrate.
- The wizard does not pause the loop. Calibrating while it plays raises the noise floor. Press C first.
- Retrigger cancel eats a soft opposite-side note after an accent (0.6 g, then 0.15 g at 120 ms: 1 hit).
- The 120 ms key suppress drops side taps played together with trackpad pads.

## Numbers

- trigger_test.py: single 20/20; rolls at 120/90/70/60 ms 100%; alternating 71/71; velocity 10 distinct, monotonic; accuracy 200/200; crosstalk 0/20; bump, hum (0.5 to 2x threshold) and lid wobble: 0 accepted; hard tap 1 hit. Loop kick thumps at 1.5x threshold: 3 of 12 accepted, so the browser guard is the only filter.
- Frames: idle 60 fps. Heavy input (20 keys/s, punchlines, 169 loop events): p50 20 to 30 fps, p95 50 to 83 ms on a 2-core software rasterizer. JS is about 8% of the main thread, rendering about 54%.
- 3 min soak: 1292 actions, 1774 hits, 0 errors, 626 elements stable. Heap with forced GC: 4.7, then 7 to 10 MB, no trend.
- All visuals.js hooks are emitted; all ids and data-* app.js queries exist. Reduced motion and stage mode work. Wizard finishes at 1440, 1280, 1024. Offline: 19/19 keys play.
