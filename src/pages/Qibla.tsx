import { useEffect, useMemo, useRef, useState } from "react";

type LatLng = { lat: number; lng: number };

const KAABA: LatLng = { lat: 21.422487, lng: 39.826206 }; // Masjid al-Haram

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}
function toDeg(rad: number) {
  return (rad * 180) / Math.PI;
}

// Initial bearing from point A to point B
function bearing(from: LatLng, to: LatLng) {
  const φ1 = toRad(from.lat);
  const φ2 = toRad(to.lat);
  const Δλ = toRad(to.lng - from.lng);

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  const θ = Math.atan2(y, x);
  return (toDeg(θ) + 360) % 360;
}

function normalize360(v: number) {
  return (v % 360 + 360) % 360;
}

export default function Qibla() {
  const [loc, setLoc] = useState<LatLng | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [permissionHint, setPermissionHint] = useState<string | null>(null);

  const smoothingRef = useRef<number | null>(null);

  const qiblaBearing = useMemo(() => {
    if (!loc) return null;
    return bearing(loc, KAABA);
  }, [loc]);

  const relative = useMemo(() => {
    if (qiblaBearing == null || heading == null) return null;
    // how much to rotate the arrow so it points to qibla relative to phone heading
    return normalize360(qiblaBearing - heading);
  }, [qiblaBearing, heading]);

  async function requestOrientationPermissionIfNeeded() {
    // iOS Safari needs a user gesture permission call. Android usually does not.
    try {
      const anyDO = DeviceOrientationEvent as any;
      if (typeof anyDO?.requestPermission === "function") {
        const res = await anyDO.requestPermission();
        if (res !== "granted") {
          setPermissionHint("Orientation permission not granted.");
        } else {
          setPermissionHint(null);
        }
      }
    } catch (e: any) {
      setPermissionHint(e?.message || "Could not request orientation permission.");
    }
  }

  function startLocation() {
    setError(null);
    if (!("geolocation" in navigator)) {
      setError("Geolocation not available on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => {
        setError(err.message || "Location permission denied.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }

  useEffect(() => {
    startLocation();

    const handler = (ev: DeviceOrientationEvent) => {
      // Prefer absolute heading if available (iOS)
      // @ts-ignore
      const webkitHeading = (ev as any).webkitCompassHeading as number | undefined;

      let next: number | null = null;

      if (typeof webkitHeading === "number") {
        next = normalize360(webkitHeading);
      } else if (typeof ev.alpha === "number") {
        // alpha is 0 at north for some implementations; for others it’s relative.
        // This is still useful on many Android devices.
        next = normalize360(360 - ev.alpha);
      }

      if (next == null) return;

      // simple smoothing
      const prev = smoothingRef.current;
      const smooth = prev == null ? next : prev + (next - prev) * 0.15;
      smoothingRef.current = smooth;
      setHeading(normalize360(smooth));
    };

    window.addEventListener("deviceorientationabsolute", handler as any, true);
    window.addEventListener("deviceorientation", handler as any, true);

    return () => {
      window.removeEventListener("deviceorientationabsolute", handler as any, true);
      window.removeEventListener("deviceorientation", handler as any, true);
    };
  }, []);

  return (
    <div className="p-4 pb-24">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">Qibla</h1>
        <button
          onClick={() => {
            void requestOrientationPermissionIfNeeded();
            startLocation();
          }}
          className="px-3 py-2 rounded-lg border hover:bg-muted text-sm"
          type="button"
        >
          Enable Compass
        </button>
      </div>

      {permissionHint && (
        <div className="mt-3 text-sm text-amber-600">
          {permissionHint}
        </div>
      )}

      {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

      <div className="mt-6 flex items-center justify-center">
        <div className="relative w-64 h-64 rounded-full border bg-card flex items-center justify-center">
          {/* N marker */}
          <div className="absolute top-2 text-xs font-semibold">N</div>

          {/* Arrow to Qibla */}
          <div
            className="absolute w-2 h-24 origin-bottom rounded-full bg-primary"
            style={{
              transform: `rotate(${relative ?? 0}deg)`,
              transition: "transform 80ms linear",
            }}
            aria-label="Qibla direction"
          />

          {/* Center dot */}
          <div className="w-3 h-3 rounded-full bg-foreground/70" />
        </div>
      </div>

      <div className="mt-6 grid gap-2 text-sm text-muted-foreground">
        <div>Location: {loc ? `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}` : "…getting location"}</div>
        <div>Heading: {heading != null ? `${heading.toFixed(0)}°` : "…waiting for compass"}</div>
        <div>Qibla: {qiblaBearing != null ? `${qiblaBearing.toFixed(0)}°` : "…calculating"}</div>
      </div>

      <div className="mt-6 text-xs text-muted-foreground">
        Tip: If the arrow is unstable, move the phone in a figure-8 motion to calibrate the magnetometer.
      </div>
    </div>
  );
}