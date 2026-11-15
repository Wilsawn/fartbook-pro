# Testing FartBook like a real pad controller

Drum kit and pad reviewers measure latency with a mic, play soft-to-hard to check the
velocity curve, do rolls to catch double triggers and drops, stack hits to find the
polyphony limit, and check timing stability. We run the same tests, scaled to one day.

Targets come from the research: under 10 ms is the pro target for percussion, about
6 ms is where trained drummers notice, 17 to 20 ms is normal for hobby and some
commercial setups, and musicians can stay in time up to about 55 ms.

| # | Test | How | Pass |
|---|---|---|---|
| 1 | Latency | Film your finger tapping the laptop with your phone (audio on), import into Audacity, measure from the tap click to the fart onset | under 30 ms ok, under 15 ms great |
| 2 | One tap = one hit | 20 single taps, count farts | exactly 20 (no doubles: raise mask, no drops: lower threshold) |
| 3 | Rolls | tap as fast as you can for 5 s | no stutter; if it drops hits, mask time is too long |
| 4 | Velocity | 10 taps from softest to hardest | each fart gets louder; softest still audible |
| 5 | Square accuracy | the wizard's test step (10 taps) | 80%+ (else 4 squares) |
| 6 | Crosstalk | 20 taps on one square | under 2 land on another square |
| 7 | False triggers | type, click the trackpad, bump the table, set a drink down | no farts (key/click suppression, threshold) |
| 8 | Speaker feedback | record a heavy loop, max volume, hands off for 30 s | loop never adds hits by itself |
| 9 | Polyphony / overload | mash 10 keys at once, repeat | no crackle (limiter), nothing gets stuck |
| 10 | Timing stability | let a loop play for 2 minutes | stays on the grid, no drift |
| 11 | Sensors offline | stop the sensor server mid-show | keyboard and pads still work, status turns red |
| 12 | Venue check | play through the venue speakers / your speaker | volume ok, no feedback squeal |
| 13 | Trackpad reader | `scripts/run_trackpad.sh --print`, touch the 4 corners | a `down` line per touch; bottom left about x 0.05 y 0.05, top right about x 0.95 y 0.95 |
| 14 | Trackpad squares | app running, touch each of the 8 squares in both banks (Tab) | the right sound and the right square lights, every time |
| 15 | Palm and resting fingers | rest a palm on the trackpad edge, then play | the palm plays nothing (else lower FARTBOOK_PALM_SIZE) |
| 16 | No double hits | trackpad live, physically click a square | one sound, not two |
| 17 | Trackpad vs side drums | play the trackpad hard for 10 s, no side taps | no side drum fires (touches mute taps for 120 ms) |
| 18 | OS gestures | 3 and 4 finger touches on the trackpad | no Mission Control / space switch (turn off in System Settings > Trackpad > More Gestures before the demo) |
| 19 | Notes need air | Tab to notes, play with an empty tank | "out of air" shake; pump the lid, notes play |

Also done in the sandbox (Nov 15): 14 and 16 with simulated touches through the bridge (slot 0 uncle, slot 7
long fart, notes slot 5 = C3, mouse click ignored while the reader is live), 19 by code. 13, 15, 17, 18 need
the real M4.

Already done in the sandbox with simulated sensor data: tests 2, 4 (math), 5 (40/40 on
synthetic taps), 9 (choke + layering verified), 11. Tests 1, 3, 6, 7, 8, 10, 12 need the
real laptop: run them at the venue right after calibrating.

Sources: DrumSpy "How we test"; jonnor.com "Optimizing latency of an Arduino MIDI
controller"; AUDITORY list thread "MIDI drum pads: delay and temporal resolution" (2013).
