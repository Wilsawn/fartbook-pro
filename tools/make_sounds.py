#!/usr/bin/env python3
"""FartBook Pro sound factory: regenerates every synthesized fart, reproducibly.

Dev tool only (not needed at the show). Needs numpy + scipy.

    python3 tools/make_sounds.py              # write all sounds into web/sounds/...
    python3 tools/make_sounds.py --report DIR # just print the stats table for the wavs in DIR
    python3 tools/make_sounds.py --out DIR    # write into DIR instead (for A/B listening)

How a fart is built here (a tiny physical-ish model, not a pulse wave):
  1. Lip flapping. The sphincter opens and slaps shut once per cycle. Each cycle is an
     asymmetric "flow puff" (slow open, fast close); the radiated sound is mostly the
     derivative of that flow, so every closure is a sharp click. That is the buzz.
  2. Irregularity. Real farts are never steady: the cycle length wanders (jitter, slow and
     fast), each flap has its own loudness (shimmer) and open time, and some flaps sputter.
  3. Air. Turbulent noise is gated by the flow, so it hisses only while the lips are open.
  4. Wetness. Bubbles are short damped sine chirps (Minnaert bubbles) sprinkled at random.
  5. Body. A couple of resonant peaks plus a lowpass, the "cheeks / cushion" cavity.
  6. A plosive "p" at the very start so every drum hits instantly.
Synthesis runs at 2x the sample rate and is decimated, so the squeakers do not alias.
Loudness is matched with BS.1770 K-weighting (max 400 ms momentary loudness) to the mix plan
below; peaks stay under each sound's ceiling (never above -1.2 dBFS) via a soft clipper, which
adds a bit of grit that suits farts.
"""
import argparse
import os
import sys
import wave

import numpy as np
from scipy import signal

SR = 44100
OS = 2
FS = SR * OS
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOUNDS = os.path.join(ROOT, 'web', 'sounds')

CLIP_DB = []               # per sound: dB the soft clipper had to shave off (report only)
PEAK_CEIL_DB = -1.2        # hard ceiling for every file (brief: under -1 dBFS)


# ------------------------------------------------------------------ building blocks
def t_axis(dur):
    return np.arange(int(dur * FS)) / FS


def smooth_noise(n, rate_hz, rng):
    """Band-limited random wobble, about N(0,1), changing roughly rate_hz times a second."""
    k = max(4, int(n * rate_hz / FS) + 4)
    pts = rng.standard_normal(k)
    x = np.interp(np.linspace(0, k - 1, n), np.arange(k), pts)
    win = max(1, int(FS / rate_hz / 2))
    if win > 1:
        x = np.convolve(x, np.hanning(win) / np.hanning(win).sum(), mode='same')
    return x / (x.std() + 1e-9)


def glide(t, points):
    """Piecewise exponential pitch contour through (time, Hz) points."""
    ts = np.array([p[0] for p in points])
    hz = np.log(np.array([p[1] for p in points], dtype=float))
    return np.exp(np.interp(t, ts, hz))


def flaps(f0, rng, jitter=0.03, fast_jitter=0.01, shimmer=0.15, oq=0.5, oq_var=0.1,
          skew=0.72, sputter=0.0, start_phase=0.55, first_n=2, first_boost=1.25):
    """The sphincter: returns (radiated pressure, flow) for a pitch curve f0 (Hz, per sample)."""
    n = len(f0)
    f = f0 * (1 + jitter * smooth_noise(n, 18, rng) + fast_jitter * smooth_noise(n, 140, rng))
    phase = start_phase + np.cumsum(f / FS)
    cyc = np.floor(phase).astype(int)
    cyc -= cyc[0]
    ph = phase - np.floor(phase)
    ncyc = cyc[-1] + 1
    amp_c = np.exp(shimmer * rng.standard_normal(ncyc))
    if sputter > 0:                                        # some flaps nearly fail
        amp_c *= np.where(rng.random(ncyc) < sputter, rng.uniform(0.05, 0.4, ncyc), 1.0)
    amp_c[:first_n] = max(1.0, amp_c.max()) * first_boost      # the first slaps are the loudest
    oq_c = np.clip(oq * (1 + oq_var * rng.standard_normal(ncyc)), 0.15, 0.9)
    a = amp_c[cyc]
    o = oq_c[cyc]
    u = ph / o
    flow = np.zeros(n)
    rise = u < skew
    fall = (u >= skew) & (u < 1)
    flow[rise] = 0.5 * (1 - np.cos(np.pi * u[rise] / skew))
    flow[fall] = np.cos(0.5 * np.pi * (u[fall] - skew) / (1 - skew))
    flow *= a
    press = np.diff(flow, prepend=flow[0]) * FS / (2 * np.pi * np.maximum(f, 1))
    return press, flow


def bubbles(dur, rate, rng, fmin=350, fmax=2600, decay=(0.004, 0.015), env=None):
    """Wet crackle: Poisson-scattered damped sine chirps (tiny popping bubbles)."""
    n = int(dur * FS)
    out = np.zeros(n)
    count = rng.poisson(rate * dur)
    for _ in range(count):
        start = int(rng.uniform(0, dur) * FS)
        if env is not None and rng.random() > env[min(start, n - 1)]:
            continue
        f = np.exp(rng.uniform(np.log(fmin), np.log(fmax)))
        tau = rng.uniform(*decay)
        L = min(int(tau * 6 * FS), n - start)
        if L <= 4:
            continue
        tt = np.arange(L) / FS
        chirp = f * (1 + 0.6 * tt / (tau * 6))                # bubbles rise in pitch as they shrink
        b = np.sin(2 * np.pi * np.cumsum(chirp) / FS) * np.exp(-tt / tau)
        out[start:start + L] += b * rng.uniform(0.3, 1.0)
    return out


def noise(n, rng):
    return rng.standard_normal(n)


def bandpass(x, lo, hi, order=2):
    sos = signal.butter(order, [lo, hi], btype='band', fs=FS, output='sos')
    return signal.sosfilt(sos, x)


def lowpass(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, fs=FS, output='sos'), x)


def highpass(x, fc, order=2):
    return signal.sosfilt(signal.butter(order, fc, btype='high', fs=FS, output='sos'), x)


def body(x, peaks, lp=None, dry=0.6):
    """Resonant cavity: dry + sum of resonant peaks (freq, Q, gain), then a lowpass."""
    y = dry * x
    for f, q, g in peaks:
        b, a = signal.iirpeak(f, q, fs=FS)
        y = y + g * signal.lfilter(b, a, x)
    if lp:
        y = lowpass(y, lp)
    return y


def env_adsr(t, attack=0.001, hold=0.0, decay=0.2, curve=2.0, total=None):
    """Instant-on envelope: linear attack, hold, then a power-curve decay to zero at `total`."""
    total = total or t[-1]
    e = np.ones_like(t)
    e[t < attack] = t[t < attack] / attack
    d = (t - attack - hold) / max(1e-6, total - attack - hold)
    m = d > 0
    e[m] = np.clip(1 - d[m], 0, 1) ** curve
    return e


def plosive(dur, rng, lo=300, hi=3000, length=0.008):
    """The 'p' at the start: a short filtered noise burst, guarantees an instant onset."""
    n = int(dur * FS)
    L = int(length * FS)
    p = np.zeros(n)
    burst = bandpass(noise(L * 3, rng), lo, hi)[:L]
    p[:L] = burst * np.exp(-np.arange(L) / (L / 3))
    return p / (np.abs(p).max() + 1e-9)


def reverb(x, rng, seconds=2.6, predelay=0.012, damp=3500, wet=0.6):
    """Big bathroom: exponentially decaying stereo-ish noise IR, darker as it decays."""
    n = int(seconds * FS)
    t = np.arange(n) / FS
    ir = noise(n, rng) * np.exp(-t * 6.9 / seconds)           # -60 dB at `seconds`
    dark = lowpass(ir, damp * 0.35)
    mix = np.clip(t / seconds * 1.6, 0, 1)
    ir = (1 - mix) * ir + mix * dark * 2.0
    ir = highpass(ir, 90)
    ir = np.concatenate([np.zeros(int(predelay * FS)), ir])
    ir /= np.sqrt(np.sum(ir ** 2))
    y = signal.fftconvolve(np.concatenate([x, np.zeros(len(ir))]), ir)[:len(x) + len(ir)]
    dry = np.concatenate([x, np.zeros(len(y) - len(x))])
    return dry + wet * y * 9.0


def fade_out(x, seconds=0.01):
    n = int(seconds * FS)
    x = x.copy()
    x[-n:] *= np.cos(np.linspace(0, np.pi / 2, n)) ** 2
    return x


# ------------------------------------------------------------------ loudness + output
def _biquad(kind, fc, q, gain_db, fs):
    A = 10 ** (gain_db / 40)
    w = 2 * np.pi * fc / fs
    alpha = np.sin(w) / (2 * q)
    c = np.cos(w)
    if kind == 'shelf':
        b = [A * ((A + 1) + (A - 1) * c + 2 * np.sqrt(A) * alpha),
             -2 * A * ((A - 1) + (A + 1) * c),
             A * ((A + 1) + (A - 1) * c - 2 * np.sqrt(A) * alpha)]
        a = [(A + 1) - (A - 1) * c + 2 * np.sqrt(A) * alpha,
             2 * ((A - 1) - (A + 1) * c),
             (A + 1) - (A - 1) * c - 2 * np.sqrt(A) * alpha]
    else:  # highpass
        b = [(1 + c) / 2, -(1 + c), (1 + c) / 2]
        a = [1 + alpha, -2 * c, 1 - alpha]
    return np.array(b) / a[0], np.array(a) / a[0]


def k_weight(x, fs=SR):
    b, a = _biquad('shelf', 1500.0, 1 / np.sqrt(2), 4.0, fs)
    x = signal.lfilter(b, a, x)
    b, a = _biquad('hp', 38.0, 0.5, 0, fs)
    return signal.lfilter(b, a, x)


def momentary_lufs(x, fs=SR):
    """Loudest 400 ms window (BS.1770 K-weighted). Short sounds are zero padded to 400 ms."""
    y = k_weight(np.concatenate([x, np.zeros(int(0.4 * fs))]), fs)
    w = int(0.4 * fs)
    p = np.convolve(y ** 2, np.ones(w) / w, mode='valid')
    return -0.691 + 10 * np.log10(p.max() + 1e-12)


def laptop(x, fs=SR):
    """Rough MacBook speaker model: little below ~180 Hz, gentle top rolloff."""
    y = signal.sosfilt(signal.butter(2, 180, btype='high', fs=fs, output='sos'), x)
    return signal.sosfilt(signal.butter(1, 10000, fs=fs, output='sos'), y)


def blended_lufs(x, fs=SR):
    """Loudness heard half on a PA, half on the laptop's own speakers (the show may use either).
    Plain LUFS rated a 100 Hz kick as loud as the rest, but it played about 6 dB quieter on a laptop."""
    return 0.5 * momentary_lufs(x, fs) + 0.5 * momentary_lufs(laptop(x, fs), fs)


def finish(x, target_lufs=-15.0, trim_db=0.0, ceil_db=-1.2):
    """Decimate to 44.1 kHz, remove DC, match loudness, soft-clip peaks under the ceiling."""
    y = signal.resample_poly(x, 1, OS)
    y = signal.sosfilt(signal.butter(2, 20, btype='high', fs=SR, output='sos'), y)  # DC / subsonic
    y[: int(0.0005 * SR)] *= np.linspace(0, 1, int(0.0005 * SR))   # 0.5 ms click guard
    ceil = 10 ** (min(ceil_db, PEAK_CEIL_DB) / 20)
    target = target_lufs + trim_db
    y *= 10 ** ((target - blended_lufs(y)) / 20)
    CLIP_DB.append(max(0.0, 20 * np.log10(np.abs(y).max() / ceil)))   # how hard the clipper works
    for _ in range(8):
        y *= 10 ** ((target - blended_lufs(y)) / 20)
        if np.abs(y).max() <= ceil:
            break
        knee = ceil * 0.7                                        # soft clip only above the knee
        over = np.abs(y) > knee
        y[over] = np.sign(y[over]) * (knee + (ceil - knee) * np.tanh((np.abs(y[over]) - knee) / (ceil - knee)))
    y *= min(1.0, ceil / np.abs(y).max())
    return y


def write_wav(path, y):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pcm = np.clip(np.round(y * 32767), -32768, 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


def read_wav(path):
    with wave.open(path, 'rb') as w:
        sr, ch, sw = w.getframerate(), w.getnchannels(), w.getsampwidth()
        raw = w.readframes(w.getnframes())
    x = np.frombuffer(raw, dtype='<i2').astype(float) / 32768
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    return x, sr, ch, sw * 8


# ------------------------------------------------------------------ the sounds
# Mix plan (docs/CREATIVE.md sound notes): uncle vocals on top (their chops sit near -12 LUFS),
# drums second (-17, peaks at most -3 dBFS, so about -5 at the default velocity 0.8 and the
# limiter rarely pumps), the melody a whiny reed bed underneath (-17), H the long tragic fart is
# a punchline (-11, the loudest-feeling). All targets are blended PA + laptop loudness (finish()).
# Drum farts stay under 250 ms with tight starts; wetness lives on the WET pad only.
DRUM = dict(target_lufs=-17.0, ceil_db=-3.0)


def flutter(t, rng, rate=(18, 30), depth=0.35):
    """Rubbery 15-40 Hz amplitude flutter (the 'brrrr' of a whoopee cushion), rate drifts."""
    r = np.interp(t, [0, t[-1]], rate) * (1 + 0.15 * smooth_noise(len(t), 6, rng))
    return 1 - depth * 0.5 * (1 + np.sin(2 * np.pi * np.cumsum(r) / FS))


def make_kick(rng):
    """Deep rumble with a punchy start: low flaps that drop in pitch, big pop up front."""
    dur = 0.24
    t = t_axis(dur)
    f0 = glide(t, [(0, 74), (0.04, 54), (0.15, 42), (dur, 36)])
    press, flow = flaps(f0, rng, jitter=0.05, fast_jitter=0.02, shimmer=0.18, oq=0.55, skew=0.65,
                        start_phase=0.62)
    air = bandpass(noise(len(t), rng), 150, 1200) * flow * 0.25
    # laptop speakers cannot play 40 Hz, so the rumble has to live in the harmonics (150-900 Hz)
    x = body(press + air, [(95, 2.0, 1.0), (240, 2.0, 1.2), (480, 2.5, 0.7), (900, 3.0, 0.3)], lp=2600, dry=0.6)
    x = 0.5 * x + highpass(x, 160)                  # under 160 Hz cut ~6 dB: it was 84% of the energy
    x = np.tanh(2.5 * x / np.abs(x).max()) / np.tanh(2.5)   # rubbery grit = harmonics a laptop can play
    sub = np.sin(2 * np.pi * np.cumsum(f0) / FS + 0.5) * 0.2    # short chest thump for a PA
    e = env_adsr(t, attack=0.0008, hold=0.02, decay=dur, curve=1.5)
    x = (x + sub * np.exp(-t / 0.06)) * e * (1 + 1.6 * np.exp(-t / 0.012))
    x += plosive(dur, rng, 200, 1500, 0.010) * 1.0
    return finish(fade_out(x), **DRUM)


def make_wet(rng):
    """Wet and crackly (the only gross one): sputtering flaps plus lots of bubbles."""
    dur = 0.25
    t = t_axis(dur)
    f0 = glide(t, [(0, 98), (0.1, 84), (dur, 64)])
    press, flow = flaps(f0, rng, jitter=0.10, fast_jitter=0.05, shimmer=0.35, oq=0.6, oq_var=0.2,
                        skew=0.6, sputter=0.18)
    e = env_adsr(t, attack=0.0008, hold=0.04, decay=dur, curve=1.2)
    turb = bandpass(noise(len(t), rng), 600, 5000) * (0.25 + flow) * 0.5
    bub = bubbles(dur, 420, rng, 400, 3200, (0.003, 0.010), env=e)
    x = body(press + turb, [(140, 2.0, 1.0), (520, 3.0, 0.8), (1300, 4, 0.3)], lp=4500, dry=0.5)
    x = x * e * (1 + 2.0 * np.exp(-t / 0.012)) + bub * 0.4 * e
    x += plosive(dur, rng, 400, 3500, 0.008) * 1.0
    return finish(fade_out(x), **DRUM)


def make_puff(rng):
    """Tiny polite puff: mostly breath, a few timid flaps, gone in a blink."""
    dur = 0.15
    t = t_axis(dur)
    f0 = glide(t, [(0, 190), (dur, 150)])
    press, flow = flaps(f0, rng, jitter=0.06, shimmer=0.25, oq=0.7, skew=0.7)
    breath = bandpass(noise(len(t), rng), 500, 4000)
    x = body(press * 0.5 + breath * 0.6 * (0.4 + flow), [(380, 2.5, 0.8), (1100, 3, 0.4)], lp=5000)
    x = x * env_adsr(t, attack=0.0008, hold=0.01, decay=dur, curve=2.2)
    x += plosive(dur, rng, 600, 4000, 0.006) * 0.5
    return finish(fade_out(x, 0.008), trim_db=-3.0, **DRUM)   # polite = a touch quieter


def make_tom(rng):
    """A round, rubbery 'bwoop' that falls, like a tom."""
    dur = 0.24
    t = t_axis(dur)
    f0 = glide(t, [(0, 150), (0.04, 128), (dur, 82)])
    press, flow = flaps(f0, rng, jitter=0.035, fast_jitter=0.012, shimmer=0.12, oq=0.5, skew=0.7)
    air = bandpass(noise(len(t), rng), 400, 3000) * flow * 0.15
    x = body(press + air, [(220, 2.5, 1.2), (600, 4, 0.4)], lp=2600, dry=0.5)
    e = env_adsr(t, attack=0.0008, hold=0.02, decay=dur, curve=1.4)
    x = x * e * (1 + 0.6 * np.exp(-t / 0.02)) * flutter(t, rng, (26, 20), 0.25)
    x += plosive(dur, rng, 300, 2500, 0.008) * 0.6
    return finish(fade_out(x), **DRUM)


def make_squeak(rng):
    """High squeaker: tight lips, narrow pulses, quick vibrato, little air (the hi-hat)."""
    dur = 0.18
    t = t_axis(dur)
    f0 = glide(t, [(0, 470), (0.04, 540), (0.12, 560), (dur, 480)])
    f0 = f0 * (1 + 0.025 * np.sin(2 * np.pi * 13 * t))
    press, flow = flaps(f0, rng, jitter=0.025, fast_jitter=0.012, shimmer=0.12, oq=0.32, skew=0.75)
    hiss = bandpass(noise(len(t), rng), 2000, 7000) * flow * 0.08
    x = body(press + hiss, [(1100, 3, 0.8), (2400, 5, 0.3)], lp=7000, dry=0.7)
    x = x * env_adsr(t, attack=0.0008, hold=0.03, decay=dur, curve=1.4)
    x += plosive(dur, rng, 1500, 6000, 0.004) * 0.5
    return finish(fade_out(x), trim_db=-2.0, **DRUM)   # bright, so it reads loud already


def make_clap(rng):
    """Fart clap: three quick breathy flams 'p-p-pfrt', then a short buzzy tail."""
    dur = 0.22
    t = t_axis(dur)
    x = np.zeros(len(t))
    for i, at in enumerate([0.0, 0.011, 0.024]):
        s = int(at * FS)
        L = int(0.03 * FS)
        tt = np.arange(L) / FS
        burst = bandpass(noise(L, rng), 700, 4500) * np.exp(-tt / 0.006)
        x[s:s + L] += burst[: len(x) - s] * (1.0 - 0.15 * i)
    tail_t = t - 0.024
    f0 = glide(t, [(0, 210), (dur, 165)])
    press, flow = flaps(f0, rng, jitter=0.07, shimmer=0.3, oq=0.6, skew=0.6, sputter=0.1)
    turb = bandpass(noise(len(t), rng), 900, 5000) * (0.3 + flow)
    tail = body(press + 0.6 * turb, [(480, 2.5, 1.0), (1500, 3, 0.4)], lp=6000, dry=0.5)
    tail *= np.where(tail_t > 0, np.exp(-np.maximum(tail_t, 0) / 0.06), 0)
    x = x * 1.3 + tail * 0.9
    x *= env_adsr(t, attack=0.0005, hold=0.12, decay=dur, curve=1.0)
    return finish(fade_out(x), **DRUM)


def make_snare(rng):
    """The bwomp: pitch bends up then sags, with a breathy snap like snare wires."""
    dur = 0.24
    t = t_axis(dur)
    f0 = glide(t, [(0, 120), (0.035, 155), (0.1, 125), (dur, 85)])
    press, flow = flaps(f0, rng, jitter=0.05, fast_jitter=0.02, shimmer=0.2, oq=0.5, skew=0.68)
    x = body(press, [(330, 2.0, 1.2), (850, 3, 0.5)], lp=3200, dry=0.5)
    snap = highpass(bandpass(noise(len(t), rng), 1500, 7000), 1200) * np.exp(-t / 0.035)
    e = env_adsr(t, attack=0.0008, hold=0.03, decay=dur, curve=1.3)
    x = x * e * (1 + 1.2 * np.exp(-t / 0.012)) * flutter(t, rng, (30, 22), 0.2) + snap * 0.55
    x += plosive(dur, rng, 300, 2500, 0.008) * 1.0
    return finish(fade_out(x), **DRUM)


def make_crash(rng):
    """Huge reverb fart: a gritty dry blast up front, then a tiled-bathroom tail (no bubbles)."""
    dry_dur = 0.6
    t = t_axis(dry_dur)
    f0 = glide(t, [(0, 92), (0.08, 76), (0.4, 62), (dry_dur, 50)])
    press, flow = flaps(f0, rng, jitter=0.08, fast_jitter=0.04, shimmer=0.3, oq=0.6, oq_var=0.15,
                        skew=0.6, sputter=0.06, first_n=4, first_boost=1.5)
    turb = bandpass(noise(len(t), rng), 500, 5000) * (0.2 + flow) * 0.35
    x = body(press + turb, [(120, 2.0, 1.2), (300, 2.5, 1.0), (900, 4, 0.3)], lp=4000, dry=0.5)
    e = env_adsr(t, attack=0.0008, hold=0.25, decay=dry_dur, curve=1.2)
    fl = 1 - np.clip((t - 0.05) / 0.05, 0, 1) * (1 - flutter(t, rng, (22, 16), 0.2))
    x = x * e * (1 + 2.2 * np.exp(-t / 0.06)) * fl
    x += plosive(dry_dur, rng, 200, 2500, 0.015) * 1.2
    y = reverb(x, rng, seconds=2.2, predelay=0.02, wet=0.22)
    y = y[: int(2.6 * FS)]
    return finish(fade_out(y, 0.3), target_lufs=-13.0, ceil_db=-3.0)   # louder: full-screen tier


def make_slow(rng):
    """H, the long tragic deflation: whiny rubbery squeal that sags, flutters, sputters, gives up.

    The punchline: longest and loudest-feeling. Whiny start ~300 Hz, rubbery 80-300 Hz middle,
    20-35 Hz flutter that slows as the air runs out, pitch bends down at the tail.
    """
    dur = 3.0
    t = t_axis(dur)
    f0 = glide(t, [(0, 290), (0.25, 320), (0.9, 280), (1.7, 200), (2.3, 130), (2.75, 95), (dur, 70)])
    wob = (0.015 + 0.05 * (t / dur) ** 2) * np.sin(2 * np.pi * (5 + 2 * t / dur) * t)
    f0 = f0 * (1 + wob)
    press, flow = flaps(f0, rng, jitter=0.05, fast_jitter=0.015, shimmer=0.2, oq=0.42, skew=0.72)
    press2, flow2 = flaps(f0 * 0.98, rng, jitter=0.12, fast_jitter=0.05, shimmer=0.45, oq=0.6,
                          skew=0.6, sputter=0.25)
    mix = np.clip((t - 1.4) / 1.3, 0, 1)                       # it gets sloppier as it empties
    p = (1 - mix) * press + mix * press2
    fl = (1 - mix) * flow + mix * flow2
    hiss = bandpass(noise(len(t), rng), 1200, 6000) * fl * 0.1
    x = body(p + hiss, [(260, 2, 0.9), (650, 2.5, 0.8), (1500, 4, 0.25)], lp=5500, dry=0.6)
    amp = glide(t, [(0, 1.0), (0.4, 0.95), (1.7, 0.75), (2.4, 0.5), (2.8, 0.3), (dur, 0.02)])
    amp *= flutter(t, rng, (34, 14), 0.32)                    # flutter slows down over time
    amp *= 1 + 0.25 * mix * smooth_noise(len(t), 9, rng)
    x = x * np.clip(amp, 0, None)
    x[t < 0.0008] *= t[t < 0.0008] / 0.0008
    x += plosive(dur, rng, 400, 3000, 0.012) * 0.4               # breathy onset
    end = int(2.8 * FS)                                          # the last sad little 'pfft'
    tail = plosive((len(x) - end) / FS + 0.01, rng, 500, 3500, 0.03) * 0.25
    x[end:] += tail[: len(x) - end]
    return finish(fade_out(x, 0.05), target_lufs=-11.0, ceil_db=-1.2)


def make_melody(rng):
    """Steady, whiny-reed fart at exactly A2 = 110 Hz for the Sampler (pitched up to D4).

    The average pitch is locked (tiny symmetric vibrato only), the fundamental is the
    strongest partial, nasal 'reed' formants give the whine (harmonics 2 to 4 within 5 to 13 dB
    of the fundamental, so it is not a clean sine and still sounds on laptop speakers), and there
    is almost no noise, so it stays clean when Tone.Sampler speeds it up 2.67x.
    1.8 s long: at D4 (2.67x faster) it still lasts 0.67 s, longer than an 8th note at 92 BPM
    plus the 0.2 s release, so high notes never cut off early.
    """
    dur = 1.8
    t = t_axis(dur)
    f0 = np.full(len(t), 110.0) * (1 + 0.006 * np.sin(2 * np.pi * 5.5 * t))
    press, flow = flaps(f0, rng, jitter=0.0, fast_jitter=0.002, shimmer=0.04, oq=0.58, oq_var=0.03,
                        skew=0.68, start_phase=0.5, first_boost=1.0)
    x = 1.2 * press + 0.5 * (flow - flow.mean())                # flow keeps the fundamental on top
    x = body(x, [(110, 4.0, 0.4), (330, 3.0, 0.6), (750, 2.5, 0.8), (1400, 4.0, 0.4)], lp=3200, dry=0.7)
    x = x + bandpass(noise(len(t), rng), 800, 3000) * flow * 0.015
    e = np.minimum(1, t / 0.002) * np.where(t > dur - 0.15, np.cos(np.pi / 2 * (t - dur + 0.15) / 0.15) ** 2, 1)
    x = x * e * (1 + 0.25 * np.exp(-t / 0.03))
    return finish(x, target_lufs=-17.0, ceil_db=-6.0)


def make_spray(rng):
    """Aerosol can: nozzle click, then a bright hiss that flutters a little and fades."""
    dur = 0.9
    t = t_axis(dur)
    hiss = bandpass(noise(len(t), rng), 3500, 14000, order=3)
    hiss += 0.35 * bandpass(noise(len(t), rng), 1800, 4000)
    wob = 1 + 0.12 * smooth_noise(len(t), 25, rng)
    e = np.minimum(1, t / 0.0015) * np.where(t > 0.65, np.cos(np.pi / 2 * np.clip((t - 0.65) / 0.25, 0, 1)) ** 2, 1)
    x = hiss * wob * e
    click = np.zeros(len(t))
    L = int(0.004 * FS)
    click[:L] = bandpass(noise(L * 4, rng), 1000, 6000)[:L] * np.exp(-np.arange(L) / (L / 4))
    x += click * 4
    return finish(fade_out(x), target_lufs=-16.0, ceil_db=-3.0)


RECIPES = [
    ('drums/synth_kick.wav', make_kick, 101),
    ('drums/synth_wet.wav', make_wet, 102),
    ('drums/synth_puff.wav', make_puff, 103),
    ('drums/synth_tom.wav', make_tom, 104),
    ('drums/synth_squeak.wav', make_squeak, 105),
    ('drums/synth_clap.wav', make_clap, 106),
    ('drums/synth_snare.wav', make_snare, 107),
    ('drums/synth_crash.wav', make_crash, 108),
    ('drums/synth_slow.wav', make_slow, 109),
    ('melody/melody_base.wav', make_melody, 110),
    ('fx/spray.wav', make_spray, 111),
]


# ------------------------------------------------------------------ report
def stats(x, sr):
    """duration, onset (first sample above -40 dBFS), attack (onset -> 5 ms RMS envelope within
    6 dB of its maximum), peak dBFS, RMS dBFS over the audible part, max momentary LUFS, and the
    dominant FFT frequency (parabolic-interpolated peak, 20 Hz to 12 kHz)."""
    a = np.abs(x)
    peak = a.max()
    on = np.argmax(a > 0.01) if (a > 0.01).any() else 0
    w = max(1, int(0.005 * sr))                                     # 5 ms RMS envelope
    env = np.sqrt(np.convolve(x ** 2, np.ones(w) / w, mode='same'))
    att = np.argmax(env[on:] >= env.max() * 0.5)                    # onset -> within 6 dB of max
    audible = x[on:]
    rms = np.sqrt(np.mean(audible ** 2)) if len(audible) else 0
    n = 1 << int(np.ceil(np.log2(max(len(x), 4096) * 4)))
    spec = np.abs(np.fft.rfft(x * np.hanning(len(x)), n))
    freqs = np.fft.rfftfreq(n, 1 / sr)
    band = (freqs > 20) & (freqs < 12000)
    i = np.argmax(np.where(band, spec, 0))
    if 0 < i < len(spec) - 1:                                       # parabolic interpolation
        l, c, r = np.log(spec[i - 1:i + 2] + 1e-12)
        i = i + 0.5 * (l - r) / (l - 2 * c + r)
    dom = i * sr / n
    return dict(dur=len(x) / sr, onset_ms=on / sr * 1000, attack_ms=att / sr * 1000,
                peak_db=20 * np.log10(peak + 1e-12), rms_db=20 * np.log10(rms + 1e-12),
                lufs=momentary_lufs(x, sr), lap=momentary_lufs(laptop(x, sr), sr), dom_hz=dom)


def report(paths, title=''):
    if title:
        print(f'\n{title}')
    print(f'{"file":<22}{"fmt":>12}{"dur s":>8}{"onset ms":>10}{"atk ms":>8}{"peak dB":>9}{"RMS dB":>8}{"LUFS(M)":>9}{"laptop":>8}{"dom Hz":>9}')
    for p in paths:
        x, sr, ch, bits = read_wav(p)
        s = stats(x, sr)
        print(f'{os.path.basename(p):<22}{f"{ch}ch {sr//1000}k {bits}b":>12}{s["dur"]:8.3f}{s["onset_ms"]:10.2f}'
              f'{s["attack_ms"]:8.2f}{s["peak_db"]:9.2f}{s["rms_db"]:8.1f}{s["lufs"]:9.1f}{s["lap"]:8.1f}{s["dom_hz"]:9.1f}')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--out', default=SOUNDS, help='sounds root to write into (default web/sounds)')
    ap.add_argument('--report', metavar='DIR', help='only print stats for every .wav in DIR')
    args = ap.parse_args()
    if args.report:
        files = sorted(os.path.join(args.report, f) for f in os.listdir(args.report) if f.endswith('.wav'))
        report(files)
        return
    written = []
    for rel, fn, seed in RECIPES:
        y = fn(np.random.default_rng(seed))
        path = os.path.join(args.out, rel)
        write_wav(path, y)
        written.append(path)
    report(written, f'wrote {len(written)} files into {args.out}')
    print('soft clip (dB shaved): ' + ', '.join(f'{os.path.basename(r[0])[:-4]} {c:.1f}' for r, c in zip(RECIPES, CLIP_DB)))


if __name__ == '__main__':
    sys.exit(main())
