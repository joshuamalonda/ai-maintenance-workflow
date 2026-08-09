import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

function fmt(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function CallRecordingPlayer({
  src,
  fallbackDuration,
}: {
  src: string;
  fallbackDuration?: number | null;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState<number>(fallbackDuration ?? 0);

  useEffect(() => {
    setPlaying(false);
    setCurrent(0);
  }, [src]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  const progress = duration > 0 ? Math.min(100, (current / duration) * 100) : 0;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/60 px-3 py-2.5">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause recording" : "Play recording"}
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90"
      >
        {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
      </button>

      <div className="min-w-0 flex-1">
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          className="h-1.5 w-full overflow-hidden rounded-full bg-border"
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[10px] tracking-wider text-muted-foreground">
          <span>{fmt(current)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>

      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        className="hidden"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
      />
    </div>
  );
}