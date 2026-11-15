"""FartBook trackpad reader: turns the real trackpad into 8 pads.

Reads raw finger positions from macOS's built-in MultitouchSupport framework
(the same private framework TrackpadOSC, OpenMultitouchSupport and
TrackWeight use) and sends them to the bridge over UDP:

  {"tp": "down", "id": 3, "x": 0.12, "y": 0.81, "size": 0.9}   finger landed
  {"tp": "move", "f": [[id, x, y], ...]}                        ~30 Hz, for the on-screen dot
  {"tp": "up",   "id": 3}

x and y are 0..1 across the trackpad, (0, 0) = bottom left, (1, 1) = top right.
The browser decides which of the 8 squares a "down" lands in.

Standard library only, no sudo.  Run:  python3 src/trackpad_server.py
Test without the app:                  python3 src/trackpad_server.py --print
"""
import ctypes, ctypes.util, json, os, socket, sys, threading, time

UDP_ADDR = ("127.0.0.1", int(os.environ.get("FARTBOOK_UDP", 47474)))
MAX_SIZE = float(os.environ.get("FARTBOOK_PALM_SIZE", 1.5))   # contacts bigger than this are a palm, ignored (M4: fingers 0.3 to 1.0, palm 1.8)
PRINT = "--print" in sys.argv

FRAMEWORK = "/System/Library/PrivateFrameworks/MultitouchSupport.framework/MultitouchSupport"


class MTPoint(ctypes.Structure):
    _fields_ = [("x", ctypes.c_float), ("y", ctypes.c_float)]


class MTReadout(ctypes.Structure):
    _fields_ = [("pos", MTPoint), ("vel", MTPoint)]


class Finger(ctypes.Structure):          # layout used by every open-source reader of this framework
    _fields_ = [
        ("frame", ctypes.c_int),
        ("timestamp", ctypes.c_double),
        ("identifier", ctypes.c_int),
        ("state", ctypes.c_int),          # 4 = touch begins, 5 = touching, 6 = touch ends, 7 = lingering
        ("finger_id", ctypes.c_int),
        ("hand_id", ctypes.c_int),
        ("normalized", MTReadout),        # position 0..1
        ("size", ctypes.c_float),         # contact area: light tap ~0.3, firm ~1.5, palm > 2.5
        ("zero1", ctypes.c_int),
        ("angle", ctypes.c_float),
        ("major_axis", ctypes.c_float),
        ("minor_axis", ctypes.c_float),
        ("mm", MTReadout),
        ("zero2", ctypes.c_int * 2),
        ("unk2", ctypes.c_float),
    ]


CALLBACK = ctypes.CFUNCTYPE(ctypes.c_int, ctypes.c_void_p, ctypes.POINTER(Finger),
                            ctypes.c_int, ctypes.c_double, ctypes.c_int)

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
touching = {}            # identifier -> (x, y) for fingers currently down
last_move = 0.0
lock = threading.Lock()


def send(msg):
    if PRINT and msg.get("tp") in ("down", "up"):     # only finger landings and lifts, so the screen stays readable
        if msg["tp"] == "down":
            col = min(3, int(msg["x"] * 4)) + 1
            row = "top" if msg["y"] >= 0.5 else "bottom"
            print(f"finger down  x={msg['x']:.2f} y={msg['y']:.2f}  size={msg['size']:.2f}  -> {row} row, square {col}", flush=True)
        else:
            print("finger up", flush=True)
    try:
        sock.sendto(json.dumps(msg).encode(), UDP_ADDR)
    except OSError:
        pass


def on_frame(device, data, n, timestamp, frame):
    global last_move
    try:
        now = time.time()
        seen = set()
        with lock:
            for i in range(n):
                f = data[i]
                fid, st = f.identifier, f.state
                x, y = f.normalized.pos.x, f.normalized.pos.y
                if st in (4, 5) and f.size <= MAX_SIZE:
                    seen.add(fid)
                    if fid not in touching:
                        send({"tp": "down", "id": fid, "x": round(x, 4), "y": round(y, 4),
                              "size": round(f.size, 3)})
                    touching[fid] = (round(x, 4), round(y, 4))
            for fid in [k for k in touching if k not in seen]:
                del touching[fid]
                send({"tp": "up", "id": fid})
            if now - last_move > 1 / 30:
                last_move = now
                send({"tp": "move", "f": [[k, x, y] for k, (x, y) in touching.items()]})
    except Exception as e:           # never let an exception escape into the framework's thread
        print("frame error:", e, file=sys.stderr)
    return 0


def main():
    # Since macOS 11, system frameworks live in the dyld shared cache, so the file is not on disk:
    # dlopen still finds it by path. Only give up if dlopen itself fails.
    if sys.platform != "darwin":
        sys.exit("The trackpad reader only runs on macOS.")
    try:
        mt = ctypes.CDLL(FRAMEWORK)
    except OSError as e:
        sys.exit(f"Could not load MultitouchSupport: {e}")
    mt.MTDeviceCreateDefault.restype = ctypes.c_void_p
    mt.MTRegisterContactFrameCallback.argtypes = [ctypes.c_void_p, CALLBACK]
    mt.MTDeviceStart.argtypes = [ctypes.c_void_p, ctypes.c_int]
    mt.MTDeviceStop.argtypes = [ctypes.c_void_p]
    dev = mt.MTDeviceCreateDefault()
    if not dev:
        sys.exit("No built-in trackpad found.")
    cb = CALLBACK(on_frame)           # keep a reference or Python frees it and the app crashes
    mt.MTRegisterContactFrameCallback(dev, cb)
    mt.MTDeviceStart(dev, 0)
    print(f"Trackpad live -> UDP {UDP_ADDR[0]}:{UDP_ADDR[1]}. Touch the trackpad. Ctrl+C to stop.", flush=True)
    try:
        while True:
            time.sleep(1)
            send({"tp": "alive"})
    except KeyboardInterrupt:
        pass
    finally:
        mt.MTDeviceStop(dev)


if __name__ == "__main__":
    main()
