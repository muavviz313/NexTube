import type {
  CommentItem,
  PlaylistSummary,
  SponsorSegment,
  VideoItem,
} from '../types/nextube';

const YT_BASE = 'https://www.googleapis.com/youtube/v3';

function parseIsoDuration(iso: string): { seconds: number; label: string } {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return { seconds: 60, label: '1:00' };
  const h = Number(match[1] || 0);
  const m = Number(match[2] || 0);
  const s = Number(match[3] || 0);
  const total = h * 3600 + m * 60 + s;
  const label =
    h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`;
  return { seconds: total || 30, label };
}

function formatCompactViews(raw?: string): string {
  const n = Number(raw || 0);
  if (!n) return '0 views';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M views`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K views`;
  return `${n} views`;
}

function formatCompactSubscribers(raw?: string): string {
  const n = Number(raw || 0);
  if (!n) return 'YouTube Channel';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M subscribers`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K subscribers`;
  return `${n} subscribers`;
}

function formatRelativeDate(iso?: string): string {
  if (!iso) return 'Recently';
  const diffDays = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1 day ago';
  if (diffDays < 30) return `${diffDays} days ago`;
  const months = Math.floor(diffDays / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years > 1 ? 's' : ''} ago`;
}

async function ytFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${YT_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`YouTube API ${res.status}: ${errText.slice(0, 180)}`);
  }
  if (res.status === 204) {
    return {} as T;
  }
  return (await res.json()) as T;
}

interface YtListResponse<T> {
  items?: T[];
}

interface YtVideoResource {
  id: string;
  snippet: {
    title: string;
    description: string;
    channelId: string;
    channelTitle: string;
    publishedAt: string;
    categoryId?: string;
    thumbnails: {
      maxres?: { url: string };
      standard?: { url: string };
      high?: { url: string };
      medium?: { url: string };
      default?: { url: string };
    };
  };
  contentDetails?: { duration?: string; definition?: string };
  statistics?: { viewCount?: string; likeCount?: string };
}

function mapYtVideo(
  item: YtVideoResource,
  options: {
    myChannelId?: string;
    subscribedChannelIds?: Set<string>;
    isLiked?: boolean;
    categoryLabel?: string;
    forceShort?: boolean;
  } = {}
): VideoItem {
  const dur = parseIsoDuration(item.contentDetails?.duration || 'PT1M30S');
  const thumb =
    item.snippet.thumbnails.maxres?.url ||
    item.snippet.thumbnails.standard?.url ||
    item.snippet.thumbnails.high?.url ||
    item.snippet.thumbnails.medium?.url ||
    item.snippet.thumbnails.default?.url ||
    `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`;

  const isShort = Boolean(options.forceShort) || dur.seconds <= 60;

  return {
    id: item.id,
    youtubeId: item.id,
    title: item.snippet.title,
    description: item.snippet.description || '',
    channelId: item.snippet.channelId,
    channelTitle: item.snippet.channelTitle,
    channelSubscribers: 'YouTube Creator',
    isSubscribed: options.subscribedChannelIds?.has(item.snippet.channelId) ?? false,
    isCreatorOwned: Boolean(options.myChannelId && item.snippet.channelId === options.myChannelId),
    thumbnailUrl: thumb,
    streamUrl: '',
    durationSeconds: dur.seconds,
    durationLabel: dur.label,
    viewCountLabel: formatCompactViews(item.statistics?.viewCount),
    publishedAtLabel: formatRelativeDate(item.snippet.publishedAt),
    category: options.categoryLabel || 'YouTube',
    likeCount: Number(item.statistics?.likeCount || 0),
    isLiked: Boolean(options.isLiked),
    isShort,
    maxQualityLabel: item.contentDetails?.definition === 'hd' ? '1080p HD' : 'HD',
    sponsorSegments: [],
    subtitles: [],
    source: 'youtube',
  };
}

export interface YouTubeSyncBundle {
  homeVideos: VideoItem[];
  shortsVideos: VideoItem[];
  likedVideos: VideoItem[];
  subscriptions: Array<{ id: string; channelId: string; title: string; thumbnailUrl: string }>;
  playlists: PlaylistSummary[];
  playlistVideosMap: Record<string, VideoItem[]>;
  myChannelId?: string;
  apiNotice?: string;
}

interface LiveFallbackItem {
  id: string;
  youtubeId: string;
  title: string;
  description: string;
  channelId: string;
  channelTitle: string;
  thumbnailUrl: string;
  durationLabel: string;
  durationSeconds: number;
  viewCountLabel: string;
  publishedAtLabel: string;
  isShort: boolean;
}

export interface LiveVideoDetails {
  videoId: string;
  likeCount: number;
  channelSubscribers?: string;
  channelTitle?: string;
  channelAvatarUrl?: string;
  description?: string;
  commentCount?: number;
  commentCountLabel?: string;
  comments: CommentItem[];
}

export async function fetchLiveYouTubeVideoDetails(
  youtubeId: string
): Promise<LiveVideoDetails | null> {
  try {
    const res = await fetch(`/api/youtube/details?videoId=${encodeURIComponent(youtubeId)}`);
    if (!res.ok) return null;
    return (await res.json()) as LiveVideoDetails;
  } catch {
    return null;
  }
}

export async function fetchLiveYouTubeFallback(
  query: string,
  type: 'videos' | 'shorts' = 'videos',
  categoryLabel = 'YouTube'
): Promise<VideoItem[]> {
  const res = await fetch(
    `/api/youtube/live?q=${encodeURIComponent(query || 'trending')}&type=${type}`
  );
  if (!res.ok) return [];
  const data = (await res.json()) as { items?: LiveFallbackItem[] };
  return (data.items || []).map((item) => ({
    id: item.id,
    youtubeId: item.youtubeId,
    title: item.title,
    description: item.description,
    channelId: item.channelId,
    channelTitle: item.channelTitle,
    channelSubscribers: 'YouTube Creator',
    isSubscribed: false,
    isCreatorOwned: false,
    thumbnailUrl: item.thumbnailUrl,
    streamUrl: '',
    durationSeconds: item.durationSeconds,
    durationLabel: item.durationLabel,
    viewCountLabel: item.viewCountLabel,
    publishedAtLabel: item.publishedAtLabel,
    category: categoryLabel,
    likeCount: 0,
    isLiked: false,
    isShort: item.isShort || type === 'shorts',
    maxQualityLabel: '1080p HD',
    sponsorSegments: [],
    subtitles: [],
    source: 'youtube' as const,
  }));
}

export async function fetchYouTubeVideosByIds(
  ids: string[],
  token: string,
  options: {
    myChannelId?: string;
    subscribedChannelIds?: Set<string>;
    categoryLabel?: string;
    forceShort?: boolean;
  } = {}
): Promise<VideoItem[]> {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean))).slice(0, 25);
  if (uniqueIds.length === 0) return [];
  const res = await ytFetch<YtListResponse<YtVideoResource>>(
    `/videos?part=snippet,contentDetails,statistics&id=${encodeURIComponent(uniqueIds.join(','))}`,
    token
  );
  return (res.items || []).map((item) => mapYtVideo(item, options));
}

export async function fetchYouTubeSyncBundle(
  token: string,
  interestQueries: string[] = []
): Promise<YouTubeSyncBundle> {
  const [myChannelRes, popularRes, likedRes, subsRes, playlistsRes, shortsSearchRes] =
    await Promise.allSettled([
      ytFetch<YtListResponse<{ id: string }>>('/channels?part=id&mine=true', token),
      ytFetch<YtListResponse<YtVideoResource>>(
        '/videos?part=snippet,contentDetails,statistics&chart=mostPopular&regionCode=US&maxResults=15',
        token
      ),
      ytFetch<YtListResponse<YtVideoResource>>(
        '/videos?part=snippet,contentDetails,statistics&myRating=like&maxResults=12',
        token
      ),
      ytFetch<
        YtListResponse<{
          id: string;
          snippet: {
            title: string;
            resourceId: { channelId: string };
            thumbnails: { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
          };
        }>
      >('/subscriptions?part=snippet&mine=true&maxResults=20', token),
      ytFetch<
        YtListResponse<{
          id: string;
          snippet: {
            title: string;
            description: string;
            channelTitle: string;
            thumbnails: { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
          };
          contentDetails?: { itemCount?: number };
        }>
      >('/playlists?part=snippet,contentDetails&mine=true&maxResults=10', token),
      ytFetch<YtListResponse<{ id: { videoId?: string } }>>(
        '/search?part=id&type=video&videoDuration=short&q=%23shorts&maxResults=10',
        token
      ),
    ]);

  const myChannelId =
    myChannelRes.status === 'fulfilled' ? myChannelRes.value.items?.[0]?.id : undefined;

  const subscriptions =
    subsRes.status === 'fulfilled' && subsRes.value.items
      ? subsRes.value.items.map((s) => ({
          id: s.id,
          channelId: s.snippet.resourceId.channelId,
          title: s.snippet.title,
          thumbnailUrl:
            s.snippet.thumbnails.high?.url ||
            s.snippet.thumbnails.medium?.url ||
            s.snippet.thumbnails.default?.url ||
            '',
        }))
      : [];

  const subscribedChannelIds = new Set(subscriptions.map((s) => s.channelId));

  // Fetch recent uploads from user's top subscribed channels so Subscriptions feed has real videos
  let subscriptionUploads: VideoItem[] = [];
  if (subscriptions.length > 0) {
    const topSubChannels = subscriptions.slice(0, 4).map((s) => s.channelId);
    const channelsInfo = await ytFetch<
      YtListResponse<{
        id: string;
        contentDetails?: { relatedPlaylists?: { uploads?: string } };
        statistics?: { subscriberCount?: string };
      }>
    >(`/channels?part=contentDetails,statistics&id=${encodeURIComponent(topSubChannels.join(','))}`, token).catch(
      () => ({ items: [] })
    );

    const uploadPlaylistIds = (channelsInfo.items || [])
      .map((c) => c.contentDetails?.relatedPlaylists?.uploads)
      .filter((id): id is string => Boolean(id));

    const uploadItemsResults = await Promise.allSettled(
      uploadPlaylistIds.map((pid) =>
        ytFetch<YtListResponse<{ contentDetails?: { videoId?: string } }>>(
          `/playlistItems?part=contentDetails&playlistId=${encodeURIComponent(pid)}&maxResults=4`,
          token
        )
      )
    );

    const uploadVideoIds: string[] = [];
    for (const r of uploadItemsResults) {
      if (r.status === 'fulfilled' && r.value.items) {
        for (const it of r.value.items) {
          if (it.contentDetails?.videoId) uploadVideoIds.push(it.contentDetails.videoId);
        }
      }
    }

    if (uploadVideoIds.length > 0) {
      subscriptionUploads = await fetchYouTubeVideosByIds(uploadVideoIds, token, {
        myChannelId,
        subscribedChannelIds,
        categoryLabel: 'Subscriptions',
      }).catch(() => []);
    }
  }

  const popularVideos =
    popularRes.status === 'fulfilled' && popularRes.value.items
      ? popularRes.value.items.map((item) =>
          mapYtVideo(item, { myChannelId, subscribedChannelIds })
        )
      : [];

  const likedVideos =
    likedRes.status === 'fulfilled' && likedRes.value.items
      ? likedRes.value.items.map((item) =>
          mapYtVideo(item, { myChannelId, subscribedChannelIds, isLiked: true })
        )
      : [];

  const likedIdSet = new Set(likedVideos.map((v) => v.id));

  // Merge subscription uploads + popular videos + liked videos cleanly without duplicates
  const seenHome = new Set<string>();
  const homeVideos: VideoItem[] = [];
  for (const v of [...subscriptionUploads, ...popularVideos, ...likedVideos]) {
    if (seenHome.has(v.id)) continue;
    seenHome.add(v.id);
    homeVideos.push({ ...v, isLiked: v.isLiked || likedIdSet.has(v.id) });
  }

  // Hydrate real Shorts videos
  const shortSearchIds =
    shortsSearchRes.status === 'fulfilled' && shortsSearchRes.value.items
      ? shortsSearchRes.value.items
          .map((it) => it.id.videoId)
          .filter((id): id is string => Boolean(id))
      : [];

  let shortsVideos: VideoItem[] = [];
  if (shortSearchIds.length > 0) {
    shortsVideos = await fetchYouTubeVideosByIds(shortSearchIds, token, {
      myChannelId,
      subscribedChannelIds,
      forceShort: true,
      categoryLabel: 'Shorts',
    }).catch(() => []);
  }
  if (shortsVideos.length === 0) {
    shortsVideos = homeVideos.filter((v) => v.durationSeconds <= 60);
  }

  // Check if YouTube Data API v3 returned an API-level error (e.g. youtube.googleapis.com disabled in GCP)
  let apiNotice: string | undefined;
  const rejectedReasons = [popularRes, subsRes, playlistsRes, shortsSearchRes]
    .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
    .map((r) => (r.reason instanceof Error ? r.reason.message : String(r.reason)));

  if (rejectedReasons.length > 0 && homeVideos.length === 0) {
    const firstErr = rejectedReasons[0];
    if (firstErr.includes('403')) {
      apiNotice =
        'Personal playlists/subscriptions sync requires enabling YouTube Data API v3 in Google Cloud Console. Showing live public YouTube videos & Shorts in the meantime.';
    } else {
      apiNotice = `YouTube Data API notice: ${firstErr}`;
    }
  }

  // Live real YouTube fallback + personalized interest feeds
  if (interestQueries.length > 0) {
    const interestBatches = await Promise.allSettled(
      interestQueries.slice(0, 2).map((q) => fetchLiveYouTubeFallback(q, 'videos', 'For You'))
    );
    const interestShortsBatches = await Promise.allSettled(
      interestQueries.slice(0, 1).map((q) => fetchLiveYouTubeFallback(q, 'shorts', 'Shorts'))
    );
    for (const r of interestBatches) {
      if (r.status === 'fulfilled') {
        for (const v of r.value) {
          if (!seenHome.has(v.id)) {
            seenHome.add(v.id);
            homeVideos.unshift({ ...v, isLiked: likedIdSet.has(v.id) });
          }
        }
      }
    }
    for (const r of interestShortsBatches) {
      if (r.status === 'fulfilled') {
        const existingShortIds = new Set(shortsVideos.map((s) => s.id));
        shortsVideos = [
          ...r.value.filter((s) => !existingShortIds.has(s.id)),
          ...shortsVideos,
        ];
      }
    }
  }

  if (homeVideos.length === 0) {
    const liveHome = await fetchLiveYouTubeFallback('trending 4k videos music tech', 'videos', 'YouTube');
    homeVideos.push(...liveHome);
  }
  if (shortsVideos.length === 0) {
    const liveShorts = await fetchLiveYouTubeFallback('trending', 'shorts', 'Shorts');
    shortsVideos.push(...liveShorts);
  }

  // Enrich initial top videos & top Shorts with real likeCount, channelTitle, subscribers, avatar & commentCount
  const toEnrich = [...shortsVideos.slice(0, 4), ...homeVideos.slice(0, 4)];
  const detailsMap = new Map<string, LiveVideoDetails>();
  await Promise.allSettled(
    toEnrich.map(async (item) => {
      if (!item.youtubeId) return;
      const d = await fetchLiveYouTubeVideoDetails(item.youtubeId);
      if (d) detailsMap.set(item.youtubeId, d);
    })
  );

  const applyDetails = (v: VideoItem): VideoItem => {
    const d = v.youtubeId ? detailsMap.get(v.youtubeId) : undefined;
    if (!d) return v;
    return {
      ...v,
      likeCount: d.likeCount || v.likeCount,
      channelTitle: d.channelTitle || v.channelTitle,
      channelSubscribers: d.channelSubscribers || v.channelSubscribers,
      channelAvatarUrl: d.channelAvatarUrl || v.channelAvatarUrl,
      description: d.description || v.description,
      commentCount: d.commentCount ?? v.commentCount,
      commentCountLabel: d.commentCountLabel || v.commentCountLabel,
    };
  };

  for (let i = 0; i < homeVideos.length; i++) {
    homeVideos[i] = applyDetails(homeVideos[i]);
  }
  shortsVideos = shortsVideos.map(applyDetails);

  // Hydrate real playlists and their actual playlistItems
  const rawPlaylists =
    playlistsRes.status === 'fulfilled' && playlistsRes.value.items
      ? playlistsRes.value.items
      : [];

  const playlistVideosMap: Record<string, VideoItem[]> = {};
  const playlists: PlaylistSummary[] = await Promise.all(
    rawPlaylists.map(async (pl) => {
      let videoIds: string[] = [];
      try {
        const plItems = await ytFetch<
          YtListResponse<{ contentDetails?: { videoId?: string } }>
        >(
          `/playlistItems?part=contentDetails&playlistId=${encodeURIComponent(pl.id)}&maxResults=15`,
          token
        );
        videoIds = (plItems.items || [])
          .map((x) => x.contentDetails?.videoId)
          .filter((id): id is string => Boolean(id));
        if (videoIds.length > 0) {
          playlistVideosMap[pl.id] = await fetchYouTubeVideosByIds(videoIds, token, {
            myChannelId,
            subscribedChannelIds,
          });
        }
      } catch {
        videoIds = [];
      }

      return {
        id: pl.id,
        title: pl.snippet.title,
        description: pl.snippet.description || 'YouTube Playlist',
        thumbnailUrl:
          pl.snippet.thumbnails.high?.url ||
          pl.snippet.thumbnails.medium?.url ||
          pl.snippet.thumbnails.default?.url ||
          '',
        itemCount: pl.contentDetails?.itemCount ?? videoIds.length,
        channelTitle: pl.snippet.channelTitle || 'Your Channel',
        videoIds,
        source: 'youtube' as const,
      };
    })
  );

  return {
    homeVideos,
    shortsVideos,
    likedVideos,
    subscriptions,
    playlists,
    playlistVideosMap,
    myChannelId,
    apiNotice,
  };
}

export async function searchYouTubeVideos(
  query: string,
  token: string,
  options: {
    categoryId?: string;
    categoryLabel?: string;
    myChannelId?: string;
    subscribedChannelIds?: Set<string>;
  } = {}
): Promise<VideoItem[]> {
  try {
    if (!query.trim() && options.categoryId) {
      const res = await ytFetch<YtListResponse<YtVideoResource>>(
        `/videos?part=snippet,contentDetails,statistics&chart=mostPopular&regionCode=US&videoCategoryId=${encodeURIComponent(
          options.categoryId
        )}&maxResults=15`,
        token
      );
      const mapped = (res.items || []).map((item) => mapYtVideo(item, options));
      if (mapped.length > 0) return mapped;
    }

    const params = new URLSearchParams({
      part: 'id',
      type: 'video',
      maxResults: '15',
      q: query.trim() || options.categoryLabel || 'trending',
    });
    if (options.categoryId) {
      params.set('videoCategoryId', options.categoryId);
    }

    const searchRes = await ytFetch<YtListResponse<{ id: { videoId?: string } }>>(
      `/search?${params.toString()}`,
      token
    );
    const ids = (searchRes.items || [])
      .map((item) => item.id.videoId)
      .filter((id): id is string => Boolean(id));

    const results = await fetchYouTubeVideosByIds(ids, token, options);
    if (results.length > 0) return results;
  } catch {
    // Fall through to live YouTube search parser
  }

  const fallbackQuery =
    [query.trim(), options.categoryLabel && options.categoryLabel !== 'All' ? options.categoryLabel : '']
      .filter(Boolean)
      .join(' ') || 'trending';
  return fetchLiveYouTubeFallback(fallbackQuery, 'videos', options.categoryLabel || 'YouTube');
}

export async function fetchChannelSubscriberLabel(
  channelId: string,
  token: string
): Promise<string | null> {
  try {
    const res = await ytFetch<
      YtListResponse<{ statistics?: { subscriberCount?: string } }>
    >(`/channels?part=statistics&id=${encodeURIComponent(channelId)}`, token);
    const count = res.items?.[0]?.statistics?.subscriberCount;
    return count ? formatCompactSubscribers(count) : null;
  } catch {
    return null;
  }
}

export async function fetchSponsorBlockSegments(youtubeId: string): Promise<SponsorSegment[]> {
  try {
    const res = await fetch(
      `https://sponsor.ajay.app/api/skipSegments?videoID=${encodeURIComponent(
        youtubeId
      )}&categories=${encodeURIComponent(JSON.stringify(['sponsor', 'intro', 'outro', 'selfpromo']))}`
    );
    if (!res.ok) return [];
    const items = (await res.json()) as Array<{
      UUID: string;
      segment: [number, number];
      category: 'sponsor' | 'intro' | 'outro' | 'selfpromo';
    }>;
    return items.map((seg) => ({
      id: seg.UUID,
      start: seg.segment[0],
      end: seg.segment[1],
      category: seg.category,
      label:
        seg.category === 'sponsor'
          ? 'Sponsor'
          : seg.category === 'intro'
          ? 'Intro'
          : seg.category === 'outro'
          ? 'Outro'
          : 'Self-Promo',
    }));
  } catch {
    return [];
  }
}

export async function rateYouTubeVideo(
  youtubeId: string,
  rating: 'like' | 'none',
  token: string
): Promise<void> {
  await ytFetch(`/videos/rate?id=${encodeURIComponent(youtubeId)}&rating=${rating}`, token, {
    method: 'POST',
  });
}

export async function subscribeToYouTubeChannel(
  channelId: string,
  token: string
): Promise<string | undefined> {
  const res = await ytFetch<{ id?: string }>('/subscriptions?part=snippet', token, {
    method: 'POST',
    body: JSON.stringify({
      snippet: {
        resourceId: {
          kind: 'youtube#channel',
          channelId,
        },
      },
    }),
  });
  return res.id;
}

export async function fetchYouTubeComments(
  youtubeId: string,
  token: string,
  myChannelId?: string
): Promise<CommentItem[]> {
  const res = await ytFetch<
    YtListResponse<{
      id: string;
      snippet: {
        topLevelComment: {
          id: string;
          snippet: {
            authorDisplayName: string;
            authorChannelId?: { value: string };
            textDisplay: string;
            textOriginal: string;
            publishedAt: string;
            likeCount: number;
          };
        };
      };
    }>
  >(`/commentThreads?part=snippet&videoId=${encodeURIComponent(youtubeId)}&maxResults=20`, token);

  return (res.items || []).map((thread) => {
    const c = thread.snippet.topLevelComment;
    const isOwn = Boolean(myChannelId && c.snippet.authorChannelId?.value === myChannelId);
    return {
      id: c.id,
      videoId: youtubeId,
      authorName: c.snippet.authorDisplayName,
      authorHandle: `@${c.snippet.authorDisplayName.toLowerCase().replace(/\s+/g, '')}`,
      authorAvatarColor: isOwn ? '#FF2E4C' : '#2563EB',
      text: c.snippet.textOriginal || c.snippet.textDisplay,
      publishedAt: formatRelativeDate(c.snippet.publishedAt),
      likeCount: c.snippet.likeCount || 0,
      isCreatorOwnComment: isOwn,
    };
  });
}

export async function postYouTubeComment(
  youtubeId: string,
  text: string,
  token: string
): Promise<CommentItem> {
  const res = await ytFetch<{
    snippet: {
      topLevelComment: {
        id: string;
        snippet: {
          authorDisplayName: string;
          textOriginal: string;
          publishedAt: string;
          likeCount: number;
        };
      };
    };
  }>('/commentThreads?part=snippet', token, {
    method: 'POST',
    body: JSON.stringify({
      snippet: {
        videoId: youtubeId,
        topLevelComment: {
          snippet: {
            textOriginal: text,
          },
        },
      },
    }),
  });

  const c = res.snippet.topLevelComment;
  return {
    id: c.id,
    videoId: youtubeId,
    authorName: c.snippet.authorDisplayName,
    authorHandle: `@${c.snippet.authorDisplayName.toLowerCase().replace(/\s+/g, '')}`,
    authorAvatarColor: '#FF2E4C',
    text: c.snippet.textOriginal,
    publishedAt: 'Just now',
    likeCount: 0,
    isCreatorOwnComment: true,
  };
}

export async function deleteYouTubeComment(commentId: string, token: string): Promise<void> {
  await ytFetch(`/comments?id=${encodeURIComponent(commentId)}`, token, {
    method: 'DELETE',
  });
}

export async function reportYouTubeCommentAsSpam(commentId: string, token: string): Promise<void> {
  await ytFetch(`/comments/markAsSpam?id=${encodeURIComponent(commentId)}`, token, {
    method: 'POST',
  });
}
