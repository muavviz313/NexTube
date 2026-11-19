import { Maximize2, Pause, Play, X } from 'lucide-react';
import type { VideoItem } from '../types/nextube';
import { MediaImage } from './MediaImage';

interface MiniPlayerProps {
  video: VideoItem;
  isPlaying: boolean;
  progressPct: number;
  onTogglePlay: () => void;
  onExpand: () => void;
  onClose: () => void;
}

export function MiniPlayer({
  video,
  isPlaying,
  progressPct,
  onTogglePlay,
  onExpand,
  onClose,
}: MiniPlayerProps) {
  return (
    <div className="fixed bottom-20 sm:bottom-5 right-3 sm:right-5 left-3 sm:left-auto sm:w-88 z-40 rounded-2xl bg-white/95 dark:bg-[#161619]/95 backdrop-blur-xl border border-zinc-200 dark:border-white/15 shadow-2xl overflow-hidden">
      <div className="h-0.5 w-full bg-zinc-200 dark:bg-white/10">
        <div
          className="h-full bg-[var(--nextube-accent)] transition-all duration-150"
          style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
        />
      </div>

      <div className="p-2.5 flex items-center gap-3">
        <button
          type="button"
          onClick={onExpand}
          className="flex items-center gap-3 min-w-0 flex-1 text-left"
        >
          <MediaImage
            src={video.thumbnailUrl}
            alt={video.title}
            className="w-16 aspect-video rounded-lg object-cover shrink-0"
          />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold truncate">{video.title}</p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
              {video.channelTitle}
            </p>
          </div>
        </button>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause mini player' : 'Play mini player'}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-white/10"
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={onExpand}
            aria-label="Expand mini player"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-zinc-100 dark:hover:bg-white/10"
          >
            <Maximize2 className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close mini player"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
