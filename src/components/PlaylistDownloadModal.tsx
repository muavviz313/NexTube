import { useEffect, useState } from 'react';
import { CheckCircle2, Download, ListVideo, Smartphone, X } from 'lucide-react';
import type {
  DownloadProgressState,
  DownloadQuality,
  PlaylistSummary,
  VideoItem,
} from '../types/nextube';
import { estimateSizeLabel } from '../services/offlineStore';
import { MediaImage } from './MediaImage';

interface PlaylistDownloadModalProps {
  playlist: PlaylistSummary | null;
  videos: VideoItem[];
  onClose: () => void;
  onDownloadPlaylist: (
    playlist: PlaylistSummary,
    playlistVideos: VideoItem[],
    qualities: Record<string, DownloadQuality>,
    exportToGallery: boolean
  ) => Promise<void>;
  progressMap: Record<string, DownloadProgressState>;
  offlineVideoIds: Set<string>;
}

const QUALITIES: DownloadQuality[] = ['1080p', '720p', '480p', 'audio'];

export function PlaylistDownloadModal({
  playlist,
  videos,
  onClose,
  onDownloadPlaylist,
  progressMap,
  offlineVideoIds,
}: PlaylistDownloadModalProps) {
  const [qualities, setQualities] = useState<Record<string, DownloadQuality>>({});
  const [exportToGallery, setExportToGallery] = useState(false);
  const [isDownloadingAll, setIsDownloadingAll] = useState(false);

  const playlistVideos = playlist
    ? videos.filter((v) => playlist.videoIds.includes(v.id))
    : [];
  const effectiveVideos = playlistVideos.length > 0 ? playlistVideos : videos.slice(0, 3);

  useEffect(() => {
    if (!playlist) return;
    const defaults: Record<string, DownloadQuality> = {};
    for (const v of effectiveVideos) {
      defaults[v.id] = '720p';
    }
    setQualities(defaults);
  }, [playlist?.id]);

  if (!playlist) return null;

  const setAllQuality = (q: DownloadQuality) => {
    const next: Record<string, DownloadQuality> = {};
    for (const v of effectiveVideos) {
      next[v.id] = q;
    }
    setQualities(next);
  };

  const completedCount = effectiveVideos.filter(
    (v) => progressMap[v.id]?.status === 'completed' || offlineVideoIds.has(v.id)
  ).length;

  const handleStartBatch = async () => {
    setIsDownloadingAll(true);
    try {
      await onDownloadPlaylist(playlist, effectiveVideos, qualities, exportToGallery);
    } finally {
      setIsDownloadingAll(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-xl bg-white dark:bg-[#141414] text-zinc-900 dark:text-zinc-100 rounded-t-3xl sm:rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Download Playlist Offline"
      >
        <div className="sm:hidden w-10 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mt-3" />

        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-white/10">
          <div className="flex items-center gap-2.5 min-w-0">
            <ListVideo className="w-5 h-5 text-[var(--nextube-accent)] shrink-0" />
            <div className="min-w-0">
              <h2 className="text-base font-semibold truncate">{playlist.title}</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {effectiveVideos.length} videos · Choose per-video offline quality
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close playlist downloader"
            className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Batch Quality Bar */}
        <div className="px-5 py-3 bg-zinc-50 dark:bg-white/[0.03] border-b border-zinc-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Set all tracks:
          </span>
          <div className="flex items-center gap-1.5">
            {QUALITIES.map((q) => (
              <button
                key={q}
                type="button"
                disabled={isDownloadingAll}
                onClick={() => setAllQuality(q)}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 hover:border-[var(--nextube-accent)] transition-colors whitespace-nowrap shrink-0"
              >
                {q === 'audio' ? 'Audio' : q}
              </button>
            ))}
          </div>
        </div>

        {/* Per-Video Quality Selector List */}
        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-white/5">
          {effectiveVideos.map((vid) => {
            const q = qualities[vid.id] || '720p';
            const prog = progressMap[vid.id];
            const isOffline = offlineVideoIds.has(vid.id);

            return (
              <div key={vid.id} className="px-5 py-3.5 space-y-2.5">
                <div className="flex items-center gap-3">
                  <MediaImage
                    src={vid.thumbnailUrl}
                    alt={vid.title}
                    className="w-20 aspect-video rounded-lg object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium line-clamp-1">{vid.title}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {vid.channelTitle} · {vid.durationLabel} · ~
                      {estimateSizeLabel(vid.durationSeconds, q)}
                    </p>
                  </div>
                  <select
                    aria-label={`Quality for ${vid.title}`}
                    disabled={isDownloadingAll}
                    value={q}
                    onChange={(e) =>
                      setQualities((prev) => ({
                        ...prev,
                        [vid.id]: e.target.value as DownloadQuality,
                      }))
                    }
                    className="h-9 px-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-white/10 text-xs font-medium outline-none"
                  >
                    <option value="1080p">1080p MP4</option>
                    <option value="720p">720p MP4</option>
                    <option value="480p">480p MP4</option>
                    <option value="audio">Audio M4A</option>
                  </select>
                </div>

                {(prog || isOffline) && (
                  <div className="flex items-center gap-3">
                    <div className="h-1.5 flex-1 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full bg-[var(--nextube-accent)] transition-all duration-200"
                        style={{ width: `${prog?.progress ?? 100}%` }}
                      />
                    </div>
                    <span className="font-mono text-[11px] text-zinc-500 dark:text-zinc-400 tabular-nums shrink-0 flex items-center gap-1">
                      {prog?.status === 'completed' || (!prog && isOffline) ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          Offline
                        </>
                      ) : (
                        `${prog?.progress ?? 0}%`
                      )}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Controls */}
        <div className="p-5 border-t border-zinc-200 dark:border-white/10 space-y-3 bg-white dark:bg-[#141414]">
          <button
            type="button"
            disabled={isDownloadingAll}
            onClick={() => setExportToGallery((v) => !v)}
            className="w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-white/10 flex items-center justify-between text-xs font-medium"
          >
            <span className="flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-sky-500" />
              Also export all files to Device Gallery / Camera Roll
            </span>
            <span className={exportToGallery ? 'text-[var(--nextube-accent)]' : 'text-zinc-400'}>
              {exportToGallery ? 'Yes' : 'Vault only'}
            </span>
          </button>

          <button
            type="button"
            disabled={isDownloadingAll}
            onClick={handleStartBatch}
            className="w-full h-12 rounded-xl bg-[var(--nextube-accent)] hover:opacity-90 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-opacity"
          >
            <Download className="w-4 h-4" />
            {isDownloadingAll
              ? `Downloading Playlist (${completedCount}/${effectiveVideos.length})...`
              : `Download Entire Playlist (${effectiveVideos.length} videos)`}
          </button>
        </div>
      </div>
    </div>
  );
}
