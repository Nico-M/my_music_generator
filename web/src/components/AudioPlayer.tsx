'use client';

import { useRef, useEffect, useCallback } from 'react';
import { useEditorStore } from '@/lib/store';
import { Play, Pause } from 'lucide-react';

interface AudioPlayerProps {
  audioUrl: string;
}

export default function AudioPlayer({ audioUrl }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const { currentTimeMs, isPlaying, setCurrentTimeMs, setIsPlaying } = useEditorStore();

  const handleTimeUpdate = useCallback(() => {
    if (audioRef.current) setCurrentTimeMs(Math.round(audioRef.current.currentTime * 1000));
  }, [setCurrentTimeMs]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) return;
    if (audioRef.current.paused) { audioRef.current.play(); setIsPlaying(true); }
    else { audioRef.current.pause(); setIsPlaying(false); }
  }, [setIsPlaying]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
      if (e.code === 'ArrowLeft' && audioRef.current) {
        audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 3);
        setCurrentTimeMs(Math.round(audioRef.current.currentTime * 1000));
      }
      if (e.code === 'ArrowRight' && audioRef.current) {
        audioRef.current.currentTime = Math.min(audioRef.current.duration, audioRef.current.currentTime + 3);
        setCurrentTimeMs(Math.round(audioRef.current.currentTime * 1000));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, setCurrentTimeMs]);

  const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms / 1000) % 60)).padStart(2, '0')}`;

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: 'var(--color-surface-2)', border: '1px solid var(--color-border)' }}>
      <audio ref={audioRef} src={audioUrl} onTimeUpdate={handleTimeUpdate} onEnded={() => setIsPlaying(false)} preload="auto" />

      <button
        onClick={togglePlay}
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors"
        style={{ background: 'var(--color-primary)', color: '#fff' }}
        title="Play/Pause (Space)"
      >
        {isPlaying ? <Pause className="w-3.5 h-3.5" fill="currentColor" /> : <Play className="w-3.5 h-3.5 ml-0.5" fill="currentColor" />}
      </button>

      <span className="text-xs font-mono" style={{ color: 'var(--color-text)' }}>{fmt(currentTimeMs)}</span>

      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-border)' }}>
        <div
          className="h-full rounded-full transition-all duration-100"
          style={{
            width: audioRef.current?.duration ? `${(currentTimeMs / 1000 / audioRef.current.duration) * 100}%` : '0%',
            background: 'var(--color-primary)',
          }}
        />
      </div>
    </div>
  );
}
