import { useState } from 'react';
import { CheckCircle2, Download, FolderDown, Music, Smartphone, Video, X } from 'lucide-react';
import type { DownloadProgressState, DownloadQuality, VideoItem } from '../types/nextube';
import { estimateSizeLabel } from '../services/offlineStore';
import { MediaImage } from './MediaImage';

interface DownloadSheetProps {
  video: VideoItem | null;
  onClose: () => void;
  onStartDownload: (
    video: VideoItem,
    quality: DownloadQuality,
    saveToGallery: boolean
  ) => Promise<void>;
  activeProgress?: DownloadProgressState;
  isAlreadyOffline: boolean;
}

const QUALITY_OPTIONS: Array<{
  id: DownloadQuality;
  label: string;
  subtitle: string;
  isAudio?: boolean;
}> = [
  { id: '1080p', label: '1080p Full HD', subtitle: 'MP4 · H.264 High Profile' },
  { id: '720p', label: '720p HD', subtitle: 'MP4 · Balanced storage & clarity' },
  { id: '480p', label: '480p Data Saver', subtitle: 'MP4 · Compact mobile file' },
  { id: 'audio', label: 'Audio Only', subtitle: 'M4A / AAC · 256 kbps', isAudio: true },
];

export function DownloadSheet({
  video,
  onClose,
  onStartDownload,
  activeProgress,
  isAlreadyOffline,
}: DownloadSheetProps) {
  const [selectedQuality, setSelectedQuality] = useState<DownloadQuality>('1080p');
  const [saveToGallery, setSaveToGallery] = useState(true);

  if (!video) return null;

  const isBusy =
    activeProgress?.status === 'downloading' || activeProgress?.status === 'saving';

  return (
    <div
      className="fixed inset-0 z-[65] flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-[#141414] text-zinc-900 dark:text-zinc-100 rounded-t-3xl sm:rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Download Video or Audio"
      >
        <div className="sm:hidden w-10 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mt-3" />

        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-white/10">
          <h2 className="text-base font-semibold">Download to Device &amp; Gallery</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close download sheet"
            className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Media Preview */}
          <div className="flex items-center gap-3.5">
            <MediaImage
              src={video.thumbnailUrl}
              alt={video.title}
              className="w-24 aspect-video rounded-xl object-cover shrink-0 bg-zinc-200 dark:bg-zinc-800"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold line-clamp-2">{video.title}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                {video.channelTitle} · {video.durationLabel}
              </p>
            </div>
          </div>

          {/* Quality Selector */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Select Quality &amp; Format
            </p>
            <div className="space-y-2">
              {QUALITY_OPTIONS.map((opt) => {
                const active = selectedQuality === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={isBusy}
                    onClick={() => setSelectedQuality(opt.id)}
                    className={`w-full min-h-[54px] px-4 py-2.5 rounded-xl border flex items-center justify-between text-left transition-colors ${
                      active
                        ? 'border-[var(--nextube-accent)] bg-[var(--nextube-accent)]/10'
                        : 'border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {opt.isAudio ? (
                        <Music className="w-4 h-4 text-[var(--nextube-accent)]" />
                      ) : (
                        <Video className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{opt.label}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{opt.subtitle}</p>
                      </div>
                    </div>
                    <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                      ~{estimateSizeLabel(video.durationSeconds, opt.id)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Direct Gallery Integration Toggle */}
          <button
            type="button"
            disabled={isBusy}
            onClick={() => setSaveToGallery((v) => !v)}
            className="w-full min-h-[52px] px-4 py-3 rounded-xl border border-zinc-200 dark:border-white/10 flex items-center justify-between text-left hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors"
          >
            <div className="flex items-center gap-3">
              <Smartphone className="w-4 h-4 text-sky-500 shrink-0" />
              <div>
                <p className="text-sm font-medium">Save to Media Gallery / Camera Roll</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Exports file directly alongside offline vault
                </p>
              </div>
            </div>
            <span
              className={`text-xs font-semibold ${
                saveToGallery ? 'text-[var(--nextube-accent)]' : 'text-zinc-400'
              }`}
            >
              {saveToGallery ? 'On' : 'Vault only'}
            </span>
          </button>

          {/* Live Progress Bar */}
          {activeProgress && (
            <div className="space-y-2 p-3.5 rounded-xl bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/10">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">
                  {activeProgress.status === 'completed'
                    ? 'Saved to Offline Vault & Gallery'
                    : activeProgress.status === 'error'
                    ? activeProgress.errorMessage || 'Download error'
                    : 'Downloading stream...'}
                </span>
                <span className="font-mono tabular-nums">{activeProgress.progress}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-[var(--nextube-accent)] transition-all duration-200"
                  style={{ width: `${activeProgress.progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action CTA */}
          <button
            type="button"
            disabled={isBusy}
            onClick={() => onStartDownload(video, selectedQuality, saveToGallery)}
            className="w-full h-12 rounded-xl bg-[var(--nextube-accent)] hover:opacity-90 disabled:opacity-60 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            {activeProgress?.status === 'completed' || isAlreadyOffline ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                {isBusy ? 'Downloading...' : 'Download Again / Export File'}
              </>
            ) : saveToGallery ? (
              <>
                <FolderDown className="w-4 h-4" />
                Download {selectedQuality.toUpperCase()} to Gallery
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                Save {selectedQuality.toUpperCase()} Offline
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
