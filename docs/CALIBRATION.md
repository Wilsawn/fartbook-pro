# How real drum pads work, and how FartBook copies them

## What pro pads do (Roland SPD-SX, e-drum modules, MPC-style pads)
A pad has a sensor (a piezo or force sensor). The module reads it thousands of times a
second and turns each strike into one "note" with a velocity. The settings are the same
on almost every kit:

| Setting | What it does | Typical range |
|---|---|---|
| Threshold | ignore signals below this (stops false hits) | 0 to 31 |
| Sensitivity | how hard you must hit for full volume | 1 to 32 |
| Scan time | how long after the first spike to look for the true peak | 0 to 4 ms |
| Retrigger cancel | stops the decay of one hit counting as a second hit | 1 to 16 |
| Mask time | dead time after a hit (stops double triggers) | 0 to 64 ms |
| Crosstalk cancel | stops a hit on one pad also firing a nearby pad | 0 to 80 % |
| Velocity curve | linear, log (soft hits louder), exp (hard hits matter more) | presets |

Sources: Roland SPD-SX PRO reference manual (PAD/TRIGGER IN settings), Roland trigger
settings guide (edrums.github.io), DW drums trigger settings article.

When two pads are hit together, both sound (polyphony). Hitting the same pad again
restarts it. Pads in a mute/choke group cut each other (open vs closed hi-hat).

## The FartBook middle ground
We have one motion sensor for the whole laptop instead of one sensor per pad, so:

| Pro module | FartBook |
|---|---|
| piezo per pad, kHz sampling | one accelerometer + gyroscope, 800 Hz (1.25 ms per sample) |
| threshold set by hand | measured automatically from 2 s of stillness (mean + 6 SD) |
| scan time 2 to 4 ms | 4 ms scan for the peak |
| mask time | 70 ms (one tap = one hit) |
| sensitivity + curve | soft/hard calibration taps + log curve |
| one pad = one sensor | which square = k-NN match of the tap fingerprint (push direction + rotation) |
| crosstalk cancel | low-confidence matches are dropped |
| (no equivalent) | key and trackpad presses briefly suppress taps (they shake the laptop) |
| choke groups | vocal chops and uncle farts choke within their group |

Latency budget: sensor 1.25 ms + scan 4 ms + local network ~1 ms + browser audio
(Tone look-ahead set to 0). Pro kits are around 3 to 5 ms.

## Limits to know
- Two taps at the exact same moment on different squares arrive as one bump: the
  stronger one wins. Pads on the trackpad and keyboard have no such limit.
- 4 squares are reliable; 8 depends on how distinct the spots feel. The test step tells you.
- Tested in a sandbox with simulated taps (40/40 detected once, 40/40 right square).
  Real accuracy is only known after calibrating on the actual laptop.
