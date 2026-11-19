import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ArrowLeft,
  Bell,
  Bookmark,
  BookmarkCheck,
  Check,
  CheckCircle2,
  Compass,
  Download,
  EyeOff,
  Flame,
  FolderKanban,
  Home,
  Layers,
  ListVideo,
  Monitor,
  Moon,
  Palette,
  Play,
  RefreshCw,
  Search,
  Sun,
  Tv,
  UserCircle2,
  Users,
  X,
} from 'lucide-react';
import { FEED_CATEGORIES } from './data/catalog';
import { WORLD_LANGUAGES } from './data/languages';
import type {
  CommentItem,
  CommentModerationAction,
  DownloadProgressState,
  DownloadQuality,
  GoogleAccountProfile,
  LanguageOption,
  OfflinePlaylistRecord,
  OfflineVideoRecord,
  PlaylistSummary,
  TabId,
  ThemeMode,
  VideoItem,
  WatchLaterRecord,
  YouTubeChannelResult,
} from './types/nextube';
import {
  getAccessToken,
  initAuth,
  logoutGoogleAccount,
  signInWithGoogleAccount,
} from './services/firebaseAuth';
import {
  deleteYouTubeComment,
  fetchChannelUploads,
  fetchLiveYouTubeFallback,
  fetchLiveYouTubeVideoDetails,
  fetchYouTubeComments,
  fetchYouTubeSyncBundle,
  type LiveVideoDetails,
  postYouTubeComment,
  rateYouTubeVideo,
  reportYouTubeCommentAsSpam,
  searchYouTubeChannels,
  searchYouTubeVideos,
  subscribeToYouTubeChannel,
} from './services/youtubeApi';
import {
  buildInterestQueries,
  getTopInterestLabels,
  type InterestProfile,
  loadInterestProfile,
  loadPersistedHistory,
  rankVideosByInterest,
  recordInterestSignal,
  saveInterestProfile,
  savePersistedHistory,
  sortVideosLatestFirst,
} from './services/recommendationEngine';
import {
  deleteOfflinePlaylist,
  deleteOfflineVideo,
  deleteWatchLaterRecord,
  downloadMediaWithProgress,
  getAllOfflinePlaylists,
  getAllOfflineVideos,
  getAllWatchLater,
  savePlaylistMetadata,
  saveWatchLaterRecord,
} from './services/offlineStore';
import { translateTexts } from './services/translatorApi';
import { MediaImage } from './components/MediaImage';
import { ACCENT_COLORS, AccountSwitcherModal } from './components/AccountSwitcherModal';
import { LanguagePickerModal } from './components/LanguagePickerModal';
import { DownloadSheet } from './components/DownloadSheet';
import { PlaylistDownloadModal } from './components/PlaylistDownloadModal';
import { VideoPlayerModal } from './components/VideoPlayerModal';
import { ShortsPlayer } from './components/ShortsPlayer';
import { MiniPlayer } from './components/MiniPlayer';
import { LibraryView } from './components/LibraryView';
import { CommentsSection } from './components/CommentsSection';

const ArchitectureBlueprintView = lazy(() =>
  import('./components/ArchitectureBlueprintView').then((m) => ({
    default: m.ArchitectureBlueprintView,
  }))
);

function getSavedThemeMode(): ThemeMode {
  try {
    const val = window.localStorage.getItem('nextube_theme_mode');
    if (val === 'light' || val === 'dark' || val === 'system') return val;
  } catch {
    // Ignore storage restriction
  }
  return 'dark';
}

function getSavedAccentColor(): string {
  try {
    const val = window.localStorage.getItem('nextube_accent_color');
    if (val && /^#[0-9a-fA-F]{6}$/.test(val)) return val;
  } catch {
    // Ignore storage restriction
  }
  return '#FF2E4C';
}

export default function App() {
  // User-Controlled Theme (White / Dark / System) & Accent Color
  const [themeMode, setThemeMode] = useState<ThemeMode>(getSavedThemeMode);
  const [accentColor, setAccentColor] = useState<string>(getSavedAccentColor);
  const [showAppearanceBar, setShowAppearanceBar] = useState(false);

  const [activeTab, setActiveTab] = useState<TabId>('home');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [sponsorBlockEnabled, setSponsorBlockEnabled] = useState(true);
  const [preferredLanguage, setPreferredLanguage] = useState<LanguageOption>(
    WORLD_LANGUAGES.find((l) => l.code === 'ur') || WORLD_LANGUAGES[0]
  );

  // Auth & Multi-Account Switcher State
  const [accounts, setAccounts] = useState<GoogleAccountProfile[]>([]);
  const [activeAccountUid, setActiveAccountUid] = useState<string | null>(null);
  const [myChannelId, setMyChannelId] = useState<string | undefined>(undefined);
  const [isIncognito, setIsIncognito] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [ytApiNotice, setYtApiNotice] = useState<string | null>(null);
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [isSyncingFeed, setIsSyncingFeed] = useState(false);
  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);

  // 100% Live YouTube Synced State (Zero dummy content)
  const [homeFeedBase, setHomeFeedBase] = useState<VideoItem[]>([]);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [shorts, setShorts] = useState<VideoItem[]>([]);
  const [likedVideosList, setLikedVideosList] = useState<VideoItem[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistSummary[]>([]);
  const [playlistVideosMap, setPlaylistVideosMap] = useState<Record<string, VideoItem[]>>({});
  const [subscriptions, setSubscriptions] = useState<
    Array<{ id: string; channelId: string; title: string; thumbnailUrl: string }>
  >([]);
  const [persistedHistory, setPersistedHistory] = useState<VideoItem[]>(loadPersistedHistory);
  const [historyIds, setHistoryIds] = useState<string[]>(() =>
    loadPersistedHistory().map((v) => v.id)
  );
  const [interestProfile, setInterestProfile] = useState<InterestProfile>(loadInterestProfile);
  const [commentsByVideo, setCommentsByVideo] = useState<Record<string, CommentItem[]>>({});
  const [moderationLog, setModerationLog] = useState<CommentModerationAction[]>([]);
  const fetchedDetailsRef = useRef<Set<string>>(new Set());

  // Channels Search & Selected Channel Uploads State
  const [searchMode, setSearchMode] = useState<'videos' | 'channels'>('videos');
  const [searchSort, setSearchSort] = useState<'latest' | 'relevance'>('latest');
  const [channelResults, setChannelResults] = useState<YouTubeChannelResult[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<YouTubeChannelResult | null>(null);
  const [channelVideos, setChannelVideos] = useState<VideoItem[]>([]);
  const [isSearchingChannels, setIsSearchingChannels] = useState(false);

  // Player & Mini-Player State
  const [activeVideo, setActiveVideo] = useState<VideoItem | null>(null);
  const [activeOfflineBlobUrl, setActiveOfflineBlobUrl] = useState<string | null>(null);
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(false);
  const [miniProgress, setMiniProgress] = useState({ isPlaying: true, currentTime: 0, duration: 1 });
  const playerVideoRef = useRef<HTMLVideoElement | null>(null);

  // Offline Vault & Download Progress State
  const [offlineVideos, setOfflineVideos] = useState<OfflineVideoRecord[]>([]);
  const [offlinePlaylists, setOfflinePlaylists] = useState<OfflinePlaylistRecord[]>([]);
  const [watchLaterItems, setWatchLaterItems] = useState<WatchLaterRecord[]>([]);
  const [downloadProgressMap, setDownloadProgressMap] = useState<
    Record<string, DownloadProgressState>
  >({});

  // Modals & Drawers
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);
  const [downloadTargetVideo, setDownloadTargetVideo] = useState<VideoItem | null>(null);
  const [playlistDownloadTarget, setPlaylistDownloadTarget] = useState<PlaylistSummary | null>(null);
  const [shortsCommentTarget, setShortsCommentTarget] = useState<VideoItem | null>(null);
  const [shortsTranslatedComments, setShortsTranslatedComments] = useState<Record<string, string>>(
    {}
  );
  const [isShortsCommentsTranslated, setIsShortsCommentsTranslated] = useState(false);
  const [isTranslatingShortsComments, setIsTranslatingShortsComments] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((curr) => (curr === msg ? null : curr));
    }, 3200);
  };

  // Apply Light (White) / Dark / System Theme Mode dynamically
  useEffect(() => {
    try {
      window.localStorage.setItem('nextube_theme_mode', themeMode);
    } catch {
      // Ignore
    }
    const root = document.documentElement;
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const shouldBeDark =
        themeMode === 'dark' || (themeMode === 'system' && media.matches);
      if (shouldBeDark) root.classList.add('dark');
      else root.classList.remove('dark');
    };

    applyTheme();
    if (themeMode === 'system') {
      media.addEventListener('change', applyTheme);
      return () => media.removeEventListener('change', applyTheme);
    }
  }, [themeMode]);

  // Apply User Accent Color CSS custom property dynamically
  useEffect(() => {
    try {
      window.localStorage.setItem('nextube_accent_color', accentColor);
    } catch {
      // Ignore
    }
    document.documentElement.style.setProperty('--nextube-accent', accentColor);
  }, [accentColor]);

  // Hydrate IndexedDB offline vault on startup
  const refreshOfflineVault = async () => {
    try {
      const [vids, pls, watchLater] = await Promise.all([
        getAllOfflineVideos(),
        getAllOfflinePlaylists(),
        getAllWatchLater(),
      ]);
      setOfflineVideos(vids);
      setOfflinePlaylists(pls);
      setWatchLaterItems(watchLater);
    } catch {
      // IndexedDB unavailable in restricted mode
    }
  };

  useEffect(() => {
    void refreshOfflineVault();
    const unsubscribe = initAuth(
      (user, token) => {
        const profile: GoogleAccountProfile = {
          uid: user.uid,
          email: user.email || 'youtube.user@gmail.com',
          displayName: user.displayName || 'YouTube User',
          photoURL: user.photoURL,
          channelHandle: `@${(user.email || 'user').split('@')[0]}`,
          isIncognito: false,
        };
        setAccounts((prev) => {
          const filtered = prev.filter((a) => a.uid !== profile.uid);
          return [profile, ...filtered];
        });
        setActiveAccountUid(profile.uid);
        void syncWithYouTubeAccount(token);
      },
      () => {
        // Signed out
      }
    );
    return () => unsubscribe();
  }, []);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.uid === activeAccountUid) || null,
    [accounts, activeAccountUid]
  );

  const offlineVideoIdSet = useMemo(
    () => new Set(offlineVideos.map((v) => v.id)),
    [offlineVideos]
  );

  const watchLaterIdSet = useMemo(
    () => new Set(watchLaterItems.map((w) => w.id)),
    [watchLaterItems]
  );

  const allKnownVideos = useMemo(() => {
    const map = new Map<string, VideoItem>();
    const pool = [
      ...homeFeedBase,
      ...videos,
      ...shorts,
      ...likedVideosList,
      ...persistedHistory,
      ...watchLaterItems.map((w) => w.video),
      ...Object.values(playlistVideosMap).flat(),
    ];
    for (const v of pool) {
      if (!map.has(v.id)) map.set(v.id, v);
    }
    return Array.from(map.values());
  }, [homeFeedBase, videos, shorts, likedVideosList, persistedHistory, watchLaterItems, playlistVideosMap]);

  const watchedIdSet = useMemo(() => new Set(historyIds), [historyIds]);
  const topInterestLabels = useMemo(
    () => getTopInterestLabels(interestProfile, 6),
    [interestProfile]
  );

  const mergeVideoDetails = (v: VideoItem, details: LiveVideoDetails): VideoItem => ({
    ...v,
    likeCount: Math.max(v.likeCount || 0, details.likeCount || 0),
    channelTitle: details.channelTitle || v.channelTitle,
    channelSubscribers: details.channelSubscribers || v.channelSubscribers,
    channelAvatarUrl: details.channelAvatarUrl || v.channelAvatarUrl,
    description:
      details.description && details.description.length > (v.description?.length || 0)
        ? details.description
        : v.description,
    commentCount: details.commentCount ?? v.commentCount,
    commentCountLabel: details.commentCountLabel || v.commentCountLabel,
  });

  const hydrateRealVideoDetailsAndComments = async (video: VideoItem) => {
    const ytId = video.youtubeId || video.id;
    if (!ytId) return;

    const alreadyFetched = fetchedDetailsRef.current.has(video.id);
    if (!alreadyFetched) {
      fetchedDetailsRef.current.add(video.id);
      const details = await fetchLiveYouTubeVideoDetails(ytId);
      if (details) {
        const patchList = (list: VideoItem[]) =>
          list.map((item) => (item.id === video.id ? mergeVideoDetails(item, details) : item));

        setHomeFeedBase(patchList);
        setVideos(patchList);
        setShorts(patchList);
        setLikedVideosList(patchList);
        setPersistedHistory((prev) => {
          const next = patchList(prev);
          savePersistedHistory(next);
          return next;
        });
        setActiveVideo((curr) => (curr?.id === video.id ? mergeVideoDetails(curr, details) : curr));
        setShortsCommentTarget((curr) =>
          curr?.id === video.id ? mergeVideoDetails(curr, details) : curr
        );

        if (details.comments.length > 0) {
          setCommentsByVideo((prev) => {
            if (prev[video.id] && prev[video.id].length > 0) return prev;
            return { ...prev, [video.id]: details.comments };
          });
        }
      }
    }

    const token = getAccessToken();
    if (token && video.youtubeId) {
      try {
        const ytComments = await fetchYouTubeComments(video.youtubeId, token, myChannelId);
        if (ytComments.length > 0) {
          setCommentsByVideo((prev) => ({ ...prev, [video.id]: ytComments }));
        }
      } catch {
        // Fallback already populated via details.comments if available
      }
    }
  };

  const recordWatchHistoryAndInterest = (video: VideoItem) => {
    if (isIncognito) return;
    setHistoryIds((prev) => [video.id, ...prev.filter((id) => id !== video.id)].slice(0, 60));
    setPersistedHistory((prev) => {
      const next = [video, ...prev.filter((item) => item.id !== video.id)].slice(0, 60);
      savePersistedHistory(next);
      return next;
    });
    setInterestProfile((prev) => recordInterestSignal(prev, { type: 'watch', video }));
  };

  const handleToggleWatchLater = async (video: VideoItem) => {
    const exists = watchLaterIdSet.has(video.id);
    if (exists) {
      await deleteWatchLaterRecord(video.id);
      await refreshOfflineVault();
      showToast('Removed from Watch Later');
    } else {
      await saveWatchLaterRecord(video);
      await refreshOfflineVault();
      showToast('Saved to Watch Later in Offline Vault');
    }
  };

  const syncWithYouTubeAccount = async (token: string, profileOverride?: InterestProfile) => {
    setIsSyncingFeed(true);
    setAuthError(null);
    setYtApiNotice(null);
    const activeProfile = profileOverride || interestProfile;
    const queries = buildInterestQueries(activeProfile);
    try {
      const bundle = await fetchYouTubeSyncBundle(token, queries);
      const rankedHome = rankVideosByInterest(bundle.homeVideos, activeProfile, watchedIdSet);
      const rankedShortsFeed = rankVideosByInterest(
        bundle.shortsVideos,
        activeProfile,
        watchedIdSet
      );
      setMyChannelId(bundle.myChannelId);
      setHomeFeedBase(rankedHome);
      setVideos(rankedHome);
      setShorts(rankedShortsFeed);
      setLikedVideosList(bundle.likedVideos);
      setSubscriptions(bundle.subscriptions);
      setPlaylists(bundle.playlists);
      setPlaylistVideosMap(bundle.playlistVideosMap);
      if (bundle.apiNotice) {
        setYtApiNotice(bundle.apiNotice);
      }
      showToast(
        rankedHome.length > 0
          ? `Loaded ${rankedHome.length} personalized YouTube videos`
          : 'Connected Google account'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'YouTube sync failed';
      setAuthError(msg);
    } finally {
      setIsSyncingFeed(false);
    }
  };

  // Live YouTube Category & Search Sync when authenticated
  const handleSelectCategory = async (categoryLabel: string) => {
    setSelectedCategory(categoryLabel);
    const token = getAccessToken();
    if (!token) return;

    const catOption = FEED_CATEGORIES.find((c) => c.label === categoryLabel);
    if (categoryLabel === 'All' && !searchQuery.trim()) {
      setActiveSearchQuery('');
      setVideos(homeFeedBase);
      return;
    }

    setIsSyncingFeed(true);
    try {
      const subscribedChannelIds = new Set(subscriptions.map((s) => s.channelId));
      const results = await searchYouTubeVideos(searchQuery, token, {
        categoryId: catOption?.categoryId,
        categoryLabel,
        myChannelId,
        subscribedChannelIds,
      });
      setActiveSearchQuery(searchQuery.trim());
      setVideos(results);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Could not fetch category feed');
    } finally {
      setIsSyncingFeed(false);
    }
  };

  const runChannelSearch = async (rawQuery: string) => {
    const q = rawQuery.trim() || 'tech';
    if (!isIncognito && rawQuery.trim()) {
      setInterestProfile((prev) =>
        recordInterestSignal(prev, { type: 'search', searchQuery: rawQuery.trim() })
      );
    }
    setSelectedChannel(null);
    setIsSearchingChannels(true);
    try {
      const token = getAccessToken();
      const subSet = new Set(subscriptions.map((s) => s.channelId));
      const found = await searchYouTubeChannels(q, token, subSet);
      setChannelResults(found);
      setActiveSearchQuery(rawQuery.trim());
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Channel search failed');
    } finally {
      setIsSearchingChannels(false);
    }
  };

  const handleOpenChannel = async (channel: YouTubeChannelResult) => {
    setSelectedChannel(channel);
    setIsSearchingChannels(true);
    try {
      const token = getAccessToken();
      const subSet = new Set(subscriptions.map((s) => s.channelId));
      const vids = await fetchChannelUploads(channel, token, myChannelId, subSet);
      setChannelVideos(vids);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Could not load channel videos');
    } finally {
      setIsSearchingChannels(false);
    }
  };

  const handleToggleSubscribeChannelResult = async (channel: YouTubeChannelResult) => {
    const subSet = new Set(subscriptions.map((s) => s.channelId));
    const currentlySub = subSet.has(channel.channelId) || Boolean(channel.isSubscribed);
    const nextSub = !currentlySub;

    if (nextSub && !isIncognito) {
      setInterestProfile((prev) =>
        recordInterestSignal(prev, { type: 'subscribe', channelTitle: channel.title })
      );
    }

    setChannelResults((prev) =>
      prev.map((c) => (c.channelId === channel.channelId ? { ...c, isSubscribed: nextSub } : c))
    );
    if (selectedChannel?.channelId === channel.channelId) {
      setSelectedChannel({ ...channel, isSubscribed: nextSub });
    }

    if (nextSub) {
      setSubscriptions((prev) => {
        if (prev.some((s) => s.channelId === channel.channelId)) return prev;
        return [
          {
            id: `sub-${channel.channelId}`,
            channelId: channel.channelId,
            title: channel.title,
            thumbnailUrl: channel.thumbnailUrl,
          },
          ...prev,
        ];
      });
    } else {
      setSubscriptions((prev) => prev.filter((s) => s.channelId !== channel.channelId));
    }

    const token = getAccessToken();
    if (token && channel.channelId.startsWith('UC') && nextSub) {
      try {
        await subscribeToYouTubeChannel(channel.channelId, token);
        showToast(`Subscribed to ${channel.title} on YouTube`);
        return;
      } catch {
        // Fallback toast below
      }
    }
    showToast(nextSub ? `Subscribed to ${channel.title}` : `Unsubscribed from ${channel.title}`);
  };

  const runInterestOrSearchQuery = async (
    rawQuery: string,
    catLabel = selectedCategory,
    sortOverride?: 'latest' | 'relevance'
  ) => {
    const q = rawQuery.trim();
    if (!q && catLabel === 'All') {
      setActiveSearchQuery('');
      setVideos(homeFeedBase);
      return;
    }

    const activeSort = sortOverride ?? searchSort;

    if (q && !isIncognito) {
      setInterestProfile((prev) => recordInterestSignal(prev, { type: 'search', searchQuery: q }));
    }

    const token = getAccessToken();
    const catOption = FEED_CATEGORIES.find((c) => c.label === catLabel);
    setIsSyncingFeed(true);
    try {
      let results: VideoItem[] = [];
      if (token) {
        const subscribedChannelIds = new Set(subscriptions.map((s) => s.channelId));
        results = await searchYouTubeVideos(q, token, {
          categoryId: catOption?.categoryId,
          categoryLabel: catLabel,
          myChannelId,
          subscribedChannelIds,
          sortBy: activeSort,
        });
      } else {
        results = await fetchLiveYouTubeFallback(
          q || catLabel,
          'videos',
          catLabel === 'All' ? 'YouTube' : catLabel,
          activeSort
        );
      }
      setActiveSearchQuery(q);
      setVideos(
        activeSort === 'latest'
          ? sortVideosLatestFirst(results)
          : rankVideosByInterest(results, interestProfile, watchedIdSet)
      );
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'YouTube search failed');
    } finally {
      setIsSyncingFeed(false);
    }
  };

  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (searchMode === 'channels') {
      setActiveTab('home');
      await runChannelSearch(searchQuery);
      return;
    }
    if (!getAccessToken() && !searchQuery.trim()) {
      showToast('Sign in with Google to search YouTube');
      return;
    }
    // Always default video search to Latest First
    setSearchSort('latest');
    await runInterestOrSearchQuery(searchQuery, selectedCategory, 'latest');
  };

  const handleSignInNewAccount = async () => {
    setAuthError(null);
    setIsConnectingGoogle(true);
    try {
      const { profile, accessToken } = await signInWithGoogleAccount(true);
      setAccounts((prev) => {
        const filtered = prev.filter((a) => a.uid !== profile.uid);
        return [profile, ...filtered];
      });
      setActiveAccountUid(profile.uid);
      setIsIncognito(false);
      await syncWithYouTubeAccount(accessToken);
      setShowAccountModal(false);
    } catch (err: unknown) {
      setAuthError(err instanceof Error ? err.message : 'Google Sign-In was cancelled.');
    } finally {
      setIsConnectingGoogle(false);
    }
  };

  const handleSwitchAccount = (uid: string) => {
    setActiveAccountUid(uid);
    setIsIncognito(false);
    setShowAccountModal(false);
    const token = getAccessToken();
    if (token) {
      void syncWithYouTubeAccount(token);
    }
    showToast('Switched active Google account');
  };

  const handleSignOut = async () => {
    await logoutGoogleAccount();
    setAccounts([]);
    setActiveAccountUid(null);
    setMyChannelId(undefined);
    setHomeFeedBase([]);
    setVideos([]);
    setShorts([]);
    setLikedVideosList([]);
    setPlaylists([]);
    setPlaylistVideosMap({});
    setSubscriptions([]);
    setCommentsByVideo({});
    setShowAccountModal(false);
    showToast('Signed out of YouTube sync');
  };

  const openVideoPlayer = async (video: VideoItem, offlineRecord?: OfflineVideoRecord) => {
    if (activeOfflineBlobUrl) {
      URL.revokeObjectURL(activeOfflineBlobUrl);
      setActiveOfflineBlobUrl(null);
    }
    if (offlineRecord) {
      const url = URL.createObjectURL(offlineRecord.blob);
      setActiveOfflineBlobUrl(url);
    }

    setActiveVideo(video);
    setIsPlayerMinimized(false);
    recordWatchHistoryAndInterest(video);
    void hydrateRealVideoDetailsAndComments(video);
  };

  const handlePlayOfflineRecord = (record: OfflineVideoRecord) => {
    const match =
      allKnownVideos.find((v) => v.id === record.id) || {
        id: record.id,
        title: record.title,
        description: 'Playing offline cached item from NexTube local vault.',
        channelId: 'offline',
        channelTitle: record.channelTitle,
        channelSubscribers: 'Offline Copy',
        thumbnailUrl: record.thumbnailUrl,
        streamUrl: '',
        durationSeconds: record.durationSeconds,
        durationLabel: record.durationLabel,
        viewCountLabel: 'Offline playback',
        publishedAtLabel: 'Saved locally',
        category: 'Offline',
        likeCount: 0,
        maxQualityLabel: record.quality.toUpperCase(),
        sponsorSegments: [],
        subtitles: [],
        source: 'youtube' as const,
      };
    void openVideoPlayer(match, record);
  };

  const handleToggleLike = async (video: VideoItem) => {
    const nextLiked = !video.isLiked;
    if (nextLiked && !isIncognito) {
      setInterestProfile((prev) => recordInterestSignal(prev, { type: 'like', video }));
    }
    const updateList = (list: VideoItem[]) =>
      list.map((v) =>
        v.id === video.id
          ? { ...v, isLiked: nextLiked, likeCount: Math.max(0, v.likeCount + (nextLiked ? 1 : -1)) }
          : v
      );

    setHomeFeedBase(updateList);
    setVideos(updateList);
    setShorts(updateList);
    if (nextLiked) {
      setLikedVideosList((prev) =>
        prev.some((v) => v.id === video.id) ? updateList(prev) : [{ ...video, isLiked: true }, ...prev]
      );
    } else {
      setLikedVideosList((prev) => prev.filter((v) => v.id !== video.id));
    }

    if (activeVideo?.id === video.id) {
      setActiveVideo((prev) =>
        prev
          ? {
              ...prev,
              isLiked: nextLiked,
              likeCount: Math.max(0, prev.likeCount + (nextLiked ? 1 : -1)),
            }
          : null
      );
    }

    const token = getAccessToken();
    if (token && video.youtubeId) {
      try {
        await rateYouTubeVideo(video.youtubeId, nextLiked ? 'like' : 'none', token);
        showToast(nextLiked ? 'Liked & synced to YouTube' : 'Removed like on YouTube');
      } catch {
        showToast(nextLiked ? 'Liked in NexTube' : 'Like removed');
      }
    }
  };

  const handleDislikeVideo = (video: VideoItem) => {
    if (!isIncognito) {
      setInterestProfile((prev) => recordInterestSignal(prev, { type: 'dislike', video }));
    }
    showToast('Updated recommendations based on your feedback');
  };

  const handleToggleSubscribe = async (video: VideoItem) => {
    const nextSub = !video.isSubscribed;
    if (nextSub && !isIncognito) {
      setInterestProfile((prev) =>
        recordInterestSignal(prev, {
          type: 'subscribe',
          video,
          channelTitle: video.channelTitle,
        })
      );
    }
    const updateSub = (list: VideoItem[]) =>
      list.map((v) => (v.channelId === video.channelId ? { ...v, isSubscribed: nextSub } : v));

    setHomeFeedBase(updateSub);
    setVideos(updateSub);
    setShorts(updateSub);
    if (activeVideo?.channelId === video.channelId) {
      setActiveVideo((prev) => (prev ? { ...prev, isSubscribed: nextSub } : null));
    }

    if (nextSub) {
      setSubscriptions((prev) => {
        if (prev.some((s) => s.channelId === video.channelId)) return prev;
        return [
          {
            id: `sub-${video.channelId}`,
            channelId: video.channelId,
            title: video.channelTitle,
            thumbnailUrl: video.thumbnailUrl,
          },
          ...prev,
        ];
      });
    } else {
      setSubscriptions((prev) => prev.filter((s) => s.channelId !== video.channelId));
    }

    const token = getAccessToken();
    if (token && video.channelId.startsWith('UC') && nextSub) {
      try {
        await subscribeToYouTubeChannel(video.channelId, token);
        showToast(`Subscribed to ${video.channelTitle} on YouTube`);
        return;
      } catch {
        // Fallback toast below
      }
    }
    showToast(
      nextSub ? `Subscribed to ${video.channelTitle}` : `Unsubscribed from ${video.channelTitle}`
    );
  };

  const handleAddComment = async (videoId: string, text: string) => {
    const targetVideo = allKnownVideos.find((v) => v.id === videoId);
    const token = getAccessToken();

    if (token && targetVideo?.youtubeId) {
      try {
        const posted = await postYouTubeComment(targetVideo.youtubeId, text, token);
        setCommentsByVideo((prev) => ({
          ...prev,
          [videoId]: [posted, ...(prev[videoId] || [])],
        }));
        showToast('Comment posted & synced to YouTube');
        return;
      } catch {
        // Fall through if comments disabled or offline
      }
    }

    const newComment: CommentItem = {
      id: `c-${Date.now()}`,
      videoId,
      authorName: activeAccount?.displayName || 'You',
      authorHandle: activeAccount?.channelHandle || '@nextube_user',
      authorAvatarColor: accentColor,
      text,
      publishedAt: 'Just now',
      likeCount: 0,
      isCreatorOwnComment: true,
    };

    setCommentsByVideo((prev) => ({
      ...prev,
      [videoId]: [newComment, ...(prev[videoId] || [])],
    }));
    showToast('Comment posted');
  };

  const handleDeleteComment = async (comment: CommentItem) => {
    const token = getAccessToken();
    let synced = false;
    if (token && !comment.id.startsWith('c-')) {
      try {
        await deleteYouTubeComment(comment.id, token);
        synced = true;
      } catch {
        synced = false;
      }
    }

    setCommentsByVideo((prev) => ({
      ...prev,
      [comment.videoId]: (prev[comment.videoId] || []).map((c) =>
        c.id === comment.id ? { ...c, moderationStatus: 'deleted' } : c
      ),
    }));

    setModerationLog((prev) => [
      {
        id: `mod-${Date.now()}`,
        commentId: comment.id,
        videoId: comment.videoId,
        authorName: comment.authorName,
        excerpt: comment.text,
        action: 'deleted',
        timestamp: 'Just now',
        syncedToYouTube: synced,
      },
      ...prev,
    ]);
    showToast(synced ? 'Comment deleted on YouTube' : 'Comment deleted');
  };

  const handleReportComment = async (comment: CommentItem, reason: string) => {
    const token = getAccessToken();
    let synced = false;
    if (token && !comment.id.startsWith('c-')) {
      try {
        await reportYouTubeCommentAsSpam(comment.id, token);
        synced = true;
      } catch {
        synced = false;
      }
    }

    setCommentsByVideo((prev) => ({
      ...prev,
      [comment.videoId]: (prev[comment.videoId] || []).map((c) =>
        c.id === comment.id ? { ...c, moderationStatus: 'reported', reportReason: reason } : c
      ),
    }));

    setModerationLog((prev) => [
      {
        id: `mod-${Date.now()}`,
        commentId: comment.id,
        videoId: comment.videoId,
        authorName: comment.authorName,
        excerpt: comment.text,
        action: 'reported',
        reason,
        timestamp: 'Just now',
        syncedToYouTube: synced,
      },
      ...prev,
    ]);
    showToast(synced ? 'Comment reported to YouTube' : 'Comment flagged for guideline review');
  };

  const handleToggleLikeComment = (videoId: string, commentId: string) => {
    setCommentsByVideo((prev) => ({
      ...prev,
      [videoId]: (prev[videoId] || []).map((c) => {
        if (c.id !== commentId) return c;
        const liked = !c.isLiked;
        return { ...c, isLiked: liked, likeCount: Math.max(0, c.likeCount + (liked ? 1 : -1)) };
      }),
    }));
  };

  const handleStartSingleDownload = async (
    video: VideoItem,
    quality: DownloadQuality,
    saveToGallery: boolean
  ) => {
    setDownloadProgressMap((prev) => ({
      ...prev,
      [video.id]: {
        videoId: video.id,
        title: video.title,
        quality,
        progress: 5,
        status: 'downloading',
      },
    }));

    try {
      await downloadMediaWithProgress(
        video,
        quality,
        (pct) => {
          setDownloadProgressMap((prev) => ({
            ...prev,
            [video.id]: {
              videoId: video.id,
              title: video.title,
              quality,
              progress: pct,
              status: pct >= 100 ? 'completed' : 'downloading',
            },
          }));
        },
        { saveToGallery }
      );
      await refreshOfflineVault();
      showToast(
        saveToGallery
          ? `Saved ${quality.toUpperCase()} to Media Gallery & Offline Vault`
          : `Saved ${quality.toUpperCase()} to Offline Vault`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Download failed';
      setDownloadProgressMap((prev) => ({
        ...prev,
        [video.id]: {
          videoId: video.id,
          title: video.title,
          quality,
          progress: 0,
          status: 'error',
          errorMessage: msg,
        },
      }));
    }
  };

  const handleDownloadEntirePlaylist = async (
    playlist: PlaylistSummary,
    playlistVideos: VideoItem[],
    qualities: Record<string, DownloadQuality>,
    exportToGallery: boolean
  ) => {
    for (const vid of playlistVideos) {
      const q = qualities[vid.id] || '720p';
      setDownloadProgressMap((prev) => ({
        ...prev,
        [vid.id]: {
          videoId: vid.id,
          title: vid.title,
          quality: q,
          progress: 8,
          status: 'downloading',
        },
      }));
      try {
        await downloadMediaWithProgress(
          vid,
          q,
          (pct) => {
            setDownloadProgressMap((prev) => ({
              ...prev,
              [vid.id]: {
                videoId: vid.id,
                title: vid.title,
                quality: q,
                progress: pct,
                status: pct >= 100 ? 'completed' : 'downloading',
              },
            }));
          },
          { saveToGallery: exportToGallery, playlistId: playlist.id }
        );
      } catch {
        setDownloadProgressMap((prev) => ({
          ...prev,
          [vid.id]: {
            videoId: vid.id,
            title: vid.title,
            quality: q,
            progress: 0,
            status: 'error',
            errorMessage: 'Track failed',
          },
        }));
      }
    }

    await savePlaylistMetadata(
      { ...playlist, videoIds: playlistVideos.map((v) => v.id) },
      qualities
    );
    await refreshOfflineVault();
    showToast(`Playlist "${playlist.title}" saved for offline viewing`);
  };

  const filteredVideos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const base =
      !q || q === activeSearchQuery.toLowerCase()
        ? videos
        : videos.filter(
            (v) =>
              v.title.toLowerCase().includes(q) ||
              v.channelTitle.toLowerCase().includes(q) ||
              v.category.toLowerCase().includes(q)
          );
    if (activeSearchQuery.trim() && searchSort === 'latest') {
      return sortVideosLatestFirst(base);
    }
    return rankVideosByInterest(base, interestProfile, watchedIdSet);
  }, [videos, searchQuery, activeSearchQuery, searchSort, interestProfile, watchedIdSet]);

  const rankedShorts = useMemo(
    () => rankVideosByInterest(shorts, interestProfile, watchedIdSet),
    [shorts, interestProfile, watchedIdSet]
  );

  const rankedRelatedVideos = useMemo(
    () =>
      rankVideosByInterest(
        allKnownVideos.filter((v) => v.id !== activeVideo?.id),
        interestProfile,
        watchedIdSet
      ).slice(0, 12),
    [allKnownVideos, activeVideo?.id, interestProfile, watchedIdSet]
  );

  const subscriptionFeedVideos = useMemo(() => {
    const subChannelIds = new Set(subscriptions.map((s) => s.channelId));
    const q = searchQuery.trim().toLowerCase();
    const list = allKnownVideos.filter((v) => {
      const isSub = v.isSubscribed || subChannelIds.has(v.channelId);
      if (!isSub) return false;
      if (!q) return true;
      return v.title.toLowerCase().includes(q) || v.channelTitle.toLowerCase().includes(q);
    });
    return rankVideosByInterest(list, interestProfile, watchedIdSet);
  }, [allKnownVideos, subscriptions, searchQuery, interestProfile, watchedIdSet]);

  const historyVideos = useMemo(
    () =>
      historyIds
        .map(
          (id) =>
            allKnownVideos.find((v) => v.id === id) || persistedHistory.find((v) => v.id === id)
        )
        .filter((v): v is VideoItem => Boolean(v)),
    [historyIds, allKnownVideos, persistedHistory]
  );

  const commentsCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const [vidId, list] of Object.entries(commentsByVideo)) {
      map[vidId] = list.filter((c) => c.moderationStatus !== 'deleted').length;
    }
    return map;
  }, [commentsByVideo]);

  const handleToggleShortsCommentsTranslate = async () => {
    if (!shortsCommentTarget) return;
    if (isShortsCommentsTranslated) {
      setIsShortsCommentsTranslated(false);
      return;
    }
    const list = commentsByVideo[shortsCommentTarget.id] || [];
    if (list.length === 0) return;
    setIsTranslatingShortsComments(true);
    try {
      const translated = await translateTexts(
        list.map((c) => c.text),
        preferredLanguage.name,
        preferredLanguage.code
      );
      const map: Record<string, string> = {};
      list.forEach((c, idx) => {
        map[c.id] = translated[idx] || c.text;
      });
      setShortsTranslatedComments(map);
      setIsShortsCommentsTranslated(true);
    } finally {
      setIsTranslatingShortsComments(false);
    }
  };

  const renderConnectYouTubeState = (title: string, subtitle: string) => (
    <div className="max-w-lg mx-auto my-8 p-7 sm:p-9 rounded-3xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-white/10 text-center space-y-5 shadow-sm">
      <div className="w-14 h-14 rounded-2xl bg-[var(--nextube-accent)]/10 text-[var(--nextube-accent)] flex items-center justify-center mx-auto">
        <Tv className="w-7 h-7" />
      </div>
      <div className="space-y-2">
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
          {subtitle}
        </p>
      </div>

      {authError && (
        <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 text-xs text-rose-700 dark:text-rose-300 text-left">
          {authError}
        </div>
      )}

      <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
        <button
          type="button"
          disabled={isConnectingGoogle}
          onClick={() => void handleSignInNewAccount()}
          className="gsi-material-button w-full sm:w-auto"
        >
          <div className="gsi-material-button-content-wrapper">
            <div className="gsi-material-button-icon">
              <svg
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                style={{ display: 'block' }}
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
            </div>
            <span className="gsi-material-button-contents">
              {isConnectingGoogle ? 'Connecting...' : 'Sign in with Google'}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('library')}
          className="w-full sm:w-auto min-h-[44px] px-4 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-semibold hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
        >
          Open Offline Vault ({offlineVideos.length + watchLaterItems.length})
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] text-zinc-900 dark:text-zinc-100 pb-20 sm:pb-8 transition-colors duration-200">
      {/* Top Navigation Bar: Strict 3-zone contract */}
      <header className="sticky top-0 z-30 h-14 px-4 sm:px-6 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-md border-b border-zinc-200 dark:border-white/10">
        <div className="max-w-7xl mx-auto h-full flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Single-line Brand wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="text-lg font-extrabold tracking-tight flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <span className="w-7 h-7 rounded-lg bg-[var(--nextube-accent)] text-white flex items-center justify-center">
              <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
            </span>
            <span>NexTube</span>
          </button>

          {/* Zone 2: 5 concise single-line navigation links */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            {(
              [
                { id: 'home', label: 'Home' },
                { id: 'shorts', label: 'Shorts' },
                { id: 'subscriptions', label: 'Subscriptions' },
                { id: 'library', label: 'Library' },
                { id: 'architecture', label: 'Architecture' },
              ] as Array<{ id: TabId; label: string }>
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`py-1 whitespace-nowrap shrink-0 transition-colors border-b-2 ${
                  activeTab === item.id
                    ? 'text-zinc-900 dark:text-white border-[var(--nextube-accent)] font-semibold'
                    : 'text-zinc-500 dark:text-zinc-400 border-transparent hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: 1 primary action (Google Account Switcher / Theme / Sign In) */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setShowAccountModal(true)}
              aria-label="Open Google Account Switcher and Theme Controls"
              className="min-h-[40px] pl-2 pr-3 py-1 rounded-xl border border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5 flex items-center gap-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
            >
              {isIncognito ? (
                <>
                  <EyeOff className="w-4 h-4 text-zinc-400" />
                  <span>Incognito</span>
                </>
              ) : activeAccount ? (
                <>
                  {activeAccount.photoURL ? (
                    <MediaImage
                      src={activeAccount.photoURL}
                      alt={activeAccount.displayName}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <span className="w-6 h-6 rounded-full bg-[var(--nextube-accent)] text-white flex items-center justify-center text-[11px]">
                      {activeAccount.displayName.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="max-w-[110px] truncate">{activeAccount.displayName}</span>
                </>
              ) : (
                <>
                  <UserCircle2 className="w-4 h-4 text-[var(--nextube-accent)]" />
                  <span>Sign in</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 space-y-6">
        {/* Quick User Appearance Strip (White / Dark / System + Accent Color) */}
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-zinc-200 dark:border-white/10">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-white/[0.06]">
            {(
              [
                { id: 'light', label: 'White', icon: Sun },
                { id: 'dark', label: 'Dark', icon: Moon },
                { id: 'system', label: 'System', icon: Monitor },
              ] as Array<{ id: ThemeMode; label: string; icon: typeof Sun }>
            ).map((mode) => {
              const Icon = mode.icon;
              const active = themeMode === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setThemeMode(mode.id)}
                  className={`min-h-[34px] px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    active
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{mode.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAppearanceBar((v) => !v)}
              className="min-h-[36px] px-3 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-medium flex items-center gap-2 hover:bg-zinc-50 dark:hover:bg-white/5 transition-colors"
            >
              <span
                className="w-3.5 h-3.5 rounded-full border border-black/10 dark:border-white/20"
                style={{ backgroundColor: accentColor }}
              />
              <Palette className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
              <span>Color</span>
            </button>

            {activeAccount && (
              <button
                type="button"
                disabled={isSyncingFeed}
                onClick={() => {
                  const token = getAccessToken();
                  if (token) void syncWithYouTubeAccount(token);
                }}
                aria-label="Refresh YouTube sync"
                className="min-h-[36px] px-3 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-medium flex items-center gap-1.5 hover:bg-zinc-50 dark:hover:bg-white/5 disabled:opacity-50 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingFeed ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Sync</span>
              </button>
            )}
          </div>
        </div>

        {/* Expandable Quick Color Swatch Picker */}
        {showAppearanceBar && (
          <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-[#141414] border border-zinc-200 dark:border-white/10 flex flex-wrap items-center justify-between gap-3">
            <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-300">
              Select Accent Color
            </span>
            <div className="flex flex-wrap items-center gap-2.5">
              {ACCENT_COLORS.map((preset) => {
                const active = accentColor.toLowerCase() === preset.value.toLowerCase();
                return (
                  <button
                    key={preset.value}
                    type="button"
                    aria-label={`Choose ${preset.name} accent color`}
                    onClick={() => {
                      setAccentColor(preset.value);
                      showToast(`Accent color set to ${preset.name}`);
                    }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform ${
                      active
                        ? 'ring-2 ring-offset-2 ring-zinc-900 dark:ring-white dark:ring-offset-[#141414] scale-110'
                        : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: preset.value }}
                  >
                    {active && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Search & Filter Workspace Toolbar (for Home & Subscriptions) */}
        {(activeTab === 'home' || activeTab === 'subscriptions') && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-2xl flex flex-wrap sm:flex-nowrap gap-2">
                <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-white/[0.06] shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchMode('videos');
                      setSelectedChannel(null);
                    }}
                    className={`h-9 px-3 rounded-lg text-xs font-semibold transition-colors ${
                      searchMode === 'videos'
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    Videos
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchMode('channels');
                      if (channelResults.length === 0) {
                        void runChannelSearch(searchQuery || 'tech');
                      }
                    }}
                    className={`h-9 px-3 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                      searchMode === 'channels'
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Channels
                  </button>
                </div>

                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={
                      searchMode === 'channels'
                        ? 'Search YouTube channels & creators (e.g. MKBHD, MrBeast)...'
                        : 'Search live YouTube videos, creators, or topics...'
                    }
                    className="w-full h-11 pl-10 pr-10 rounded-xl bg-zinc-50 dark:bg-[#141414] border border-zinc-200 dark:border-white/10 focus:border-[var(--nextube-accent)] text-sm outline-none transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setActiveSearchQuery('');
                        setSelectedChannel(null);
                        if (searchMode === 'videos' && selectedCategory === 'All') {
                          setVideos(homeFeedBase);
                        }
                      }}
                      aria-label="Clear search"
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  className="h-11 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold shrink-0 hover:opacity-90 transition-opacity"
                >
                  Search
                </button>
              </form>

              <div className="flex items-center gap-2">
                {playlists[0] && (
                  <button
                    type="button"
                    onClick={() => setPlaylistDownloadTarget(playlists[0])}
                    className="min-h-[42px] px-3.5 rounded-xl bg-zinc-50 dark:bg-[#141414] border border-zinc-200 dark:border-white/10 hover:border-[var(--nextube-accent)] text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
                  >
                    <ListVideo className="w-4 h-4 text-[var(--nextube-accent)]" />
                    Offline Playlists
                  </button>
                )}
              </div>
            </div>

            {searchMode === 'videos' && activeSearchQuery && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-zinc-500 dark:text-zinc-400">
                  Results for <strong className="text-zinc-900 dark:text-white">&ldquo;{activeSearchQuery}&rdquo;</strong>
                </span>
                <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchSort('latest');
                      void runInterestOrSearchQuery(activeSearchQuery, selectedCategory, 'latest');
                    }}
                    className={`min-h-[30px] px-3 rounded-lg font-semibold transition-colors ${
                      searchSort === 'latest'
                        ? 'bg-[var(--nextube-accent)] text-white'
                        : 'text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    Latest First
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchSort('relevance');
                      void runInterestOrSearchQuery(activeSearchQuery, selectedCategory, 'relevance');
                    }}
                    className={`min-h-[30px] px-3 rounded-lg font-semibold transition-colors ${
                      searchSort === 'relevance'
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-300'
                    }`}
                  >
                    Relevance
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'home' && activeAccount && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                  {FEED_CATEGORIES.map((cat) => (
                    <button
                      key={cat.label}
                      type="button"
                      onClick={() => void handleSelectCategory(cat.label)}
                      className={`min-h-[38px] px-4 rounded-xl text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                        selectedCategory === cat.label
                          ? 'bg-[var(--nextube-accent)] text-white font-semibold'
                          : 'bg-zinc-50 dark:bg-[#141414] border border-zinc-200 dark:border-white/10 text-zinc-600 dark:text-zinc-300 hover:border-zinc-300 dark:hover:border-white/20'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                {topInterestLabels.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 shrink-0">
                      For You:
                    </span>
                    {topInterestLabels.map((topic) => (
                      <button
                        key={topic}
                        type="button"
                        onClick={() => {
                          setSearchQuery(topic);
                          void runInterestOrSearchQuery(topic, 'All');
                        }}
                        className="min-h-[30px] px-3 rounded-lg bg-[var(--nextube-accent)]/10 text-[var(--nextube-accent)] text-xs font-medium whitespace-nowrap shrink-0 hover:bg-[var(--nextube-accent)]/20 transition-colors"
                      >
                        {topic}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const cleared: InterestProfile = {
                          topicWeights: {},
                          channelWeights: {},
                          recentSearches: [],
                          dislikedVideoIds: [],
                          updatedAt: new Date().toISOString(),
                        };
                        setInterestProfile(cleared);
                        saveInterestProfile(cleared);
                        setPersistedHistory([]);
                        savePersistedHistory([]);
                        setHistoryIds([]);
                        showToast('Cleared interest & watch history profile');
                      }}
                      className="min-h-[30px] px-2.5 rounded-lg text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white whitespace-nowrap shrink-0"
                    >
                      Reset Interests
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* HOME FEED TAB (100% Live YouTube Sync) */}
        {activeTab === 'home' && (
          <div className="space-y-6">
            {activeAccount && ytApiNotice && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/30 text-xs text-amber-800 dark:text-amber-200 flex items-start justify-between gap-3">
                <span className="leading-relaxed">{ytApiNotice}</span>
                <button
                  type="button"
                  onClick={() => setYtApiNotice(null)}
                  aria-label="Dismiss YouTube API notice"
                  className="shrink-0 p-1 rounded-lg hover:bg-amber-500/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {searchMode === 'channels' ? (
              selectedChannel ? (
                <div className="space-y-5">
                  <div className="p-4 sm:p-5 rounded-2xl bg-zinc-50 dark:bg-[#141414] border border-zinc-200 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <button
                        type="button"
                        onClick={() => setSelectedChannel(null)}
                        aria-label="Back to channel results"
                        className="w-9 h-9 rounded-xl border border-zinc-200 dark:border-white/10 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-white/10 shrink-0"
                      >
                        <ArrowLeft className="w-4 h-4" />
                      </button>
                      <MediaImage
                        src={selectedChannel.thumbnailUrl}
                        alt={selectedChannel.title}
                        priority
                        className="w-12 h-12 rounded-full object-cover border border-zinc-200 dark:border-white/15 shrink-0"
                      />
                      <div className="min-w-0">
                        <h2 className="text-base font-bold truncate">{selectedChannel.title}</h2>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                          {[selectedChannel.handle, selectedChannel.subscriberCountLabel]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleToggleSubscribeChannelResult(selectedChannel)}
                      className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors ${
                        selectedChannel.isSubscribed ||
                        subscriptions.some((s) => s.channelId === selectedChannel.channelId)
                          ? 'bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-zinc-100'
                          : 'bg-[var(--nextube-accent)] text-white'
                      }`}
                    >
                      {(selectedChannel.isSubscribed ||
                        subscriptions.some((s) => s.channelId === selectedChannel.channelId)) && (
                        <Bell className="w-3.5 h-3.5" />
                      )}
                      {selectedChannel.isSubscribed ||
                      subscriptions.some((s) => s.channelId === selectedChannel.channelId)
                        ? 'Subscribed'
                        : 'Subscribe'}
                    </button>
                  </div>

                  {isSearchingChannels ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {Array.from({ length: 6 }).map((_, idx) => (
                        <div key={idx} className="space-y-3">
                          <div className="aspect-video rounded-2xl skeleton-shimmer" />
                          <div className="h-4 w-4/5 rounded skeleton-shimmer" />
                        </div>
                      ))}
                    </div>
                  ) : channelVideos.length === 0 ? (
                    <div className="p-8 rounded-2xl border border-dashed border-zinc-300 dark:border-white/15 text-center text-xs text-zinc-500">
                      No public videos returned for this channel.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                      {channelVideos.map((vid, idx) => {
                        const isWatchLater = watchLaterIdSet.has(vid.id);
                        return (
                          <article
                            key={vid.id}
                            onMouseEnter={() => {
                              if (vid.youtubeId) void fetchLiveYouTubeVideoDetails(vid.youtubeId);
                            }}
                            className="rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-white/10 overflow-hidden flex flex-col group"
                          >
                            <button
                              type="button"
                              onClick={() => void openVideoPlayer(vid)}
                              className="relative aspect-video w-full bg-zinc-200 dark:bg-zinc-900 overflow-hidden text-left"
                            >
                              <MediaImage
                                src={vid.thumbnailUrl}
                                alt={vid.title}
                                priority={idx < 3}
                                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                              />
                              <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white font-mono text-[11px] tabular-nums">
                                {vid.durationLabel}
                              </span>
                            </button>
                            <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                              <div className="space-y-1">
                                <button
                                  type="button"
                                  onClick={() => void openVideoPlayer(vid)}
                                  className="text-left"
                                >
                                  <h3 className="text-sm font-semibold line-clamp-2 hover:text-[var(--nextube-accent)]">
                                    {vid.title}
                                  </h3>
                                </button>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                  {vid.viewCountLabel} · {vid.publishedAtLabel}
                                </p>
                              </div>
                              <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-zinc-100 dark:border-white/5">
                                <button
                                  type="button"
                                  aria-pressed={isWatchLater}
                                  onClick={() => void handleToggleWatchLater(vid)}
                                  className={`min-h-[34px] px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 ${
                                    isWatchLater
                                      ? 'bg-[var(--nextube-accent)]/10 text-[var(--nextube-accent)]'
                                      : 'bg-zinc-100 dark:bg-white/[0.07] text-zinc-700 dark:text-zinc-200'
                                  }`}
                                >
                                  {isWatchLater ? (
                                    <BookmarkCheck className="w-3.5 h-3.5" />
                                  ) : (
                                    <Bookmark className="w-3.5 h-3.5" />
                                  )}
                                  {isWatchLater ? 'Saved' : 'Watch Later'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDownloadTargetVideo(vid)}
                                  className="min-h-[34px] px-2.5 rounded-xl text-xs font-semibold bg-zinc-100 dark:bg-white/[0.07] hover:bg-[var(--nextube-accent)] hover:text-white flex items-center gap-1.5"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  Download
                                </button>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : isSearchingChannels ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-2xl border border-zinc-200 dark:border-white/10 flex items-center gap-3"
                    >
                      <div className="w-14 h-14 rounded-full skeleton-shimmer shrink-0" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-3/4 rounded skeleton-shimmer" />
                        <div className="h-3 w-1/2 rounded skeleton-shimmer" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : channelResults.length === 0 ? (
                <div className="p-10 rounded-2xl border border-dashed border-zinc-300 dark:border-white/15 text-center space-y-2">
                  <Users className="w-7 h-7 mx-auto text-zinc-400" />
                  <p className="text-sm font-semibold">Search any YouTube Channel</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Enter a creator name or @handle above to browse channels, subscribe, and watch their uploads.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {channelResults.map((ch) => {
                    const isSub =
                      Boolean(ch.isSubscribed) ||
                      subscriptions.some((s) => s.channelId === ch.channelId);
                    return (
                      <div
                        key={ch.channelId}
                        className="p-4 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-white/10 flex flex-col justify-between gap-4 hover:border-[var(--nextube-accent)]/50 transition-colors"
                      >
                        <button
                          type="button"
                          onClick={() => void handleOpenChannel(ch)}
                          className="flex items-start gap-3.5 text-left"
                        >
                          <MediaImage
                            src={ch.thumbnailUrl}
                            alt={ch.title}
                            className="w-14 h-14 rounded-full object-cover border border-zinc-200 dark:border-white/15 shrink-0"
                          />
                          <div className="min-w-0 space-y-1">
                            <h3 className="text-sm font-bold truncate hover:text-[var(--nextube-accent)]">
                              {ch.title}
                            </h3>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                              {[ch.handle, ch.subscriberCountLabel].filter(Boolean).join(' · ')}
                            </p>
                            {ch.description && (
                              <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2">
                                {ch.description}
                              </p>
                            )}
                          </div>
                        </button>

                        <div className="flex items-center justify-between gap-2 pt-3 border-t border-zinc-100 dark:border-white/5">
                          <button
                            type="button"
                            onClick={() => void handleOpenChannel(ch)}
                            className="min-h-[36px] px-3 rounded-xl bg-zinc-100 dark:bg-white/[0.07] hover:bg-zinc-200 dark:hover:bg-white/15 text-xs font-semibold transition-colors"
                          >
                            View Videos
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleToggleSubscribeChannelResult(ch)}
                            className={`min-h-[36px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                              isSub
                                ? 'bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-zinc-100'
                                : 'bg-[var(--nextube-accent)] text-white'
                            }`}
                          >
                            {isSub && <Bell className="w-3.5 h-3.5" />}
                            {isSub ? 'Subscribed' : 'Subscribe'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : !activeAccount ? (
              renderConnectYouTubeState(
                'Connect Your Google Account to Sync YouTube',
                'NexTube syncs your real YouTube Home feed, subscriptions, playlists, liked videos, and Shorts directly from YouTube — with zero dummy content.'
              )
            ) : isSyncingFeed ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx} className="space-y-3">
                    <div className="aspect-video rounded-2xl skeleton-shimmer" />
                    <div className="h-4 w-4/5 rounded skeleton-shimmer" />
                    <div className="h-3 w-1/2 rounded skeleton-shimmer" />
                  </div>
                ))}
              </div>
            ) : filteredVideos.length === 0 ? (
              <div className="p-10 rounded-2xl border border-dashed border-zinc-300 dark:border-white/15 text-center space-y-3">
                <Tv className="w-7 h-7 mx-auto text-zinc-400" />
                <p className="text-sm font-semibold">No videos found for this filter</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {authError || 'Try another search term or reload the live YouTube feed.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveSearchQuery('');
                    setSelectedCategory('All');
                    const token = getAccessToken();
                    if (token) void syncWithYouTubeAccount(token);
                  }}
                  className="min-h-[40px] px-4 rounded-xl bg-[var(--nextube-accent)] text-white text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Reload YouTube Feed
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredVideos.map((vid, idx) => {
                  const isOffline = offlineVideoIdSet.has(vid.id);
                  const isWatchLater = watchLaterIdSet.has(vid.id);
                  return (
                    <article
                      key={vid.id}
                      onMouseEnter={() => {
                        if (vid.youtubeId) void fetchLiveYouTubeVideoDetails(vid.youtubeId);
                      }}
                      className="rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-white/10 overflow-hidden flex flex-col group"
                    >
                      <button
                        type="button"
                        onClick={() => void openVideoPlayer(vid)}
                        className="relative aspect-video w-full bg-zinc-200 dark:bg-zinc-900 overflow-hidden text-left"
                      >
                        <MediaImage
                          src={vid.thumbnailUrl}
                          alt={vid.title}
                          priority={idx < 3}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                        />
                        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white font-mono text-[11px] tabular-nums">
                          {vid.durationLabel}
                        </span>
                      </button>

                      <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                        <div className="space-y-1.5">
                          <button
                            type="button"
                            onClick={() => void openVideoPlayer(vid)}
                            className="text-left"
                          >
                            <h2 className="text-sm font-semibold leading-snug line-clamp-2 hover:text-[var(--nextube-accent)] transition-colors">
                              {vid.title}
                            </h2>
                          </button>

                          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                            {vid.channelTitle} · {vid.viewCountLabel} · {vid.publishedAtLabel}
                          </p>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-zinc-100 dark:border-white/5">
                          <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 truncate">
                            {vid.maxQualityLabel}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              aria-pressed={isWatchLater}
                              onClick={() => void handleToggleWatchLater(vid)}
                              className={`min-h-[36px] px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                                isWatchLater
                                  ? 'bg-[var(--nextube-accent)]/10 text-[var(--nextube-accent)]'
                                  : 'bg-zinc-100 dark:bg-white/[0.07] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-white/15'
                              }`}
                            >
                              {isWatchLater ? (
                                <>
                                  <BookmarkCheck className="w-3.5 h-3.5" />
                                  Saved
                                </>
                              ) : (
                                <>
                                  <Bookmark className="w-3.5 h-3.5" />
                                  Watch Later
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => setDownloadTargetVideo(vid)}
                              className={`min-h-[36px] px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                                isOffline
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-zinc-100 dark:bg-white/[0.07] hover:bg-[var(--nextube-accent)] hover:text-white'
                              }`}
                            >
                              {isOffline ? (
                                <>
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Offline
                                </>
                              ) : (
                                <>
                                  <Download className="w-3.5 h-3.5" />
                                  Download
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}

            {/* Shorts Shelf Preview inside Home Feed (only when synced Shorts exist) */}
            {activeAccount && rankedShorts.length > 0 && (
              <section className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-base font-bold flex items-center gap-2">
                    <Flame className="w-4 h-4 text-[var(--nextube-accent)]" />
                    Shorts
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('shorts')}
                    className="text-xs font-semibold text-[var(--nextube-accent)] hover:underline"
                  >
                    Open full-screen feed
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {rankedShorts.map((sh) => (
                    <div
                      key={sh.id}
                      className="rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-white/10 overflow-hidden flex flex-col"
                    >
                      <button
                        type="button"
                        onClick={() => setActiveTab('shorts')}
                        className="relative aspect-[9/14] w-full bg-zinc-900 overflow-hidden text-left group"
                      >
                        <MediaImage
                          src={sh.thumbnailUrl}
                          alt={sh.title}
                          className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                        />
                        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />
                        <div className="absolute bottom-2.5 left-3 right-3 text-white space-y-1">
                          <p className="text-xs font-semibold line-clamp-2 leading-snug">
                            {sh.title}
                          </p>
                          <p className="text-[11px] text-white/75">{sh.viewCountLabel}</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDownloadTargetVideo(sh)}
                        className="min-h-[40px] px-3 text-xs font-medium flex items-center justify-center gap-1.5 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 border-t border-zinc-100 dark:border-white/5"
                      >
                        <Download className="w-3.5 h-3.5 text-[var(--nextube-accent)]" />
                        Download Short
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* DEDICATED SHORTS TAB */}
        {activeTab === 'shorts' && (
          <ShortsPlayer
            shorts={rankedShorts}
            commentsCountMap={commentsCountMap}
            onToggleLike={(v) => void handleToggleLike(v)}
            onDislike={handleDislikeVideo}
            onToggleSubscribe={(v) => void handleToggleSubscribe(v)}
            onOpenDownloadSheet={(v) => setDownloadTargetVideo(v)}
            onShortActive={(v) => {
              recordWatchHistoryAndInterest(v);
              void hydrateRealVideoDetailsAndComments(v);
            }}
            onOpenComments={(v) => {
              setIsShortsCommentsTranslated(false);
              setShortsTranslatedComments({});
              setShortsCommentTarget(v);
              void hydrateRealVideoDetailsAndComments(v);
            }}
            isAuthenticated={Boolean(activeAccount)}
            onRequestSignIn={() => void handleSignInNewAccount()}
          />
        )}

        {/* SUBSCRIPTIONS TAB */}
        {activeTab === 'subscriptions' && (
          <div className="space-y-6">
            {!activeAccount ? (
              renderConnectYouTubeState(
                'Sign in to Sync Subscriptions',
                'Connect your Google Account to view your subscribed YouTube channels and their latest uploads.'
              )
            ) : (
              <>
                {subscriptions.length > 0 && (
                  <div className="flex items-center gap-4 overflow-x-auto no-scrollbar pb-2 border-b border-zinc-200 dark:border-white/10">
                    {subscriptions.map((sub) => (
                      <div key={sub.id} className="flex flex-col items-center gap-1.5 shrink-0 w-20">
                        <MediaImage
                          src={sub.thumbnailUrl}
                          alt={sub.title}
                          className="w-12 h-12 rounded-full object-cover border border-zinc-200 dark:border-white/15"
                        />
                        <span className="text-[11px] font-medium text-center truncate w-full">
                          {sub.title}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {subscriptionFeedVideos.length === 0 ? (
                  <div className="p-10 rounded-2xl border border-dashed border-zinc-300 dark:border-white/15 text-center space-y-2">
                    <Tv className="w-7 h-7 mx-auto text-zinc-400" />
                    <p className="text-sm font-semibold">No recent uploads from subscriptions</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Tap Sync above or subscribe to channels inside the video player.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {subscriptionFeedVideos.map((vid) => {
                      const isWatchLater = watchLaterIdSet.has(vid.id);
                      return (
                        <article
                          key={vid.id}
                          className="rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-white/10 overflow-hidden flex flex-col"
                        >
                          <button
                            type="button"
                            onClick={() => void openVideoPlayer(vid)}
                            className="relative aspect-video w-full bg-zinc-200 dark:bg-zinc-900 text-left"
                          >
                            <MediaImage
                              src={vid.thumbnailUrl}
                              alt={vid.title}
                              className="w-full h-full object-cover"
                            />
                            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white font-mono text-[11px] tabular-nums">
                              {vid.durationLabel}
                            </span>
                          </button>
                          <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                            <div className="space-y-1.5">
                              <button
                                type="button"
                                onClick={() => void openVideoPlayer(vid)}
                                className="text-left"
                              >
                                <h3 className="text-sm font-semibold line-clamp-2">{vid.title}</h3>
                              </button>
                              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                                {vid.channelTitle} · {vid.viewCountLabel} · {vid.publishedAtLabel}
                              </p>
                            </div>
                            <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-zinc-100 dark:border-white/5">
                              <button
                                type="button"
                                aria-pressed={isWatchLater}
                                onClick={() => void handleToggleWatchLater(vid)}
                                className={`min-h-[36px] px-2.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                                  isWatchLater
                                    ? 'bg-[var(--nextube-accent)]/10 text-[var(--nextube-accent)]'
                                    : 'bg-zinc-100 dark:bg-white/[0.07] text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-white/15'
                                }`}
                              >
                                {isWatchLater ? (
                                  <>
                                    <BookmarkCheck className="w-3.5 h-3.5" />
                                    Saved
                                  </>
                                ) : (
                                  <>
                                    <Bookmark className="w-3.5 h-3.5" />
                                    Watch Later
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* LIBRARY & OFFLINE DOWNLOADS TAB */}
        {activeTab === 'library' && (
          <LibraryView
            playlists={playlists}
            offlinePlaylists={offlinePlaylists}
            offlineVideos={offlineVideos}
            watchLaterItems={watchLaterItems}
            historyVideos={historyVideos}
            likedVideos={likedVideosList}
            moderationLog={moderationLog}
            isIncognito={isIncognito}
            onPlayVideo={(v) => void openVideoPlayer(v)}
            onPlayOfflineRecord={handlePlayOfflineRecord}
            onOpenPlaylistDownload={(pl) => setPlaylistDownloadTarget(pl)}
            onOpenDownloadSheet={(v) => setDownloadTargetVideo(v)}
            onRemoveWatchLater={async (vidId) => {
              await deleteWatchLaterRecord(vidId);
              await refreshOfflineVault();
              showToast('Removed from Watch Later');
            }}
            onDeleteOfflineVideo={async (vidId) => {
              await deleteOfflineVideo(vidId);
              await refreshOfflineVault();
              showToast('Removed offline file');
            }}
            onDeleteOfflinePlaylist={async (plId) => {
              await deleteOfflinePlaylist(plId);
              await refreshOfflineVault();
              showToast('Removed offline playlist record');
            }}
          />
        )}

        {/* ARCHITECTURE TAB */}
        {activeTab === 'architecture' && (
          <Suspense
            fallback={
              <div className="p-10 text-center text-xs text-zinc-500 dark:text-zinc-400">
                Loading architecture modules...
              </div>
            }
          >
            <ArchitectureBlueprintView />
          </Suspense>
        )}
      </main>

      {/* Mobile Fixed Bottom Thumb-Zone Navigation Bar (within 15% sticky height cap) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-md border-t border-zinc-200 dark:border-white/10 grid grid-cols-5 items-center">
        {(
          [
            { id: 'home', label: 'Home', icon: Home },
            { id: 'shorts', label: 'Shorts', icon: Flame },
            { id: 'subscriptions', label: 'Subs', icon: Compass },
            { id: 'library', label: 'Library', icon: Layers },
            { id: 'architecture', label: 'Modules', icon: FolderKanban },
          ] as Array<{ id: TabId; label: string; icon: typeof Home }>
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? 'text-[var(--nextube-accent)]' : 'text-zinc-500 dark:text-zinc-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium tracking-tight">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Full Custom Gesture Video Player Modal */}
      <VideoPlayerModal
        video={activeVideo}
        offlineBlobUrl={activeOfflineBlobUrl}
        isMinimized={isPlayerMinimized}
        onMinimize={() => setIsPlayerMinimized(true)}
        onClose={() => {
          setActiveVideo(null);
          setIsPlayerMinimized(false);
          if (activeOfflineBlobUrl) {
            URL.revokeObjectURL(activeOfflineBlobUrl);
            setActiveOfflineBlobUrl(null);
          }
        }}
        onOpenDownloadSheet={(v) => setDownloadTargetVideo(v)}
        onToggleLike={(v) => void handleToggleLike(v)}
        onToggleSubscribe={(v) => void handleToggleSubscribe(v)}
        isWatchLater={activeVideo ? watchLaterIdSet.has(activeVideo.id) : false}
        onToggleWatchLater={(v) => void handleToggleWatchLater(v)}
        sponsorBlockEnabled={sponsorBlockEnabled}
        preferredLanguage={preferredLanguage}
        onOpenLanguagePicker={() => setShowLanguagePicker(true)}
        comments={activeVideo ? commentsByVideo[activeVideo.id] || [] : []}
        onAddComment={handleAddComment}
        onDeleteComment={handleDeleteComment}
        onReportComment={handleReportComment}
        onToggleLikeComment={handleToggleLikeComment}
        relatedVideos={rankedRelatedVideos}
        onSelectRelated={(rel) => void openVideoPlayer(rel)}
        onPlayerStateSync={setMiniProgress}
        externalVideoRef={playerVideoRef}
      />

      {/* Persistent Floating Mini-Player when minimized */}
      {activeVideo && isPlayerMinimized && (
        <MiniPlayer
          video={activeVideo}
          isPlaying={miniProgress.isPlaying}
          progressPct={
            miniProgress.duration > 0
              ? (miniProgress.currentTime / miniProgress.duration) * 100
              : 0
          }
          onTogglePlay={() => {
            const el = playerVideoRef.current;
            if (!el || !el.src) {
              setIsPlayerMinimized(false);
              return;
            }
            if (el.paused) el.play().catch(() => {});
            else el.pause();
          }}
          onExpand={() => setIsPlayerMinimized(false)}
          onClose={() => {
            setActiveVideo(null);
            setIsPlayerMinimized(false);
          }}
        />
      )}

      {/* Shorts Comments & Text Translation Bottom Sheet */}
      {shortsCommentTarget && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setShortsCommentTarget(null)}
        >
          <div
            className="w-full sm:max-w-lg bg-white dark:bg-[#141414] rounded-t-3xl sm:rounded-2xl border border-zinc-200 dark:border-white/10 p-5 max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold truncate pr-4">
                Comments · {shortsCommentTarget.title}
              </h3>
              <button
                type="button"
                onClick={() => setShortsCommentTarget(null)}
                aria-label="Close Short comments"
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-zinc-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <CommentsSection
              videoId={shortsCommentTarget.id}
              isCreatorOwnedVideo={Boolean(shortsCommentTarget.isCreatorOwned)}
              comments={commentsByVideo[shortsCommentTarget.id] || []}
              translatedComments={shortsTranslatedComments}
              isTranslated={isShortsCommentsTranslated}
              isTranslating={isTranslatingShortsComments}
              targetLanguage={preferredLanguage}
              onToggleTranslate={() => void handleToggleShortsCommentsTranslate()}
              onAddComment={(txt) => handleAddComment(shortsCommentTarget.id, txt)}
              onDeleteComment={handleDeleteComment}
              onReportComment={handleReportComment}
              onToggleLikeComment={(cid) =>
                handleToggleLikeComment(shortsCommentTarget.id, cid)
              }
            />
          </div>
        </div>
      )}

      {/* Single Video / Short Download Quality & Gallery Sheet */}
      <DownloadSheet
        video={downloadTargetVideo}
        onClose={() => setDownloadTargetVideo(null)}
        onStartDownload={handleStartSingleDownload}
        activeProgress={
          downloadTargetVideo ? downloadProgressMap[downloadTargetVideo.id] : undefined
        }
        isAlreadyOffline={
          downloadTargetVideo ? offlineVideoIdSet.has(downloadTargetVideo.id) : false
        }
      />

      {/* Entire Playlist Offline Downloader Modal */}
      <PlaylistDownloadModal
        playlist={playlistDownloadTarget}
        videos={allKnownVideos}
        onClose={() => setPlaylistDownloadTarget(null)}
        onDownloadPlaylist={handleDownloadEntirePlaylist}
        progressMap={downloadProgressMap}
        offlineVideoIds={offlineVideoIdSet}
      />

      {/* Google Account Switcher & Theme/Color Preferences Modal */}
      <AccountSwitcherModal
        isOpen={showAccountModal}
        onClose={() => setShowAccountModal(false)}
        accounts={accounts}
        activeAccount={activeAccount}
        isIncognito={isIncognito}
        onToggleIncognito={() => {
          setIsIncognito((v) => !v);
          showToast(!isIncognito ? 'Incognito Mode enabled' : 'Incognito Mode turned off');
        }}
        onSignInNewAccount={handleSignInNewAccount}
        onSwitchAccount={handleSwitchAccount}
        onSignOut={handleSignOut}
        themeMode={themeMode}
        onChangeThemeMode={(mode) => {
          setThemeMode(mode);
          showToast(
            mode === 'light'
              ? 'Theme set to White'
              : mode === 'dark'
              ? 'Theme set to Dark'
              : 'Theme set to System'
          );
        }}
        accentColor={accentColor}
        onChangeAccentColor={(color) => {
          setAccentColor(color);
          showToast('Updated accent color');
        }}
        sponsorBlockEnabled={sponsorBlockEnabled}
        onToggleSponsorBlock={() => setSponsorBlockEnabled((s) => !s)}
        preferredLanguage={preferredLanguage}
        onOpenLanguagePicker={() => setShowLanguagePicker(true)}
        authError={authError}
      />

      {/* 105+ Text Translation Language Picker Modal */}
      <LanguagePickerModal
        isOpen={showLanguagePicker}
        onClose={() => setShowLanguagePicker(false)}
        selectedLanguage={preferredLanguage}
        onSelect={(lang) => {
          setPreferredLanguage(lang);
          showToast(`Text translation language set to ${lang.name}`);
        }}
      />

      {/* Global Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-20 sm:bottom-6 left-1/2 -translate-x-1/2 z-[90] px-4 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold shadow-xl flex items-center gap-2 whitespace-nowrap max-w-[90vw] truncate"
          >
            <CheckCircle2 className="w-4 h-4 text-[var(--nextube-accent)] shrink-0" />
            <span className="truncate">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
