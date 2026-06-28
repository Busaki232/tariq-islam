import { Play, Pause, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";

interface PlaybackControlsProps {
  isPlaying: boolean;
  isLoading: boolean;
  progress: number;
  duration: number;
  volume: number;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
}

const PlaybackControls = ({
  isPlaying,
  isLoading,
  progress,
  duration,
  volume,
  onPlayPause,
  onSeek,
  onVolumeChange,
}: PlaybackControlsProps) => {
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      {/* Play/Pause Button */}
<div className="flex flex-col items-center gap-2">
  <Button
    size="lg"
    onClick={onPlayPause}
    disabled={isLoading || !duration}
    className="
      h-16 w-16 md:h-16 md:w-16
      rounded-full
      touch-manipulation
      bg-islamic-green
      hover:bg-islamic-green/90
      active:bg-islamic-green/80
      text-white
      shadow-lg
      active:scale-95
      transition-all
      duration-300
      disabled:opacity-50
    "
    style={{
      WebkitTapHighlightColor: 'rgba(0,0,0,0)',
      WebkitTouchCallout: 'none',
      touchAction: 'manipulation'
    }}
  >
    {isLoading ? (
      <div className="h-6 w-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
    ) : isPlaying ? (
      <Pause className="h-6 w-6 text-white" />
    ) : (
      <Play className="h-6 w-6 ml-1 text-white" />
    )}
  </Button>
        {!duration && !isLoading && (
          <p className="text-xs text-muted-foreground">
            Select a Surah to begin
          </p>
        )}
        {isLoading && (
          <p className="text-xs text-muted-foreground animate-pulse">
            Loading audio...
          </p>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <Slider
          value={[progress]}
          max={duration || 100}
          step={1}
          onValueChange={([value]) => onSeek(value)}
          className="cursor-pointer"
          disabled={!duration}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>{formatTime(progress)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Volume Control */}
      <div className="flex items-center gap-3">
<Button
  variant="ghost"
  size="icon"
  onClick={() => onVolumeChange(volume > 0 ? 0 : 1)}
  className="touch-manipulation active:opacity-70"
  style={{
    WebkitTapHighlightColor: 'rgba(0,0,0,0)',
    WebkitTouchCallout: 'none',
    touchAction: 'manipulation'
  }}
>
  {volume === 0 ? (
    <VolumeX className="h-4 w-4" />
  ) : (
    <Volume2 className="h-4 w-4" />
  )}
</Button>
        <Slider
          value={[volume * 100]}
          max={100}
          step={1}
          onValueChange={([value]) => onVolumeChange(value / 100)}
          className="flex-1"
        />
      </div>
    </div>
  );
};

export default PlaybackControls;
