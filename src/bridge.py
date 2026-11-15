"""FartBook bridge: sensors -> browser.

Turns the MacBook's motion sensor into a drum-pad trigger, the same way an
electronic drum module turns a piezo signal into hits:

  raw accel/gyro (800 Hz)
    -> remove gravity / drift (high-pass)
    -> THRESHOLD  ignore anything below the measured noise floor
    -> SCAN TIME  after crossing, look ~4 ms for the true peak
    -> VELOCITY   peak strength through a sensitivity range + curve
    -> MASK TIME  ignore the ringing for ~70 ms so one tap = one hit
    -> ZONE       k-nearest-neighbour match of the tap's "fingerprint"
                  (accel direction + gyro rotation) to calibrated squares,
                  with a confidence score (low confidence = rejected,
                  like crosstalk cancel)

Pushes events to the browser over Server-Sent Events and serves the page.
Standard library only.  Run:  python3 src/bridge.py  -> http://localhost:8765
"""
import json, math, os, queue, socket, threading, time
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
WEB = os.path.join(ROOT, "web")
CAL_FILE = os.path.join(ROOT, "data", "calibration.json")
UDP_ADDR = ("127.0.0.1", int(os.environ.get("FARTBOOK_UDP", 47474)))
HTTP_PORT = int(os.environ.get("FARTBOOK_PORT", 8765))
ZONES = ["LT", "LB", "RT", "RB", "LT2", "LB2", "RT2", "RB2"]

clients, clients_lock = [], threading.Lock()


def broadcast(msg):
    data = json.dumps(msg)
    with clients_lock:
        for q in list(clients):
            try:
                q.put_nowait(data)
            except queue.Full:
                pass


def norm(v):
    m = math.sqrt(sum(c * c for c in v)) or 1e-9
    return [c / m for c in v]


def mag(v):
    return math.sqrt(sum(c * c for c in v))


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


class Trigger:
    def __init__(self):
        p = self.load()
        self.threshold = p.get("threshold", 0.08)     # g above noise to count as a hit
        self.floor = p.get("floor", None)              # measured noise floor (lower limit for [ ])
        self.vmin = p.get("vmin", None)                # softest tap peak (velocity calibration)
        self.vmax = p.get("vmax", None)                # hardest tap peak
        self.curve = p.get("curve", "log")             # linear | log | exp
        self.samples = p.get("samples", {})            # zone -> [ [feature...], ... ]
        self.scan_ms = 4.0
        self.mask_ms = 45.0
        self.min_conf = 0.45
        self.grav = [0.0, 0.0, -1.0]
        self.gbase = [0.0, 0.0, 0.0]
        self.seeded = False
        self.fast = [0.0, 0.0, -1.0]
        self.gfast = [0.0, 0.0, 0.0]
        self.bg = 0.0
        self.last_hit = None                           # (time, direction, peak) for retrigger cancel
        self.zone_backup = None
        self.armed = True                              # re-arm only after the signal falls back below threshold
        self.mode = "play"                             # play | noise | zone | soft | hard
        self.mode_zone = None
        self.mode_until = 0.0
        self.noise = []
        self.vel_peaks = []
        self.scan_until = 0.0
        self.peak = None
        self.mask_until = 0.0
        self.suppress_until = 0.0
        self.lid = self.light = None
        self.tilt = 0.0
        self.last_msg = 0.0
        self.rate = 0.0
        self._count, self._t0 = 0, time.time()

    # ---------------- persistence
    def load(self):
        try:
            with open(CAL_FILE) as f:
                return json.load(f)
        except Exception:
            return {}

    def save(self):
        os.makedirs(os.path.dirname(CAL_FILE), exist_ok=True)
        with open(CAL_FILE, "w") as f:
            json.dump({"threshold": self.threshold, "floor": self.floor, "vmin": self.vmin, "vmax": self.vmax,
                       "curve": self.curve, "samples": self.samples}, f)

    # ---------------- feature + classification
    def feature(self, d, w):
        """Fingerprint of a tap: which way the laptop got pushed + which way it rotated."""
        f = norm(d)
        if w is not None and mag(w) > 1e-6:
            f += norm(w)
        else:
            f += [0.0, 0.0, 0.0]
        return f

    def classify(self, f):
        scored = []
        for zone, feats in self.samples.items():
            for s in feats:
                if len(s) == len(f):
                    scored.append((dot(f, s) / (mag(f) * mag(s) + 1e-9), zone))
        if len(scored) < 3:
            u = f[:3]                                    # uncalibrated guess: left vs right
            return ("L" if u[0] < 0 else "R") + ("T" if u[1] > 0 else "B"), 0.5
        scored.sort(reverse=True)
        k = scored[:5]
        votes = {}
        for sim, zone in k:
            votes[zone] = votes.get(zone, 0) + max(0.0, sim)
        zone = max(votes, key=votes.get)
        conf = votes[zone] / (sum(max(0.0, s) for s, _ in k) or 1e-9)
        return zone, round(conf * max(0.0, k[0][0]), 3)

    def separation(self):
        """How distinct each pair of squares is (1 = identical fingerprints)."""
        cents = {}
        for z, feats in self.samples.items():
            if len(feats) >= 3:
                n = len(feats[0])
                cents[z] = norm([sum(s[i] for s in feats) / len(feats) for i in range(n)])
        zs = sorted(cents)
        return [{"a": a, "b": b, "sim": round(dot(cents[a], cents[b]), 3)}
                for i, a in enumerate(zs) for b in zs[i + 1:]]

    def velocity(self, peak):
        lo = self.vmin if self.vmin else self.threshold
        hi = self.vmax if self.vmax else max(lo * 6, lo + 0.3)
        x = min(1.0, max(0.0, (peak - lo) / max(1e-6, hi - lo)))
        if self.curve == "log":
            x = math.log1p(9 * x) / math.log(10)        # soft taps still audible
        elif self.curve == "exp":
            x = x * x
        return round(0.15 + 0.85 * x, 3)

    # ---------------- the trigger pipeline, one sample at a time
    def feed(self, msg):
        now = time.time()
        self.last_msg = now
        self._count += 1
        if now - self._t0 >= 1.0:
            self.rate, self._count, self._t0 = self._count / (now - self._t0), 0, now
        a = msg.get("a")
        if not a or not all(isinstance(x, (int, float)) and math.isfinite(x) for x in a):
            return                                       # one bad sample must never poison the filters
        w = msg.get("g")
        if w is not None and not all(isinstance(x, (int, float)) and math.isfinite(x) for x in w):
            w = None
        if not self.seeded:                              # start the filters from the real first reading
            self.grav, self.fast, self.seeded = list(a), list(a), True
            if w:
                self.gfast = list(w)
        self.grav = [0.98 * g + 0.02 * x for g, x in zip(self.grav, a)]      # slow: gravity, for tilt only
        # tap signal = what changed in the last ~5 ms (high-pass around 35 Hz). Taps are sharp spikes;
        # pumping the lid, picking up the laptop or bumping the table is slow and gets filtered out.
        d = [x - f for x, f in zip(a, self.fast)]
        self.fast = [0.75 * f + 0.25 * x for f, x in zip(self.fast, a)]
        wd = None
        if w:
            wd = [x - f for x, f in zip(w, self.gfast)]
            self.gfast = [0.75 * f + 0.25 * x for f, x in zip(self.gfast, w)]
        m = mag(d)
        bg_before = self.bg
        self.bg = 0.99 * self.bg + 0.01 * m              # background vibration level (about 125 ms memory)
        gn = norm(self.grav)
        t = math.degrees(math.atan2(gn[0], -gn[2]))
        if math.isfinite(t):
            self.tilt = t
        lid, light = msg.get("lid"), msg.get("light")
        if isinstance(lid, (int, float)) and math.isfinite(lid):
            self.lid = float(lid)
        if isinstance(light, (int, float)) and math.isfinite(light):
            self.light = float(light)

        if self.mode == "noise":                         # measuring the quiet laptop
            self.noise.append(m)
            if now >= self.mode_until:
                xs = sorted(self.noise)
                keep = xs[: max(1, int(len(xs) * 0.98))]          # drop the top 2% so one stray bump can't ruin it
                mean = sum(keep) / len(keep)
                sd = math.sqrt(sum((x - mean) ** 2 for x in keep) / len(keep))
                self.threshold = round(max(0.02, mean + 6 * sd, keep[-1] * 1.5), 4)
                self.floor = self.threshold
                self.mode = "play"
                self.save()
                broadcast({"type": "noise_done", "threshold": self.threshold})
            return

        if self.peak is not None:                        # inside the scan window: track the peak
            if m > self.peak[0]:
                self.peak = (m, d, wd)
            if now >= self.scan_until:
                self.fire(*self.peak, now)
                self.peak = None
            return
        if now < self.mask_until or now < self.suppress_until:
            return
        if m < self.threshold * 0.5:                     # hysteresis: must clearly settle (after the mask) before the next hit
            self.armed = True
        if not self.armed:
            return
        if m > self.threshold and m > 3.0 * bg_before:   # impulse check: a hum or buzz is not a tap
            self.armed = False
            self.peak = (m, d, wd)
            self.scan_until = now + self.scan_ms / 1000

    def fire(self, peak, d, wd, now):
        self.mask_until = now + self.mask_ms / 1000
        u = norm(d)
        # retrigger cancel: a weaker bump the opposite way right after a hit is the finger lifting off
        if (self.last_hit and now - self.last_hit[0] < 0.2 and dot(u, self.last_hit[1]) < -0.3
                and peak < 0.35 * self.last_hit[2]):
            return
        self.last_hit = (now, u, peak)
        f = self.feature(d, wd)
        if self.mode == "zone":
            self.samples.setdefault(self.mode_zone, []).append([round(x, 4) for x in f])
            n = len(self.samples[self.mode_zone])
            broadcast({"type": "cal_tap", "zone": self.mode_zone, "count": n, "peak": round(peak, 3)})
            return
        if self.mode in ("soft", "hard"):
            self.vel_peaks.append(peak)
            broadcast({"type": "vel_tap", "mode": self.mode, "count": len(self.vel_peaks), "peak": round(peak, 3)})
            return
        zone, conf = self.classify(f)
        ok = conf >= self.min_conf or not self.samples
        broadcast({"type": "tap", "zone": zone, "conf": conf, "vel": self.velocity(peak),
                   "peak": round(peak, 3), "accepted": ok})

    # ---------------- commands from the page
    def restore_unfinished(self):
        """Closing or skipping mid-square must not wipe a good calibration."""
        if self.mode == "zone" and self.zone_backup:
            z, old = self.zone_backup
            if len(self.samples.get(z, [])) < 3:
                self.samples[z] = old
        self.zone_backup = None

    def command(self, c):
        name = c.get("cmd")
        if name in ("stop", "soft_start", "hard_start", "noise"):
            self.restore_unfinished()
        if name == "noise":
            self.noise, self.mode, self.mode_until = [], "noise", time.time() + float(c.get("seconds", 2))
        elif name == "zone_start" and c.get("zone") in ZONES:
            self.restore_unfinished()
            self.zone_backup = (c["zone"], self.samples.get(c["zone"], []))   # kept until the new taps are enough
            self.samples[c["zone"]] = []
            self.mode, self.mode_zone = "zone", c["zone"]
        elif name in ("soft_start", "hard_start"):
            self.vel_peaks, self.mode = [], name.split("_")[0]
        elif name == "soft_stop" and self.vel_peaks:
            self.vmin = round(sorted(self.vel_peaks)[len(self.vel_peaks) // 2] * 0.8, 4)
            self.mode = "play"
        elif name == "hard_stop" and self.vel_peaks:
            self.vmax = round(sorted(self.vel_peaks)[len(self.vel_peaks) // 2] * 1.1, 4)
            self.mode = "play"
        elif name == "stop":
            self.mode, self.mode_zone = "play", None
            self.save()
            broadcast({"type": "cal_summary", "separation": self.separation(),
                       "counts": {z: len(v) for z, v in self.samples.items()}})
        elif name == "reset":
            self.samples, self.vmin, self.vmax = {}, None, None
            self.mode = "play"
            self.save()
        elif name == "threshold":                        # never below the measured noise floor (phantom taps)
            self.threshold = max(0.02, 0.8 * (self.floor or 0), float(c.get("value", self.threshold)))
            self.save()
        elif name == "curve" and c.get("value") in ("linear", "log", "exp"):
            self.curve = c["value"]
            self.save()
        elif name == "suppress":                         # a key / trackpad click shakes the laptop: ignore it
            self.suppress_until = time.time() + float(c.get("ms", 120)) / 1000


T = Trigger()
T_lock = threading.Lock()
last_tp = 0.0                                            # last packet from trackpad_server.py


def udp_loop():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.bind(UDP_ADDR)
    sock.settimeout(0.5)
    while True:
        try:
            data, _ = sock.recvfrom(4096)
            msg = json.loads(data)
            if "tp" in msg:                              # trackpad helper: pass straight to the page
                global last_tp
                last_tp = time.time()
                if msg["tp"] != "alive":
                    msg["type"] = "touch"
                    broadcast(msg)
                continue
            with T_lock:
                T.feed(msg)
        except socket.timeout:
            pass
        except Exception as e:
            print("bad packet:", e)


def state_loop():
    while True:
        with T_lock:
            broadcast({"type": "state", "connected": time.time() - T.last_msg < 1.0, "rate": round(T.rate),
                       "lid": T.lid, "light": T.light, "tilt": T.tilt, "threshold": T.threshold,
                       "curve": T.curve, "vmin": T.vmin, "vmax": T.vmax, "mode": T.mode,
                       "counts": {z: len(v) for z, v in T.samples.items()},
                       "trackpad": time.time() - last_tp < 2.5})
        time.sleep(1 / 30)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=WEB, **kw)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")   # Safari always gets the latest JS/CSS
        super().end_headers()

    def do_GET(self):
        if self.path == "/api/sounds":                   # drop-in sounds: list web/sounds/meme/
            folder = os.path.join(WEB, "sounds", "meme")
            files = sorted(f for f in os.listdir(folder) if f.lower().endswith((".wav", ".mp3", ".m4a", ".ogg"))) \
                if os.path.isdir(folder) else []
            body = json.dumps(files).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path != "/events":
            return super().do_GET()
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        q = queue.Queue(maxsize=1000)
        with clients_lock:
            clients.append(q)
        try:
            while True:
                try:
                    self.wfile.write(f"data: {q.get(timeout=5)}\n\n".encode())
                except queue.Empty:
                    self.wfile.write(b": ping\n\n")
                self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError):
            pass
        finally:
            with clients_lock:
                clients.remove(q)

    def do_POST(self):
        if self.path != "/cmd":
            self.send_error(404)
            return
        if not self.headers.get("Content-Type", "").startswith("application/json"):
            self.send_error(415)                         # blocks cross-site form posts from other pages
            return
        n = int(self.headers.get("Content-Length", 0))
        try:
            cmd = json.loads(self.rfile.read(n) or b"{}")
        except ValueError:
            self.send_error(400)
            return
        with T_lock:
            T.command(cmd)
        self.send_response(204)
        self.end_headers()


if __name__ == "__main__":
    threading.Thread(target=udp_loop, daemon=True).start()
    threading.Thread(target=state_loop, daemon=True).start()
    print(f"FartBook bridge running: open http://localhost:{HTTP_PORT} in Safari")
    try:
        server = ThreadingHTTPServer(("127.0.0.1", HTTP_PORT), Handler)
    except OSError:
        print(f"FartBook is already running on http://localhost:{HTTP_PORT} (close the other terminal first, or just use it)")
        raise SystemExit(1)
    server.serve_forever()
