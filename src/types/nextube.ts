export type DownloadQuality = '1080p' | '720p' | '480p' | 'audio';

export type ThemeMode = 'light' | 'dark' | 'system';

export type TabId = 'home' | 'shorts' | 'subscriptions' | 'library' | 'architecture';

export interface SponsorSegment {
  id: string;
  start: number; // seconds
  end: number;   // seconds
  category: 'sponsor' | 'intro' | 'outro' | 'selfpromo';
  label: string;
}

export interface SubtitleCue {
  id: string;
  start: number;
  end: number;
  text: string;
}

export interface CommentItem {
  id: string;
  videoId: string;
  authorName: string;
  authorHandle: string;
  authorAvatarColor: string;
  text: string;
  publishedAt: string;
  likeCount: number;
  isLiked?: boolean;
  isPinned?: boolean;
  isCreatorOwnComment?: boolean;
  moderationStatus?: 'published' | 'heldForReview' | 'reported' | 'deleted';
  reportReason?: string;
}

export interface CommentModerationAction {
  id: string;
  commentId: string;
  videoId: string;
  authorName: string;
  excerpt: string;
  action: 'deleted' | 'reported';
  reason?: string;
  timestamp: string;
  syncedToYouTube: boolean;
}

export interface VideoItem {
  id: string;
  youtubeId?: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  channelAvatarUrl?: string;
  channelSubscribers: string;
  isSubscribed?: boolean;
  isCreatorOwned?: boolean; // true if uploaded by current user (enables comment delete)
  thumbnailUrl: string;
  streamUrl: string;
  durationSeconds: number;
  durationLabel: string;
  viewCountLabel: string;
  publishedAtLabel: string;
  category: string;
  likeCount: number;
  isLiked?: boolean;
  commentCount?: number;
  commentCountLabel?: string;
  isShort?: boolean;
  maxQualityLabel: string;
  sponsorSegments: SponsorSegment[];
  subtitles: SubtitleCue[];
  source: 'youtube' | 'curated';
}

export interface PlaylistSummary {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  itemCount: number;
  channelTitle: string;
  videoIds: string[];
  source: 'youtube' | 'curated';
}

export interface YouTubeChannelResult {
  channelId: string;
  title: string;
  handle: string;
  thumbnailUrl: string;
  subscriberCountLabel: string;
  description: string;
  isSubscribed?: boolean;
}

export interface GoogleAccountProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  channelHandle?: string;
  isIncognito?: boolean;
}

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  rtl?: boolean;
}

export interface OfflineVideoRecord {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  quality: DownloadQuality;
  sizeBytes: number;
  durationSeconds: number;
  durationLabel: string;
  downloadedAt: string;
  savedToGallery: boolean;
  playlistId?: string;
  blob: Blob;
}

export interface OfflinePlaylistRecord {
  id: string;
  title: string;
  channelTitle: string;
  thumbnailUrl: string;
  videoIds: string[];
  videoQualities: Record<string, DownloadQuality>;
  downloadedAt: string;
}

export interface DownloadProgressState {
  videoId: string;
  title: string;
  quality: DownloadQuality;
  progress: number; // 0 to 100
  status: 'queued' | 'downloading' | 'saving' | 'completed' | 'error';
  errorMessage?: string;
}

export interface WatchLaterRecord {
  id: string;
  video: VideoItem;
  savedAt: string;
}

