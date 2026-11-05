import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Loader2, Mic, Volume2 } from 'lucide-react';

interface VoiceNotePlayerProps {
  text: string;
  advisorName?: string;
  leadName?: string;
  className?: string;
}

// Deterministic waveform bar heights (28 bars)
const WAVEFORM_BARS = [
  30, 45, 60, 25, 70, 85, 40, 55, 90, 65,
  45, 80, 100, 75, 50, 85, 60, 40, 75, 90,
  65, 50, 70, 40, 55, 35, 45, 30,
];

export function VoiceNotePlayer({
  text,
  advisorName = 'Rahul',
  leadName,
  className = '',
}: VoiceNotePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const fetchAudioAndPlay = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch('/api/voice/notes/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          text,
          advisorName,
          leadName,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to synthesize voice: HTTP ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);

      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.playbackRate = speed;
        await audioRef.current.play();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('[VoiceNotePlayer] Playback error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePlay = async () => {
    if (!audioUrl) {
      await fetchAudioAndPlay();
      return;
    }

    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = speed;
      await audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (audioRef.current.duration && !isNaN(audioRef.current.duration)) {
        setDuration(audioRef.current.duration);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && audioRef.current.duration) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setCurrentTime(0);
  };

  const handleCycleSpeed = () => {
    const nextSpeed = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const handleSeek = (index: number) => {
    if (!audioRef.current || !duration) return;
    const fraction = index / WAVEFORM_BARS.length;
    const seekTime = fraction * duration;
    audioRef.current.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  const formatSeconds = (sec: number) => {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progressFraction = duration > 0 ? currentTime / duration : 0;

  return (
    <div
      className={`rounded-2xl bg-emerald-950/70 border border-emerald-500/30 p-3 shadow-md max-w-sm text-white select-none ${className}`}
    >
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* Header Info */}
      <div className="flex items-center justify-between text-[10px] text-emerald-300 font-medium mb-2 px-1">
        <span className="flex items-center gap-1.5">
          <Volume2 className="h-3 w-3 text-emerald-400" />
          <span>Cloned Voice Memo &bull; {advisorName}</span>
        </span>
        <span className="text-[9px] font-mono bg-emerald-500/20 px-1.5 py-0.2 rounded border border-emerald-500/30 text-emerald-200">
          OGG-OPUS
        </span>
      </div>

      {/* Main Player Row */}
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={handleTogglePlay}
          disabled={loading}
          className="h-10 w-10 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 flex items-center justify-center shrink-0 transition-transform active:scale-95 shadow-md cursor-pointer disabled:opacity-50"
          title={isPlaying ? 'Pause voice memo' : 'Play cloned voice memo'}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isPlaying ? (
            <Pause className="h-5 w-5 fill-current" />
          ) : (
            <Play className="h-5 w-5 fill-current ml-0.5" />
          )}
        </button>

        {/* Interactive Waveform Display */}
        <div className="flex-1 flex flex-col justify-center gap-1">
          <div className="flex items-center gap-[3px] h-7 cursor-pointer" title="Click to seek">
            {WAVEFORM_BARS.map((heightPercent, idx) => {
              const barFraction = idx / WAVEFORM_BARS.length;
              const isPlayed = barFraction <= progressFraction;

              return (
                <span
                  key={idx}
                  onClick={() => handleSeek(idx)}
                  className={`w-1 rounded-full transition-all duration-150 ${
                    isPlayed
                      ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
                      : 'bg-emerald-800/60 hover:bg-emerald-700'
                  }`}
                  style={{
                    height: `${heightPercent}%`,
                    transform: isPlaying && isPlayed ? 'scaleY(1.15)' : 'scaleY(1)',
                  }}
                />
              );
            })}
          </div>

          {/* Time & Speed Controls */}
          <div className="flex items-center justify-between text-[11px] font-mono text-emerald-300/80 px-0.5">
            <span>
              {formatSeconds(currentTime)} {duration > 0 && `/ ${formatSeconds(duration)}`}
            </span>
            <button
              type="button"
              onClick={handleCycleSpeed}
              className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 border border-emerald-700/60 transition-colors"
            >
              {speed}x
            </button>
          </div>
        </div>

        {/* WhatsApp Voice Microphone Icon */}
        <div className="h-8 w-8 rounded-full bg-emerald-900/60 border border-emerald-500/30 flex items-center justify-center shrink-0 text-emerald-400">
          <Mic className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
