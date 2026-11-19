import { useState } from 'react';
import {
  Bookmark,
  CheckCircle2,
  Download,
  FolderDown,
  HardDrive,
  History,
  ListVideo,
  Play,
  ShieldAlert,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import type {
  CommentModerationAction,
  OfflinePlaylistRecord,
  OfflineVideoRecord,
  PlaylistSummary,
  VideoItem,
  WatchLaterRecord,
} from '../types/nextube';
import { triggerDeviceGallerySave } from '../services/offlineStore';
import { MediaImage } from './MediaImage';

interface LibraryViewProps {
  playlists: PlaylistSummary[];
  offlinePlaylists: OfflinePlaylistRecord[];
  offlineVideos: OfflineVideoRecord[];
  watchLaterItems: WatchLaterRecord[];
  historyVideos: VideoItem[];
  likedVideos: VideoItem[];
  moderationLog: CommentModerationAction[];
  isIncognito: boolean;
  onPlayVideo: (video: VideoItem) => void;
  onPlayOfflineRecord: (record: OfflineVideoRecord) => void;
  onOpenPlaylistDownload: (playlist: PlaylistSummary) => void;
  onOpenDownloadSheet: (video: VideoItem) => void;
  onRemoveWatchLater: (videoId: string) => Promise<void>;
  onDeleteOfflineVideo: (videoId: string) => Promise<void>;
  onDeleteOfflinePlaylist: (playlistId: string) => Promise<void>;
}

export function LibraryView({
  playlists,
  offlinePlaylists,
  offlineVideos,
  watchLaterItems,
  historyVideos,
  likedVideos,
  moderationLog,
  isIncognito,
  onPlayVideo,
  onPlayOfflineRecord,
  onOpenPlaylistDownload,
  onOpenDownloadSheet,
  onRemoveWatchLater,
  onDeleteOfflineVideo,
  onDeleteOfflinePlaylist,
}: LibraryViewProps) {
  const [subTab, setSubTab] = useState<'offline' | 'watchLater' | 'playlists' | 'history' | 'moderation'>('offline');

  const totalOfflineBytes = offlineVideos.reduce((acc, v) => acc + (v.sizeBytes || 0), 0);
  const totalMb = (totalOfflineBytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="space-y-6">
      {/* Sub-navigation segmented buttons */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => setSubTab('offline')}
          className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
            subTab === 'offline'
              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
              : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300'
          }`}
        >
          <HardDrive className="w-3.5 h-3.5" />
          Offline Vault ({offlineVideos.length + watchLaterItems.length})
        </button>

        <button
          type="button"
          onClick={() => setSubTab('watchLater')}
          className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
            subTab === 'watchLater'
              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
              : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300'
          }`}
        >
          <Bookmark className="w-3.5 h-3.5" />
          Watch Later ({watchLaterItems.length})
        </button>

        <button
          type="button"
          onClick={() => setSubTab('playlists')}
          className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
            subTab === 'playlists'
              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
              : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300'
          }`}
        >
          <ListVideo className="w-3.5 h-3.5" />
          Playlists ({playlists.length})
        </button>

        <button
          type="button"
          onClick={() => setSubTab('history')}
          className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
            subTab === 'history'
              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
              : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300'
          }`}
        >
          <History className="w-3.5 h-3.5" />
          History &amp; Likes
        </button>

        <button
          type="button"
          onClick={() => setSubTab('moderation')}
          className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
            subTab === 'moderation'
              ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
              : 'bg-zinc-100 dark:bg-white/[0.06] text-zinc-600 dark:text-zinc-300'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          Moderation ({moderationLog.length})
        </button>
      </div>

      {/* Offline Vault & Downloaded Playlists */}
      {subTab === 'offline' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-200 dark:border-white/10">
            <div>
              <h2 className="text-lg font-bold">Offline Vault &amp; Watch Later</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {watchLaterItems.length} saved for later · {offlineVideos.length} downloaded files ·{' '}
                <span className="font-mono tabular-nums">{totalMb} MB</span> stored locally in IndexedDB
              </p>
            </div>
          </div>

          {/* Local Persistent Watch Later Playlist inside Offline Vault */}
          {watchLaterItems.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Bookmark className="w-4 h-4 text-[var(--nextube-accent)]" />
                    Watch Later Playlist ({watchLaterItems.length})
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Saved locally in IndexedDB without downloading media files
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onOpenPlaylistDownload({
                      id: 'pl-watch-later',
                      title: 'Watch Later Queue',
                      description: 'Offline download batch from your saved Watch Later playlist.',
                      thumbnailUrl: watchLaterItems[0].video.thumbnailUrl,
                      itemCount: watchLaterItems.length,
                      channelTitle: 'Local Vault',
                      videoIds: watchLaterItems.map((item) => item.id),
                      source: 'curated',
                    })
                  }
                  className="min-h-[36px] px-3 rounded-xl border border-zinc-200 dark:border-white/10 hover:border-[var(--nextube-accent)] text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-[var(--nextube-accent)]" />
                  Download All
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {watchLaterItems.map((entry) => (
                  <div
                    key={entry.id}
                    className="rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-white/10 overflow-hidden flex flex-col"
                  >
                    <button
                      type="button"
                      onClick={() => onPlayVideo(entry.video)}
                      className="relative aspect-video w-full bg-zinc-200 dark:bg-zinc-900 group text-left"
                    >
                      <MediaImage
                        src={entry.video.thumbnailUrl}
                        alt={entry.video.title}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white font-mono text-[11px] tabular-nums">
                        {entry.video.durationLabel}
                      </span>
                    </button>
                    <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold line-clamp-2">{entry.video.title}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                          {entry.video.channelTitle} · Saved locally
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-white/5">
                        <button
                          type="button"
                          onClick={() => onOpenDownloadSheet(entry.video)}
                          className="min-h-[36px] px-2.5 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 flex items-center gap-1.5"
                        >
                          <Download className="w-3.5 h-3.5 text-[var(--nextube-accent)]" />
                          Download
                        </button>
                        <button
                          type="button"
                          onClick={() => void onRemoveWatchLater(entry.id)}
                          aria-label={`Remove ${entry.video.title} from Watch Later`}
                          className="min-w-[36px] min-h-[36px] rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Downloaded Offline Playlists */}
          {offlinePlaylists.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Downloaded Playlists</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {offlinePlaylists.map((pl) => {
                  const downloadedTracks = offlineVideos.filter((v) =>
                    pl.videoIds.includes(v.id)
                  );
                  return (
                    <div
                      key={pl.id}
                      className="p-4 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-white/10 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <MediaImage
                          src={pl.thumbnailUrl}
                          alt={pl.title}
                          className="w-20 aspect-video rounded-xl object-cover shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{pl.title}</p>
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                            {downloadedTracks.length} of {pl.videoIds.length} tracks offline
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void onDeleteOfflinePlaylist(pl.id)}
                        aria-label={`Remove offline playlist ${pl.title}`}
                        className="min-w-[40px] min-h-[40px] rounded-xl text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Individual Offline Videos */}
          {offlineVideos.length === 0 ? (
            <div className="p-10 rounded-2xl border border-dashed border-zinc-300 dark:border-white/15 text-center space-y-2">
              <Download className="w-7 h-7 mx-auto text-zinc-400" />
              <p className="text-sm font-semibold">No offline videos yet</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                Tap Download under any video or select a playlist below to store 1080p/720p/Audio tracks for offline playback.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {offlineVideos.map((rec) => (
                <div
                  key={rec.id}
                  className="rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-white/10 overflow-hidden flex flex-col"
                >
                  <button
                    type="button"
                    onClick={() => onPlayOfflineRecord(rec)}
                    className="relative aspect-video w-full bg-zinc-200 dark:bg-zinc-900 group text-left"
                  >
                    <MediaImage
                      src={rec.thumbnailUrl}
                      alt={rec.title}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <div className="w-11 h-11 rounded-full bg-[var(--nextube-accent)] text-white flex items-center justify-center">
                        <Play className="w-5 h-5 ml-0.5" />
                      </div>
                    </div>
                    <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white font-mono text-[11px] tabular-nums">
                      {rec.durationLabel}
                    </span>
                  </button>

                  <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold line-clamp-2">{rec.title}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                        {rec.quality.toUpperCase()} ·{' '}
                        <span className="font-mono tabular-nums">
                          {(rec.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-white/5">
                      <button
                        type="button"
                        onClick={() => {
                          const ext = rec.quality === 'audio' ? 'm4a' : 'mp4';
                          const safeName = rec.title.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40);
                          triggerDeviceGallerySave(rec.blob, `${safeName}_${rec.quality}.${ext}`);
                        }}
                        className="min-h-[36px] px-2.5 rounded-lg text-xs font-medium text-sky-600 dark:text-sky-400 hover:bg-sky-500/10 flex items-center gap-1.5"
                      >
                        <FolderDown className="w-3.5 h-3.5" />
                        Save to Gallery
                      </button>

                      <button
                        type="button"
                        onClick={() => void onDeleteOfflineVideo(rec.id)}
                        aria-label={`Remove ${rec.title} from offline storage`}
                        className="min-w-[36px] min-h-[36px] rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dedicated Watch Later Tab */}
      {subTab === 'watchLater' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-zinc-200 dark:border-white/10">
            <div>
              <h2 className="text-lg font-bold">Watch Later</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Persistent local playlist in your offline vault — saved without downloading media files
              </p>
            </div>
            {watchLaterItems.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  onOpenPlaylistDownload({
                    id: 'pl-watch-later',
                    title: 'Watch Later Queue',
                    description: 'Offline download batch from your saved Watch Later playlist.',
                    thumbnailUrl: watchLaterItems[0].video.thumbnailUrl,
                    itemCount: watchLaterItems.length,
                    channelTitle: 'Local Vault',
                    videoIds: watchLaterItems.map((item) => item.id),
                    source: 'curated',
                  })
                }
                className="min-h-[40px] px-4 rounded-xl bg-[var(--nextube-accent)] hover:opacity-90 text-white text-xs font-semibold flex items-center gap-2 transition-opacity"
              >
                <Download className="w-3.5 h-3.5" />
                Download Playlist ({watchLaterItems.length})
              </button>
            )}
          </div>

          {watchLaterItems.length === 0 ? (
            <div className="p-10 rounded-2xl border border-dashed border-zinc-300 dark:border-white/15 text-center space-y-2">
              <Bookmark className="w-7 h-7 mx-auto text-zinc-400" />
              <p className="text-sm font-semibold">Your Watch Later list is empty</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                Tap Watch Later on any video card to save it locally in your offline vault without downloading it.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {watchLaterItems.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-white/10 overflow-hidden flex flex-col"
                >
                  <button
                    type="button"
                    onClick={() => onPlayVideo(entry.video)}
                    className="relative aspect-video w-full bg-zinc-200 dark:bg-zinc-900 group text-left"
                  >
                    <MediaImage
                      src={entry.video.thumbnailUrl}
                      alt={entry.video.title}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white font-mono text-[11px] tabular-nums">
                      {entry.video.durationLabel}
                    </span>
                  </button>
                  <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold line-clamp-2">{entry.video.title}</p>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        {entry.video.channelTitle} · {entry.video.viewCountLabel}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-white/5">
                      <button
                        type="button"
                        onClick={() => onOpenDownloadSheet(entry.video)}
                        className="min-h-[36px] px-2.5 rounded-lg text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 flex items-center gap-1.5"
                      >
                        <Download className="w-3.5 h-3.5 text-[var(--nextube-accent)]" />
                        Download
                      </button>
                      <button
                        type="button"
                        onClick={() => void onRemoveWatchLater(entry.id)}
                        aria-label={`Remove ${entry.video.title} from Watch Later`}
                        className="min-w-[36px] min-h-[36px] rounded-lg text-zinc-400 hover:text-rose-500 hover:bg-rose-500/10 flex items-center justify-center"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Playlists with Full Offline Playlist Downloader Trigger */}
      {subTab === 'playlists' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Your Playlists</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Download entire playlists with per-video quality control
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {playlists.map((pl) => (
              <div
                key={pl.id}
                className="p-4 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-white/10 flex flex-col sm:flex-row gap-4"
              >
                <MediaImage
                  src={pl.thumbnailUrl}
                  alt={pl.title}
                  className="w-full sm:w-40 aspect-video rounded-xl object-cover shrink-0"
                />
                <div className="flex-1 min-w-0 flex flex-col justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold line-clamp-1">{pl.title}</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {pl.channelTitle} · {pl.itemCount} videos
                    </p>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1.5 line-clamp-2">
                      {pl.description}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenPlaylistDownload(pl)}
                    className="min-h-[40px] px-4 rounded-xl bg-[var(--nextube-accent)] hover:opacity-90 text-white text-xs font-semibold flex items-center justify-center gap-2 w-full sm:w-fit transition-opacity"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Playlist
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Watch History & Liked Videos */}
      {subTab === 'history' && (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">Watch History</h3>
              {isIncognito && (
                <span className="text-xs font-medium text-amber-500">
                  Paused (Incognito Mode)
                </span>
              )}
            </div>
            {historyVideos.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 py-4">
                Videos you play will appear here unless Incognito Mode is enabled.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {historyVideos.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onPlayVideo(v)}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-white/10 text-left hover:border-zinc-300 dark:hover:border-white/20"
                  >
                    <MediaImage
                      src={v.thumbnailUrl}
                      alt={v.title}
                      className="w-28 aspect-video rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold line-clamp-2">{v.title}</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                        {v.channelTitle}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3 pt-4 border-t border-zinc-200 dark:border-white/10">
            <h3 className="text-base font-bold flex items-center gap-2">
              <ThumbsUp className="w-4 h-4 text-[var(--nextube-accent)]" />
              Liked Videos ({likedVideos.length})
            </h3>
            {likedVideos.length === 0 ? (
              <p className="text-xs text-zinc-500 dark:text-zinc-400 py-4">
                Like any video to sync it here and to your YouTube account.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {likedVideos.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => onPlayVideo(v)}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-white/10 text-left hover:border-zinc-300 dark:hover:border-white/20"
                  >
                    <MediaImage
                      src={v.thumbnailUrl}
                      alt={v.title}
                      className="w-28 aspect-video rounded-lg object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold line-clamp-2">{v.title}</p>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                        {v.channelTitle}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Comment Moderation Queue & Audit Log */}
      {subTab === 'moderation' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-bold">Creator Comment Moderation Log</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Tracks deleted comments and community guideline violation reports synced with YouTube Data API v3
            </p>
          </div>

          {moderationLog.length === 0 ? (
            <div className="p-8 rounded-2xl border border-dashed border-zinc-300 dark:border-white/15 text-center space-y-1.5">
              <ShieldAlert className="w-6 h-6 mx-auto text-zinc-400" />
              <p className="text-sm font-semibold">No moderation actions recorded yet</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Open any video comment section and tap the menu icon on a comment to delete or report violations.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-zinc-200 dark:divide-white/10 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-white/10 overflow-hidden">
              {moderationLog.map((entry) => (
                <div key={entry.id} className="p-4 flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`font-semibold ${
                          entry.action === 'deleted' ? 'text-rose-500' : 'text-amber-500'
                        }`}
                      >
                        {entry.action === 'deleted' ? 'Deleted Comment' : 'Reported Violation'}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium">{entry.authorName}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-zinc-500 dark:text-zinc-400">{entry.timestamp}</span>
                    </div>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 line-clamp-2">
                      &ldquo;{entry.excerpt}&rdquo;
                    </p>
                    {entry.reason && (
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        Reason: {entry.reason}
                      </p>
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap shrink-0">
                    {entry.syncedToYouTube ? 'Synced to YouTube' : 'In-App Managed'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
