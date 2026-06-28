import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Compass, Navigation } from "lucide-react";
import { calculateQiblaBearing, getCompassDirection, formatQiblaDirection } from "@/lib/qibla";

interface QiblaCompassProps {
  latitude: number;
  longitude: number;
}

const QiblaCompass = ({ latitude, longitude }: QiblaCompassProps) => {
  const [bearing, setBearing] = useState(0);
  const [deviceHeading, setDeviceHeading] = useState(0);
  const [compassSupported, setCompassSupported] = useState(true);

  useEffect(() => {
    // Calculate Qibla bearing
    const qiblaBearing = calculateQiblaBearing(latitude, longitude);
    setBearing(qiblaBearing);

    // Try to get device orientation if supported
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        // Alpha gives the compass heading (0-360)
        setDeviceHeading(360 - event.alpha);
      }
    };

    if ('DeviceOrientationEvent' in window) {
      // Request permission for iOS 13+
      if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
        (DeviceOrientationEvent as any).requestPermission()
          .then((permissionState: string) => {
            if (permissionState === 'granted') {
              window.addEventListener('deviceorientation', handleOrientation);
            } else {
              setCompassSupported(false);
            }
          })
          .catch(() => setCompassSupported(false));
      } else {
        // Non-iOS devices
        window.addEventListener('deviceorientation', handleOrientation);
      }
    } else {
      setCompassSupported(false);
    }

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation);
    };
  }, [latitude, longitude]);

  // Calculate the needle rotation (relative to device heading)
  const needleRotation = compassSupported ? bearing - deviceHeading : bearing;
  const compassDirection = getCompassDirection(bearing);
  const formattedDirection = formatQiblaDirection(bearing);

  return (
    <Card className="bg-gradient-to-br from-background to-secondary/30 border-primary/20 shadow-islamic">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-center justify-center">
          <Compass className="h-5 w-5 text-primary" />
          Qibla Compass
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-6 pb-8">
        {/* Compass Container */}
        <div className="relative w-64 h-64">
          {/* Outer Circle - Compass Face */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 border-4 border-primary/30 shadow-lg">
            {/* Direction Markers */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative w-full h-full">
                {/* N, E, S, W markers */}
                <div className="absolute top-2 left-1/2 -translate-x-1/2 text-sm font-bold text-primary">
                  N
                </div>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                  E
                </div>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-sm font-bold text-muted-foreground">
                  S
                </div>
                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-sm font-bold text-muted-foreground">
                  W
                </div>
              </div>
            </div>

            {/* Degree Markers */}
            {Array.from({ length: 36 }).map((_, i) => {
              const angle = i * 10;
              const isMainDirection = angle % 90 === 0;
              const isMidDirection = angle % 45 === 0 && !isMainDirection;
              
              return (
                <div
                  key={i}
                  className="absolute top-1/2 left-1/2 origin-left"
                  style={{
                    transform: `rotate(${angle}deg)`,
                    width: '50%',
                  }}
                >
                  <div
                    className={`absolute right-0 ${
                      isMainDirection
                        ? 'w-1 h-4 bg-primary'
                        : isMidDirection
                        ? 'w-0.5 h-3 bg-primary/70'
                        : 'w-0.5 h-2 bg-muted-foreground/40'
                    }`}
                    style={{ transform: 'translateY(-50%)' }}
                  />
                </div>
              );
            })}
          </div>

          {/* Center Circle */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full bg-gradient-primary shadow-islamic flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-white" />
            </div>
          </div>

          {/* Qibla Needle */}
          <div
            className="absolute top-1/2 left-1/2 origin-bottom transition-transform duration-500 ease-out"
            style={{
              transform: `translate(-50%, -100%) rotate(${needleRotation}deg)`,
              height: '45%',
            }}
          >
            {/* Needle pointing to Qibla */}
            <div className="relative w-0 h-0">
              <Navigation
                className="absolute -translate-x-1/2 text-islamic-gold drop-shadow-lg"
                size={32}
                fill="hsl(var(--islamic-gold))"
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))' }}
              />
            </div>
          </div>
        </div>

        {/* Direction Info */}
        <div className="text-center space-y-2">
          <div className="text-2xl font-bold text-primary">
            {formattedDirection}
          </div>
          <div className="text-sm text-muted-foreground">
            Face {compassDirection} towards the Kaaba
          </div>
          {!compassSupported && (
            <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 mt-3">
              Device compass not available. Showing static direction.
            </div>
          )}
          {compassSupported && (
            <div className="text-xs text-primary bg-primary/10 rounded-lg px-3 py-2 mt-3">
              ✓ Live compass active - rotate your device
            </div>
          )}
        </div>

        {/* Kaaba Icon Indicator */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className="w-6 h-6 rounded bg-islamic-gold/20 flex items-center justify-center">
            🕋
          </div>
          <span>Direction to Mecca</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default QiblaCompass;
