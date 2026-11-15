# FartBook Pro

Your MacBook was a whoopee cushion the whole time.

## What it does

- **Silver palm rests = 4 fart drums.** The hidden motion sensor feels where you tap (WET, KICK, SQUEAK, SNARE; press V for 8 squares).
- **Trackpad = 8 pads.** The real trackpad is split into 2 rows x 4 squares in two banks (Tab switches): uncle vocal chops and farts, plus a notes bank. Touch a square, no cursor.
- **Lid = bellows.** Pumping the lid fills an air tank that powers the fart notes. No air, no notes.
- **Loop station plus a full song.** Record and layer loops, or play "Uncle, Not Now (FartBook Remix)" and jam on top.

Covering the light sensor by the camera sprays air freshener and resets the Stink-O-Meter.
Every control has a keyboard backup, so the show still works if the sensors don't connect.

## Requirements

- Apple Silicon MacBook, M2 or newer (tested target: M4)
- macOS
- Python 3
- Chrome or Safari

## Quick start

```bash
./scripts/setup.sh    # once: private .venv, installs macimu
```

Then double-click **Start FartBook.command** in Finder, or run:

```bash
./scripts/start.sh          # real sensors (asks for your Mac password once: the motion sensor needs sudo)
./scripts/start.sh --mock   # fake taps, no sudo: try it without sensors
```

It starts the bridge, the trackpad reader and the motion sensors, and opens http://localhost:8765
in Chrome (Safari if Chrome isn't there). Ctrl+C stops everything.

Click **Start the show**, then **Calibrate** (top right) and follow the 4 steps.
Sensors not reading: `./scripts/run_sensors.sh --probe` prints what macimu sees.

## Controls

| Control | Does |
|---|---|
| Tap spots on the palm rests | fart drums. Left top / bottom: WET / KICK (keys A / Z). Right top / bottom: SQUEAK / SNARE (keys K / ,) |
| Trackpad | 8 pads: uncle vocal chops and farts, or fart notes (keys 1 to 7, 8 9 0, Q to I) |
| Tab | switch trackpad bank |
| Space | record / stop a loop layer |
| Backspace | undo the last layer |
| C | clear the loop |
| B | play the full song |
| P | pause (Shift+P: stage mode) |
| G | pump air (same as moving the lid) |
| F | air freshener (same as covering the light sensor) |
| H | long tragic fart |
| ? | help card |
| ? then Space | guided tour, step by step |

Also: V toggles 8-square mode, N metronome, M mutes laptop taps (for handing the laptop to someone), [ ] tap sensitivity.

Pads react like a sampler: different pads layer, the same pad restarts, and vocal chops
(and uncle farts) choke each other so stutters stay clean. A limiter stops distortion.

## How it works

- **Sensors.** `src/sensor_server.py` uses [macimu](https://pypi.org/project/macimu/) to read the
  undocumented Apple Silicon accelerometer and gyroscope at about 800 Hz, plus lid angle and ambient light,
  and sends them over UDP.
- **Bridge.** `src/bridge.py` (Python standard library only) triggers like an electronic drum module:
  high-pass filter, threshold from a noise floor, 4 ms scan for the peak, velocity curve from your
  soft and hard taps, and a 70 ms mask so one tap is one hit. One sensor covers the whole laptop,
  so it finds the square with k-nearest-neighbour matching against your calibration taps (push
  direction plus rotation) and drops unsure matches. It serves the web page and streams events to it.
- **Trackpad.** `src/trackpad_server.py` reads raw finger positions through macOS's private
  MultitouchSupport framework, so the physical trackpad becomes the pad grid.
- **Browser.** `web/` runs [Tone.js](https://tonejs.github.io/) (bundled, works offline) for the samples,
  2-bar loop, choke groups and limiter, and GSAP for the cartoon stage.

### Calibration (like tuning an electronic drum kit)

1. **Quiet:** 2 s hands off; sets the noise floor so tiny bumps never trigger.
2. **Squares:** tap each glowing square 8 times; learns each spot's fingerprint.
3. **Soft / hard:** 4 soft, 4 hard taps; maps your range to quiet vs loud farts.
4. **Test:** 10 taps on random squares; shows accuracy. Under 80% in 8-square mode, switch to 4 squares (V).

Saved locally in `data/calibration.json` (not in the repo). Details: `docs/CALIBRATION.md`.

## Adding your own sounds

Drop a file into `web/sounds/meme/`, named after the slot it should replace, then reload the page:

| File name | Replaces |
|---|---|
| `kick` `snare` `wet` `squeak` `puff` `tom` `clap` `crash` | the drum squares |
| `slow` | H, the long tragic fart |
| `fart1` `fart2` `fart3` | uncle fart pads |
| `v1` ... `v7` | vocal chop pads |
| `melody` | the note used for the air-powered melody (pitch-shifted) |
| `spray` | air freshener |

Any extension works: `.mp3 .wav .m4a .ogg`. Trim silence at the start of a clip so it hits on time
(`tools/chop_uncle.sh IN OUT START END` works for any file).

## Not included

The uncle voice clip is not in this repo for rights reasons, and neither are the optional meme
sound effects. Without them the app falls back to its built-in sounds (synth farts made in code).

## Project layout

```
FartBook/
  Start FartBook.command   double-click to run
  requirements.txt         macimu (sensor server only)
  scripts/                 setup.sh, start.sh, run_*.sh
  src/
    sensor_server.py       accel + gyro (about 800 Hz), lid angle, light -> UDP
    bridge.py              trigger pipeline + calibration + web server (stdlib only)
    trackpad_server.py     raw trackpad finger positions (MultitouchSupport)
  web/                     index.html, style.css, app.js, visuals.js, vendor/, sounds/
  docs/                    calibration, demo, pitch, credits, design notes
  tools/                   how the sounds were made / re-cut a chop
  media/remotion/          demo video project
```

## Credits

See [docs/CREDITS.md](docs/CREDITS.md).

Built at Stupid Ideas Hackathon Ottawa, Nov 15 2026, with Claude Code.
