"""FartBook sensor server.

Reads the M2+ MacBook's hidden sensors with macimu 0.2.0 and streams every
sample to bridge.py over UDP on localhost (127.0.0.1:47474).

API verified against the macimu 0.2.0 source:
  IMU(accel=True, gyro=True, als=False, lid=False, sample_rate=None)  (needs root)
  read_accel() / read_gyro() -> list of Sample(x, y, z), ALL new samples since last call
  read_lid() -> degrees or None (None = no new reading)
  read_als() -> ALSReading(lux, channels) or None (None = no new reading)

Run:   sudo .venv/bin/python src/sensor_server.py
Probe: sudo .venv/bin/python src/sensor_server.py --probe
Fake:  python3 src/sensor_server.py --mock          (no sudo, no sensors)
"""
import json, math, os, socket, sys, time

ADDR = ("127.0.0.1", int(os.environ.get("FARTBOOK_UDP", 47474)))
RATE = 800          # Hz, native IMU rate: 1 sample = 1.25 ms, like a drum module scan
POLL = 0.002        # read the shared buffer every 2 ms; every sample is still sent


def finite(*vals):
    return all(v is not None and math.isfinite(v) for v in vals)


def run_mock(sock):
    print("MOCK mode: fake taps (alternating left/right) and a slowly moving lid. Ctrl+C to stop.")
    t0 = time.time()
    while True:
        t = time.time() - t0
        ax, ay, az, gx, gy, gz = 0.0, 0.0, -1.0, 0.0, 0.0, 0.0
        if t % 0.666 < 0.006:
            side = 1 if int(t / 0.666) % 2 else -1
            ax += 0.8 * side
            az -= 0.4
            gy += 2.0 * side
        sock.sendto(json.dumps({"t": time.time(), "a": [ax, ay, az], "g": [gx, gy, gz],
                                "lid": 100 + 20 * math.sin(t * 0.7), "light": 300.0}).encode(), ADDR)
        time.sleep(1.0 / RATE)


def main():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    if "--mock" in sys.argv:
        run_mock(sock)
        return
    try:
        from macimu import IMU
    except ImportError:
        print("macimu not installed. Run ./scripts/setup.sh first.")
        sys.exit(1)

    print("IMU available:", IMU.available())
    try:
        print("Device info:", IMU.device_info())
    except Exception as e:
        print("device_info failed:", e)

    with IMU(accel=True, gyro=True, lid=True, als=True, sample_rate=RATE) as imu:
        if "--probe" in sys.argv:
            time.sleep(0.5)
            print("effective sample rate:", imu.effective_sample_rate)
            print("accel samples in 0.5 s:", len(imu.read_accel()))
            print("gyro samples:", len(imu.read_gyro()))
            print("lid:", imu.read_lid(), "| als:", imu.read_als())
            return

        print(f"Streaming to {ADDR} at ~{RATE} Hz. Ctrl+C to stop.")
        lid = light = None
        while True:
            acc = imu.read_accel()
            gyr = imu.read_gyro()
            new_lid = imu.read_lid()
            if new_lid is not None and finite(new_lid):
                lid = float(new_lid)
            als = imu.read_als()
            if als is not None and finite(als.lux):
                light = float(als.lux)
            now = time.time()
            for i, a in enumerate(acc):                 # send every sample so no tap peak is missed
                if not finite(a.x, a.y, a.z):
                    continue
                g = gyr[i] if i < len(gyr) else None
                gv = [g.x, g.y, g.z] if g is not None and finite(g.x, g.y, g.z) else None
                sock.sendto(json.dumps({"t": now, "a": [a.x, a.y, a.z], "g": gv,
                                        "lid": lid, "light": light}).encode(), ADDR)
            time.sleep(POLL)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        pass
