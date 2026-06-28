import { cn } from '@/lib/utils';

interface AudioWaveformProps {
  duration: number;
  progress?: number;
  isPlaying?: boolean;
  className?: string;
}

export const AudioWaveform = ({ 
  duration, 
  progress = 0, 
  isPlaying = false,
  className 
}: AudioWaveformProps) => {
  // Generate consistent bars based on duration
  const barCount = 30;
  const bars = Array.from({ length: barCount }, (_, i) => {
    const seed = (duration * 100 + i) % 100;
    return 20 + (seed % 60);
  });

  return (
    <div className={cn("flex items-center gap-0.5 h-8", className)}>
      {bars.map((height, index) => {
        const isPast = progress > 0 && (index / barCount) <= progress;
        return (
          <div
            key={index}
            className={cn(
              "w-1 rounded-full transition-all duration-150",
              isPast 
                ? "bg-primary" 
                : "bg-muted-foreground/30",
              isPlaying && isPast && "animate-pulse"
            )}
            style={{ height: `${height}%` }}
          />
        );
      })}
    </div>
  );
};
