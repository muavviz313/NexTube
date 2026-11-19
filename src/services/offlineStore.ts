import type {
  DownloadQuality,
  OfflinePlaylistRecord,
  OfflineVideoRecord,
  PlaylistSummary,
  VideoItem,
  WatchLaterRecord,
} from '../types/nextube';

const DB_NAME = 'NexTubeOfflineDB';
const DB_VERSION = 2;
const VIDEOS_STORE = 'videos';
const PLAYLISTS_STORE = 'playlists';
const WATCH_LATER_STORE = 'watchLater';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(VIDEOS_STORE)) {
        db.createObjectStore(VIDEOS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(PLAYLISTS_STORE)) {
        db.createObjectStore(PLAYLISTS_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(WATCH_LATER_STORE)) {
        db.createObjectStore(WATCH_LATER_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllOfflineVideos(): Promise<OfflineVideoRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VIDEOS_STORE, 'readonly');
    const store = tx.objectStore(VIDEOS_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as OfflineVideoRecord[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllOfflinePlaylists(): Promise<OfflinePlaylistRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLAYLISTS_STORE, 'readonly');
    const store = tx.objectStore(PLAYLISTS_STORE);
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as OfflinePlaylistRecord[]) || []);
    req.onerror = () => reject(req.error);
  });
}

export async function saveOfflineVideo(record: OfflineVideoRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VIDEOS_STORE, 'readwrite');
    tx.objectStore(VIDEOS_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveOfflinePlaylist(record: OfflinePlaylistRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLAYLISTS_STORE, 'readwrite');
    tx.objectStore(PLAYLISTS_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteOfflineVideo(videoId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(VIDEOS_STORE, 'readwrite');
    tx.objectStore(VIDEOS_STORE).delete(videoId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteOfflinePlaylist(playlistId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLAYLISTS_STORE, 'readwrite');
    tx.objectStore(PLAYLISTS_STORE).delete(playlistId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function estimateSizeLabel(durationSeconds: number, quality: DownloadQuality): string {
  const mbPerMin =
    quality === '1080p' ? 24 : quality === '720p' ? 14 : quality === '480p' ? 7 : 1.5;
  const mb = Math.max(1.2, (durationSeconds / 60) * mbPerMin);
  return `${mb.toFixed(1)} MB`;
}

export async function downloadMediaWithProgress(
  video: VideoItem,
  quality: DownloadQuality,
  onProgress: (pct: number) => void,
  options: { saveToGallery: boolean; playlistId?: string }
): Promise<OfflineVideoRecord> {
  const ext = quality === 'audio' ? 'm4a' : 'mp4';
  const safeBase = video.title.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 48);
  const filename = `${safeBase || 'nextube_video'}_${quality}.${ext}`;

  // YouTube Data API v3 provides metadata/embed playback rather than raw MP4 stream URLs.
  // When no direct media stream URL is available, store an offline metadata package in IndexedDB.
  if (!video.streamUrl) {
    onProgress(55);
    const offlineMeta = JSON.stringify(
      {
        id: video.id,
        youtubeId: video.youtubeId,
        title: video.title,
        channelTitle: video.channelTitle,
        quality,
        savedAt: new Date().toISOString(),
        subtitles: video.subtitles,
      },
      null,
      2
    );
    const blob = new Blob([offlineMeta], { type: 'application/json' });
    const record: OfflineVideoRecord = {
      id: video.id,
      title: video.title,
      channelTitle: video.channelTitle,
      thumbnailUrl: video.thumbnailUrl,
      quality,
      sizeBytes: blob.size,
      durationSeconds: video.durationSeconds,
      durationLabel: video.durationLabel,
      downloadedAt: new Date().toISOString(),
      savedToGallery: false,
      playlistId: options.playlistId,
      blob,
    };
    await saveOfflineVideo(record);
    onProgress(100);
    return record;
  }

  const proxyUrl = `/api/media-proxy?url=${encodeURIComponent(video.streamUrl)}&filename=${encodeURIComponent(filename)}`;

  const res = await fetch(proxyUrl);
  if (!res.ok) {
    throw new Error(`Download failed (${res.status})`);
  }

  const contentLength = Number(res.headers.get('content-length') || 0);
  const reader = res.body?.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  if (reader) {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        chunks.push(value);
        received += value.length;
        if (contentLength > 0) {
          onProgress(Math.min(98, Math.round((received / contentLength) * 100)));
        } else {
          onProgress(Math.min(92, received > 0 ? 60 : 25));
        }
      }
    }
  } else {
    const buf = await res.arrayBuffer();
    chunks.push(new Uint8Array(buf));
    received = buf.byteLength;
  }

  const mimeType = quality === 'audio' ? 'audio/mp4' : 'video/mp4';
  const blob = new Blob(chunks as BlobPart[], { type: mimeType });

  const record: OfflineVideoRecord = {
    id: video.id,
    title: video.title,
    channelTitle: video.channelTitle,
    thumbnailUrl: video.thumbnailUrl,
    quality,
    sizeBytes: blob.size || received,
    durationSeconds: video.durationSeconds,
    durationLabel: video.durationLabel,
    downloadedAt: new Date().toISOString(),
    savedToGallery: options.saveToGallery,
    playlistId: options.playlistId,
    blob,
  };

  await saveOfflineVideo(record);
  onProgress(100);

  if (options.saveToGallery) {
    triggerDeviceGallerySave(blob, filename);
  }

  return record;
}

export function triggerDeviceGallerySave(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1500);
}

export async function savePlaylistMetadata(
  playlist: PlaylistSummary,
  videoQualities: Record<string, DownloadQuality>
): Promise<OfflinePlaylistRecord> {
  const record: OfflinePlaylistRecord = {
    id: playlist.id,
    title: playlist.title,
    channelTitle: playlist.channelTitle,
    thumbnailUrl: playlist.thumbnailUrl,
    videoIds: playlist.videoIds,
    videoQualities,
    downloadedAt: new Date().toISOString(),
  };
  await saveOfflinePlaylist(record);
  return record;
}

export async function getAllWatchLater(): Promise<WatchLaterRecord[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WATCH_LATER_STORE, 'readonly');
    const req = tx.objectStore(WATCH_LATER_STORE).getAll();
    req.onsuccess = () => {
      const items = (req.result as WatchLaterRecord[]) || [];
      items.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function saveWatchLaterRecord(video: VideoItem): Promise<WatchLaterRecord> {
  const db = await openDB();
  const record: WatchLaterRecord = {
    id: video.id,
    video,
    savedAt: new Date().toISOString(),
  };
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WATCH_LATER_STORE, 'readwrite');
    tx.objectStore(WATCH_LATER_STORE).put(record);
    tx.oncomplete = () => resolve(record);
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteWatchLaterRecord(videoId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(WATCH_LATER_STORE, 'readwrite');
    tx.objectStore(WATCH_LATER_STORE).delete(videoId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

