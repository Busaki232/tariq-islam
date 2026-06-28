import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { RotateCcw, Minus, Vibrate } from "lucide-react";
import { Capacitor } from "@capacitor/core";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

const DHIKR_OPTIONS = [
  { value: "subhanallah", label: "SubhanAllah", arabic: "سُبْحَانَ اللَّهِ", defaultTarget: 33 },
  { value: "alhamdulillah", label: "Alhamdulillah", arabic: "الْحَمْدُ لِلَّهِ", defaultTarget: 33 },
  { value: "allahuakbar", label: "Allahu Akbar", arabic: "اللَّهُ أَكْبَرُ", defaultTarget: 34 },
  { value: "lailaha", label: "La ilaha illa Allah", arabic: "لَا إِلَٰهَ إِلَّا اللَّهُ", defaultTarget: 100 },
  { value: "astaghfirullah", label: "Astaghfirullah", arabic: "أَسْتَغْفِرُ اللَّهَ", defaultTarget: 100 },
];

const PRESET_TARGETS = [33, 99, 100];
const STORAGE_KEY = "tasbih_state_v2";

const TAP_SPEEDS = [
  { value: "slow", label: "Slow", ms: 260 },
  { value: "normal", label: "Normal", ms: 150 },
  { value: "fast", label: "Fast", ms: 60 },
] as const;

type TapSpeedValue = (typeof TAP_SPEEDS)[number]["value"];

interface TasbihState {
  selectedDhikr: string;
  count: number;
  target: number;
  vibrationEnabled: boolean;
  tapSpeed: TapSpeedValue;
}

function clampInt(n: any, fallback: number) {
  const x = Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.floor(x));
}

function safeState(raw: any): TasbihState {
  const selectedDhikr =
    typeof raw?.selectedDhikr === "string" && DHIKR_OPTIONS.some((d) => d.value === raw.selectedDhikr)
      ? raw.selectedDhikr
      : "subhanallah";

  const defaultTarget = DHIKR_OPTIONS.find((d) => d.value === selectedDhikr)?.defaultTarget ?? 33;

  const target = clampInt(raw?.target, defaultTarget);
  const count = clampInt(raw?.count, 0);

  const tapSpeed: TapSpeedValue =
    raw?.tapSpeed === "slow" || raw?.tapSpeed === "normal" || raw?.tapSpeed === "fast"
      ? raw.tapSpeed
      : "normal";

  return {
    selectedDhikr,
    count,
    target: target > 0 ? target : defaultTarget,
    vibrationEnabled: typeof raw?.vibrationEnabled === "boolean" ? raw.vibrationEnabled : true,
    tapSpeed,
  };
}

function loadInitial(): TasbihState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return safeState(JSON.parse(saved));
  } catch {}
  return safeState(null);
}

function tapCooldownMs(speed: TapSpeedValue) {
  return TAP_SPEEDS.find((s) => s.value === speed)?.ms ?? 150;
}

const BEAD_COUNT = 33;
const RING_SIZE = 280;
const CENTER = RING_SIZE / 2;
const RADIUS = 102;

function getBeadPosition(index: number) {
  const startAngle = -Math.PI / 2;
  const angle = startAngle + (index / BEAD_COUNT) * Math.PI * 2;
  return {
    left: CENTER + RADIUS * Math.cos(angle),
    top: CENTER + RADIUS * Math.sin(angle),
  };
}

export default function Tasbih() {
  const [state, setState] = useState<TasbihState>(loadInitial);
  const [customTarget, setCustomTarget] = useState("");
  const [tapProof, setTapProof] = useState(0);

  const lastTapAtRef = useRef<number>(0);
const audioRef = useRef<HTMLAudioElement | null>(null);
  const dhikrInfo = useMemo(
    () => DHIKR_OPTIONS.find((d) => d.value === state.selectedDhikr),
    [state.selectedDhikr]
  );

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(safeState(state)));
    } catch {}
  }, [state]);

useEffect(() => {
  audioRef.current = new Audio("/sounds/tasbih-click.mp3");
}, []);

  const isCompleted = state.target > 0 && state.count >= state.target;
  const progressPercent = state.target > 0 ? Math.min((state.count / state.target) * 100, 100) : 0;
  const currentCycleCount = state.count % BEAD_COUNT;
  const fullCycles = Math.floor(state.count / BEAD_COUNT);

  const doHapticTap = async (kind: "tap" | "complete" | "warn" = "tap") => {
    if (!state.vibrationEnabled) return;

    try {
      if (Capacitor.isNativePlatform()) {
        if (kind === "complete") {
          await Haptics.notification({ type: NotificationType.Success });
        } else if (kind === "warn") {
          await Haptics.notification({ type: NotificationType.Warning });
        } else {
          await Haptics.impact({ style: ImpactStyle.Light });
        }
        return;
      }

      if (typeof navigator !== "undefined" && (navigator as any).vibrate) {
        (navigator as any).vibrate(kind === "complete" ? [120, 40, 120] : 25);
      }
    } catch {}
  };
const playClick = () => {
  if (!audioRef.current) return;

  audioRef.current.currentTime = 0;
  audioRef.current.volume = 0.3;
  audioRef.current.play().catch(() => {});
};
  const increment = () => {
    const now = Date.now();
    const cooldown = tapCooldownMs(state.tapSpeed);

    if (now - lastTapAtRef.current < cooldown) return;
    lastTapAtRef.current = now;

    setTapProof((p) => p + 1);

    setState((prev) => {
      const safe = safeState(prev);
      if (safe.target <= 0) return { ...safe, target: 33 };
      if (safe.count >= safe.target) return safe;

      const next = safe.count + 1;
      void doHapticTap(next >= safe.target ? "complete" : "tap");
      playClick();
      return { ...safe, count: next };
    });
  };

  const decrement = () => {
    void doHapticTap("tap");
    setState((prev) => {
      const safe = safeState(prev);
      return { ...safe, count: Math.max(0, safe.count - 1) };
    });
  };

  const reset = () => {
    void doHapticTap("tap");
    setState((prev) => ({ ...safeState(prev), count: 0 }));
  };

  const hardReset = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setCustomTarget("");
    setTapProof(0);
    lastTapAtRef.current = 0;
    setState(safeState(null));
  };

  const handleDhikrChange = (value: string) => {
    const dhikr = DHIKR_OPTIONS.find((d) => d.value === value);
    setState((prev) => ({
      ...safeState(prev),
      selectedDhikr: value,
      count: 0,
      target: dhikr?.defaultTarget || 33,
    }));
    setCustomTarget("");
    lastTapAtRef.current = 0;
  };

  const setPresetTarget = (target: number) => {
    setState((prev) => ({ ...safeState(prev), target, count: 0 }));
    setCustomTarget("");
    lastTapAtRef.current = 0;
  };

  const applyCustomTarget = () => {
    const num = parseInt(customTarget, 10);
    if (Number.isFinite(num) && num > 0) {
      setState((prev) => ({ ...safeState(prev), target: num, count: 0 }));
      lastTapAtRef.current = 0;
    } else {
      void doHapticTap("warn");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 pb-24">
      <div className="container mx-auto px-4 py-8 max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-foreground mb-2">Tasbih</h1>
          <p className="text-muted-foreground">Digital Dhikr Counter</p>
          <p className="text-xs text-muted-foreground mt-2">Tap proof: {tapProof}</p>
        </div>

        <Card className="mb-4">
          <CardContent className="pt-4">
            <Label htmlFor="dhikr-select" className="text-sm font-medium mb-2 block">
              Select Dhikr
            </Label>
            <Select value={state.selectedDhikr} onValueChange={handleDhikrChange}>
              <SelectTrigger id="dhikr-select" className="w-full">
                <SelectValue placeholder="Select a dhikr" />
              </SelectTrigger>
              <SelectContent className="bg-popover border border-border shadow-lg z-50">
                {DHIKR_OPTIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    <span className="flex items-center gap-2">
                      <span>{d.label}</span>
                      <span className="text-muted-foreground text-xs">({d.defaultTarget})</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {dhikrInfo && (
              <div className="mt-3 text-center">
                <p className="text-2xl font-arabic text-primary" dir="rtl">
                  {dhikrInfo.arabic}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardContent className="pt-4 space-y-4">
            <div>
              <Label className="text-sm font-medium mb-2 block">Tap Speed</Label>
              <Select
                value={state.tapSpeed}
                onValueChange={(v) =>
                  setState((prev) => ({ ...safeState(prev), tapSpeed: v as TapSpeedValue }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select speed" />
                </SelectTrigger>
                <SelectContent className="bg-popover border border-border shadow-lg z-50">
                  {TAP_SPEEDS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-2">
                Slower speed reduces accidental double taps.
              </p>
            </div>

            <div>
              <Label className="text-sm font-medium mb-3 block">Target Count</Label>
              <div className="flex gap-2 mb-3">
                {PRESET_TARGETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant={state.target === preset ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPresetTarget(preset)}
                  >
                    {preset}
                  </Button>
                ))}
              </div>

              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Custom"
                  value={customTarget}
                  onChange={(e) => setCustomTarget(e.target.value)}
                  className="flex-1"
                  min={1}
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={applyCustomTarget}
                  disabled={!customTarget || parseInt(customTarget, 10) <= 0}
                >
                  Set
                </Button>
              </div>

              <div className="mt-3 flex justify-center">
                <Button type="button" variant="outline" size="sm" onClick={hardReset}>
                  Hard Reset
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-muted-foreground">Progress</span>
              <span className={`text-sm font-bold ${isCompleted ? "text-green-600" : "text-foreground"}`}>
                {state.count} / {state.target}
              </span>
            </div>
            <Progress value={progressPercent} className="h-3" />
            {isCompleted && (
              <p className="text-center text-green-600 font-medium mt-2 text-sm">
                ✓ Target completed! MashaAllah!
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="mb-4 relative z-20 pointer-events-auto overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.05] via-background to-secondary/20">
          <CardContent className="p-6">
            <div className="flex flex-col items-center">
              <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
                <div className="absolute inset-0 rounded-full border border-primary/10 bg-gradient-to-br from-primary/[0.04] to-transparent" />

                {Array.from({ length: BEAD_COUNT }).map((_, i) => {
                  const pos = getBeadPosition(i);
                  const active = i < currentCycleCount;
                  const separator = (i + 1) % 11 === 0;

                  return (
                    <div
                      key={i}
                      className="absolute rounded-full transition-all duration-200"
                      style={{
                        left: pos.left,
                        top: pos.top,
                        width: separator ? 18 : 16,
                        height: separator ? 18 : 16,
                        transform: "translate(-50%, -50%)",
                        background: active
                          ? "radial-gradient(circle at 30% 30%, #fde68a 0%, #facc15 35%, #ca8a04 100%)"
                          : separator
                            ? "radial-gradient(circle at 30% 30%, #86efac 0%, #22c55e 40%, #166534 100%)"
                            : "radial-gradient(circle at 30% 30%, #4ade80 0%, #16a34a 40%, #14532d 100%)",
                        boxShadow: active
                          ? "inset -2px -2px 5px rgba(0,0,0,0.22), inset 2px 2px 4px rgba(255,255,255,0.25), 0 4px 10px rgba(250,204,21,0.35)"
                          : "inset -2px -2px 5px rgba(0,0,0,0.28), inset 2px 2px 4px rgba(255,255,255,0.12), 0 3px 7px rgba(0,0,0,0.12)",
                      }}
                    />
                  );
                })}

                <button
                  type="button"
                  onPointerDown={(e) => {
                    e.preventDefault();
                    increment();
                  }}
                  className={`absolute left-1/2 top-1/2 flex h-36 w-36 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full transition-all active:scale-[0.98] touch-manipulation select-none ${
                    isCompleted
                      ? ""
                      : ""
                  }`}
                  style={{
                    background: isCompleted
                      ? "radial-gradient(circle at 30% 30%, #86efac 0%, #22c55e 45%, #166534 100%)"
                      : "radial-gradient(circle at 30% 30%, #fde68a 0%, #facc15 35%, #ca8a04 100%)",
                    boxShadow:
                      "inset 0 8px 14px rgba(255,255,255,0.22), inset 0 -10px 18px rgba(0,0,0,0.18), 0 12px 28px rgba(0,0,0,0.18)",
                  }}
                  aria-label="Tap to count"
                >
                  <span className={`text-6xl font-bold mb-2 ${isCompleted ? "text-white" : "text-[#14532d]"}`}>
                    {state.count}
                  </span>
                  <span className={`text-xs font-medium tracking-wide ${isCompleted ? "text-white/90" : "text-[#14532d]/80"}`}>
                    {isCompleted ? "Completed" : "Tap to count"}
                  </span>
                </button>
              </div>

              <div className="mt-4 flex w-full items-center justify-between rounded-xl border border-border/50 bg-background/70 px-4 py-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Cycle
                  </p>
                  <p className="text-lg font-semibold text-foreground">
                    {currentCycleCount} / {BEAD_COUNT}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Full cycles
                  </p>
                  <p className="text-lg font-semibold text-foreground">{fullCycles}</p>
                </div>
              </div>

              <p className="mt-3 text-sm text-muted-foreground">
                {isCompleted ? "🎉 Target reached! Reset to continue" : "Tap the center bead to continue your dhikr"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="flex gap-3 justify-center">
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={decrement}
                disabled={state.count === 0}
                className="flex-1 max-w-[100px]"
              >
                <Minus className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="lg"
                onClick={reset}
                className="flex-1 max-w-[100px]"
              >
                <RotateCcw className="h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Vibrate className="h-5 w-5 text-muted-foreground" />
                <Label htmlFor="vibration-toggle" className="text-sm font-medium cursor-pointer">
                  Vibration Feedback
                </Label>
              </div>
              <Switch
                id="vibration-toggle"
                checked={state.vibrationEnabled}
                onCheckedChange={(enabled) =>
                  setState((prev) => ({ ...safeState(prev), vibrationEnabled: enabled }))
                }
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}