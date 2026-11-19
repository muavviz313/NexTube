import type { VideoItem } from '../types/nextube';

const INTEREST_STORAGE_KEY = 'nextube_interest_profile_v1';
const HISTORY_STORAGE_KEY = 'nextube_watch_history_v1';

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'your', 'you', 'are', 'was',
  'were', 'have', 'has', 'had', 'not', 'but', 'what', 'when', 'where', 'which',
  'how', 'why', 'who', 'all', 'new', 'official', 'video', 'videos', 'youtube',
  'shorts', 'short', 'full', 'live', 'mix', 'best', 'top', 'part', 'hd', 'uhd',
  '4k', '1080p', '2025', '2026', '2024', 'into', 'over', 'after', 'about', 'just',
]);

export interface InterestProfile {
  topicWeights: Record<string, number>;
  channelWeights: Record<string, number>;
  recentSearches: string[];
  dislikedVideoIds: string[];
  updatedAt: string;
}

const DEFAULT_PROFILE: InterestProfile = {
  topicWeights: {},
  channelWeights: {},
  recentSearches: [],
  dislikedVideoIds: [],
  updatedAt: new Date().toISOString(),
};

export function loadInterestProfile(): InterestProfile {
  try {
    const raw = window.localStorage.getItem(INTEREST_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = JSON.parse(raw) as Partial<InterestProfile>;
    return {
      topicWeights: parsed.topicWeights || {},
      channelWeights: parsed.channelWeights || {},
      recentSearches: Array.isArray(parsed.recentSearches) ? parsed.recentSearches : [],
      dislikedVideoIds: Array.isArray(parsed.dislikedVideoIds) ? parsed.dislikedVideoIds : [],
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export function saveInterestProfile(profile: InterestProfile): void {
  try {
    window.localStorage.setItem(INTEREST_STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadPersistedHistory(): VideoItem[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as VideoItem[]) : [];
  } catch {
    return [];
  }
}

export function savePersistedHistory(history: VideoItem[]): void {
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 60)));
  } catch {
    // Ignore storage quota errors
  }
}

export function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w) && !/^\d+$/.test(w))
    .slice(0, 10);
}

function applyDecay(weights: Record<string, number>, factor = 0.96): Record<string, number> {
  const next: Record<string, number> = {};
  for (const [k, v] of Object.entries(weights)) {
    const decayed = Number((v * factor).toFixed(2));
    if (Math.abs(decayed) >= 0.2) next[k] = decayed;
  }
  return Object.fromEntries(
    Object.entries(next)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 40)
  );
}

export function recordInterestSignal(
  profile: InterestProfile,
  signal: {
    type: 'watch' | 'like' | 'subscribe' | 'search' | 'dislike';
    video?: VideoItem;
    searchQuery?: string;
    channelTitle?: string;
  }
): InterestProfile {
  const topicWeights = applyDecay(profile.topicWeights, 0.98);
  const channelWeights = applyDecay(profile.channelWeights, 0.98);
  const recentSearches = [...profile.recentSearches];
  const dislikedVideoIds = [...profile.dislikedVideoIds];

  const boostTopics = (text: string, weight: number) => {
    for (const kw of extractKeywords(text)) {
      topicWeights[kw] = Number(((topicWeights[kw] || 0) + weight).toFixed(2));
    }
  };

  if (signal.video) {
    const mult =
      signal.type === 'like'
        ? 3.0
        : signal.type === 'watch'
        ? 1.5
        : signal.type === 'dislike'
        ? -2.5
        : 1.0;

    boostTopics(`${signal.video.title} ${signal.video.category}`, mult);
    const ch = signal.video.channelTitle;
    if (ch && ch !== 'YouTube Creator' && ch !== 'YouTube Shorts') {
      channelWeights[ch] = Number(((channelWeights[ch] || 0) + mult * 1.4).toFixed(2));
    }
    if (signal.type === 'dislike' && !dislikedVideoIds.includes(signal.video.id)) {
      dislikedVideoIds.unshift(signal.video.id);
    }
  }

  if (signal.type === 'subscribe' && signal.channelTitle) {
    channelWeights[signal.channelTitle] = Number(
      ((channelWeights[signal.channelTitle] || 0) + 4.0).toFixed(2)
    );
  }

  if (signal.type === 'search' && signal.searchQuery?.trim()) {
    const q = signal.searchQuery.trim();
    boostTopics(q, 2.5);
    const updated = [q, ...recentSearches.filter((s) => s.toLowerCase() !== q.toLowerCase())].slice(
      0,
      12
    );
    const next: InterestProfile = {
      topicWeights,
      channelWeights,
      recentSearches: updated,
      dislikedVideoIds: dislikedVideoIds.slice(0, 50),
      updatedAt: new Date().toISOString(),
    };
    saveInterestProfile(next);
    return next;
  }

  const next: InterestProfile = {
    topicWeights,
    channelWeights,
    recentSearches,
    dislikedVideoIds: dislikedVideoIds.slice(0, 50),
    updatedAt: new Date().toISOString(),
  };
  saveInterestProfile(next);
  return next;
}

export function getTopInterestLabels(profile: InterestProfile, limit = 5): string[] {
  const combined = new Map<string, number>();
  for (const [topic, w] of Object.entries(profile.topicWeights)) {
    if (w > 0.5) combined.set(topic, w);
  }
  for (const [ch, w] of Object.entries(profile.channelWeights)) {
    if (w > 1.5) combined.set(ch, w);
  }
  return Array.from(combined.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label]) => label);
}

export function buildInterestQueries(profile: InterestProfile): string[] {
  const queries: string[] = [];
  if (profile.recentSearches.length > 0) {
    queries.push(profile.recentSearches[0]);
  }
  const topTopics = Object.entries(profile.topicWeights)
    .filter(([, w]) => w > 0.5)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t);

  if (topTopics.length >= 2) {
    queries.push(`${topTopics[0]} ${topTopics[1]}`);
  } else if (topTopics.length === 1) {
    queries.push(topTopics[0]);
  }

  const topChannel = Object.entries(profile.channelWeights)
    .filter(([, w]) => w > 1.5)
    .sort((a, b) => b[1] - a[1])[0]?.[0];
  if (topChannel) {
    queries.push(topChannel);
  }

  return Array.from(new Set(queries)).slice(0, 2);
}

export function rankVideosByInterest(
  videos: VideoItem[],
  profile: InterestProfile,
  watchedIds: Set<string> = new Set()
): VideoItem[] {
  const disliked = new Set(profile.dislikedVideoIds);
  const scored = videos
    .filter((v) => !disliked.has(v.id))
    .map((video, originalIndex) => {
      let score = 0;
      const keywords = extractKeywords(`${video.title} ${video.category} ${video.description}`);
      for (const kw of keywords) {
        score += profile.topicWeights[kw] || 0;
      }
      if (video.channelTitle && profile.channelWeights[video.channelTitle]) {
        score += profile.channelWeights[video.channelTitle] * 1.5;
      }
      if (video.isSubscribed) score += 3;
      if (video.isLiked) score += 2;
      // Slightly demote already-watched videos on Home so fresh recommendations surface first
      if (watchedIds.has(video.id)) score -= 1.2;
      // Tie-breaker preserving natural order
      return { video, score, originalIndex };
    });

  return scored
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.originalIndex - b.originalIndex))
    .map((entry) => entry.video);
}
