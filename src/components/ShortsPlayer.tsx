import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  Flame,
  MessageSquare,
  Music2,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { VideoItem } from '../types/nextube';
import { MediaImage } from './MediaImage';

interface ShortsPlayerProps {
  shorts: VideoItem[];
  commentsCountMap?: Record<string, number>;
  onToggleLike: (video: VideoItem) => void;
  onDislike?: (video: VideoItem) => void;
  onToggleSubscribe: (video: VideoItem) => void;
  onOpenDownloadSheet: (video: VideoItem) => void;
  onOpenComments: (video: VideoItem) => void;
  onShortActive?: (video: VideoItem) => void;
  isAuthenticated: boolean;
  onRequestSignIn: () => void;
}

function formatCompactCount(val: number): string {
  if (!Number.isFinite(val) || val <= 0) return '0';
  if (val >= 1_000_000) return `${(val / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(val);
}

function postYouTubeCommand(iframe: HTMLIFrameElement | null, func: string, args: unknown[] = []) {
  try {
    iframe?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args }),
      '*'
    );
  } catch {
    // Ignore cross-origin postMessage restrictions before iframe loads
  }
}

export function ShortsPlayer({
  shorts,
  commentsCountMap,
  onToggleLike,
  onDislike,
  onToggleSubscribe,
  onOpenDownloadSheet,
  onOpenComments,
  onShortActive,
  isAuthenticated,
  onRequestSignIn,
}: ShortsPlayerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({});
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(0.9);
  const [dislikedIds, setDislikedIds] = useState<Record<string, boolean>>({});
  const [progressPct, setProgressPct] = useState(0);

  const originParam =
    typeof window !== 'undefined' ? `&origin=${encodeURIComponent(window.location.origin)}` : '';

  // Notify parent when active Short changes to sync real like/comment/channel metadata & interest history
  useEffect(() => {
    const active = shorts[activeIndex];
    if (active) {
      onShortActive?.(active);
    }
  }, [activeIndex, shorts.length, shorts[activeIndex]?.id]);

  // Control native video playback + YouTube iframe mute/volume without reloading iframe src
  useEffect(() => {
    shorts.forEach((s, idx) => {
      const el = videoRefs.current[s.id];
      if (el && s.streamUrl) {
        el.volume = isMuted ? 0 : volume;
        el.muted = isMuted || volume === 0;
        if (idx === activeIndex) {
          el.currentTime = 0;
          el.play().catch(() => {
            el.muted = true;
            setIsMuted(true);
            el.play().catch(() => {});
          });
        } else {
          el.pause();
        }
      }

      const iframe = iframeRefs.current[s.id];
      if (iframe) {
        if (idx === activeIndex) {
          postYouTubeCommand(iframe, 'setVolume', [Math.round((isMuted ? 0 : volume) * 100)]);
          postYouTubeCommand(iframe, isMuted || volume === 0 ? 'mute' : 'unMute');
          postYouTubeCommand(iframe, 'playVideo');
        } else {
          postYouTubeCommand(iframe, 'pauseVideo');
        }
      }
    });
  }, [activeIndex, shorts, isMuted, volume]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const h = el.clientHeight || 1;
    const idx = Math.round(el.scrollTop / h);
    if (idx !== activeIndex && idx >= 0 && idx < shorts.length) {
      setActiveIndex(idx);
      setProgressPct(0);
    }
  };

  const scrollToShort = (index: number) => {
    const el = containerRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(shorts.length - 1, index));
    el.scrollTo({ top: clamped * el.clientHeight, behavior: 'smooth' });
  };

  if (shorts.length === 0) {
    return (
      <div className="max-w-md mx-auto p-8 rounded-3xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-white/10 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-[var(--nextube-accent)]/10 text-[var(--nextube-accent)] flex items-center justify-center mx-auto">
          <Flame className="w-6 h-6" />
        </div>
        <h2 className="text-base font-bold">
          {isAuthenticated ? 'No Shorts found in your feed' : 'Connect YouTube to load Shorts'}
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {isAuthenticated
            ? 'Try refreshing your YouTube sync or browsing interests on Home.'
            : 'Sign in with your Google Account to stream real YouTube Shorts synced from YouTube.'}
        </p>
        {!isAuthenticated && (
          <button
            type="button"
            onClick={onRequestSignIn}
            className="min-h-[44px] px-5 rounded-xl bg-[var(--nextube-accent)] text-white text-xs font-semibold"
          >
            Sign in with Google
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="relative flex items-center justify-center">
      <div className="relative h-[calc(100dvh-136px)] sm:h-[calc(100vh-88px)] w-full max-w-[420px] bg-black sm:rounded-3xl overflow-hidden border-0 sm:border border-zinc-200 dark:border-white/10 shadow-2xl">
        <div
          ref={containerRef}
          onScroll={handleScroll}
          className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
        >
          {shorts.map((short, idx) => {
            const isNear = Math.abs(idx - activeIndex) <= 1;
            const isActive = idx === activeIndex;
            const isDisliked = Boolean(dislikedIds[short.id]);
            const resolvedCommentCount =
              short.commentCountLabel ||
              formatCompactCount(short.commentCount ?? commentsCountMap?.[short.id] ?? 0);
            const handleLabel = short.channelTitle.startsWith('@')
              ? short.channelTitle
              : `@${short.channelTitle.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 18) || 'creator'}`;

            return (
              <div
                key={short.id}
                className="relative h-full w-full snap-start snap-always flex items-center justify-center bg-black"
              >
                {short.streamUrl ? (
                  <video
                    ref={(node) => {
                      videoRefs.current[short.id] = node;
                    }}
                    src={short.streamUrl}
                    poster={short.thumbnailUrl}
                    preload={isNear ? 'auto' : 'metadata'}
                    loop
                    playsInline
                    muted={isMuted || volume === 0}
                    onTimeUpdate={(e) => {
                      const vid = e.currentTarget;
                      if (vid.duration > 0) {
                        setProgressPct((vid.currentTime / vid.duration) * 100);
                      }
                    }}
                    onClick={(e) => {
                      const vid = e.currentTarget;
                      if (!vid.src) return;
                      if (vid.paused) vid.play().catch(() => {});
                      else vid.pause();
                    }}
                    className="h-full w-full object-cover"
                  />
                ) : short.youtubeId && isNear ? (
                  <iframe
                    ref={(node) => {
                      iframeRefs.current[short.id] = node;
                    }}
                    src={`https://www.youtube.com/embed/${short.youtubeId}?autoplay=${
                      isActive ? 1 : 0
                    }&loop=1&playlist=${
                      short.youtubeId
                    }&playsinline=1&rel=0&controls=1&enablejsapi=1${originParam}`}
                    title={short.title}
                    className="h-full w-full border-0"
                    onLoad={(e) => {
                      const iframe = e.currentTarget;
                      postYouTubeCommand(iframe, 'setVolume', [
                        Math.round((isMuted ? 0 : volume) * 100),
                      ]);
                      postYouTubeCommand(iframe, isMuted || volume === 0 ? 'mute' : 'unMute');
                      if (isActive) postYouTubeCommand(iframe, 'playVideo');
                    }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                ) : (
                  <MediaImage
                    src={short.thumbnailUrl}
                    alt={short.title}
                    className="h-full w-full object-cover"
                  />
                )}

                {/* Top Sound & Volume Pill (No video translation option) */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-20 pointer-events-none">
                  <div className="pointer-events-auto flex items-center gap-2 px-2.5 py-1.5 rounded-full bg-black/55 backdrop-blur-md text-white">
                    <button
                      type="button"
                      onClick={() => {
                        const nextMuted = !isMuted;
                        setIsMuted(nextMuted);
                        const iframe = iframeRefs.current[short.id];
                        postYouTubeCommand(iframe, nextMuted ? 'mute' : 'unMute');
                        if (!nextMuted) {
                          postYouTubeCommand(iframe, 'setVolume', [Math.round(volume * 100)]);
                        }
                        const vid = videoRefs.current[short.id];
                        if (vid) {
                          vid.muted = nextMuted;
                          if (!nextMuted) vid.volume = volume;
                        }
                      }}
                      aria-label={isMuted ? 'Unmute Short' : 'Mute Short'}
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/15"
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-4 h-4" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </button>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={isMuted ? 0 : Math.round(volume * 100)}
                      aria-label="Short volume"
                      onChange={(e) => {
                        const pct = Number(e.target.value);
                        const nextVol = pct / 100;
                        setVolume(nextVol);
                        setIsMuted(pct === 0);
                        const iframe = iframeRefs.current[short.id];
                        postYouTubeCommand(iframe, pct === 0 ? 'mute' : 'unMute');
                        postYouTubeCommand(iframe, 'setVolume', [pct]);
                        const vid = videoRefs.current[short.id];
                        if (vid) {
                          vid.muted = pct === 0;
                          vid.volume = nextVol;
                        }
                      }}
                      className="w-16 h-1 accent-[var(--nextube-accent)] cursor-pointer"
                    />
                  </div>
                </div>

                {/* Bottom Gradient Scrim */}
                <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/90 via-black/45 to-transparent pointer-events-none" />

                {/* Bottom-Left YouTube Shorts Channel Row, Title & Original Sound */}
                <div className="absolute bottom-4 left-3.5 right-16 z-20 text-white space-y-2 pointer-events-none">
                  <div className="flex items-center gap-2 pointer-events-auto">
                    {short.channelAvatarUrl ? (
                      <MediaImage
                        src={short.channelAvatarUrl}
                        alt={short.channelTitle}
                        className="w-8 h-8 rounded-full object-cover border border-white/25 shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[var(--nextube-accent)] text-white text-xs font-bold flex items-center justify-center shrink-0">
                        {short.channelTitle.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <span className="text-xs sm:text-sm font-semibold truncate drop-shadow">
                      {handleLabel}
                    </span>
                    <button
                      type="button"
                      onClick={() => onToggleSubscribe(short)}
                      className={`h-8 px-3.5 rounded-full text-xs font-semibold shrink-0 transition-colors ${
                        short.isSubscribed
                          ? 'bg-white/20 text-white backdrop-blur-md'
                          : 'bg-white text-zinc-900 hover:bg-zinc-200'
                      }`}
                    >
                      {short.isSubscribed ? 'Subscribed' : 'Subscribe'}
                    </button>
                  </div>

                  <p className="text-xs sm:text-sm font-medium leading-snug line-clamp-2 drop-shadow">
                    {short.title}
                  </p>

                  <div className="flex items-center gap-1.5 text-[11px] text-white/80">
                    <Music2 className="w-3 h-3 shrink-0" />
                    <span className="truncate">Original sound · {short.channelTitle}</span>
                  </div>
                </div>

                {/* Official YouTube Shorts Right Thumb-Zone Action Rail */}
                <div className="absolute right-2.5 bottom-4 z-20 flex flex-col items-center gap-3 text-white">
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.86 }}
                    onClick={() => onToggleLike(short)}
                    className="flex flex-col items-center gap-1 min-w-[44px]"
                  >
                    <div
                      className={`w-11 h-11 rounded-full backdrop-blur-md flex items-center justify-center transition-colors ${
                        short.isLiked
                          ? 'bg-[var(--nextube-accent)] text-white'
                          : 'bg-black/50 text-white hover:bg-black/70'
                      }`}
                    >
                      <ThumbsUp className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-semibold tabular-nums drop-shadow">
                      {short.likeCount > 0 ? formatCompactCount(short.likeCount) : 'Like'}
                    </span>
                  </motion.button>

                  <button
                    type="button"
                    onClick={() => {
                      setDislikedIds((prev) => ({ ...prev, [short.id]: !prev[short.id] }));
                      onDislike?.(short);
                    }}
                    className="flex flex-col items-center gap-1 min-w-[44px]"
                  >
                    <div
                      className={`w-11 h-11 rounded-full backdrop-blur-md flex items-center justify-center transition-colors ${
                        isDisliked
                          ? 'bg-white text-zinc-900'
                          : 'bg-black/50 text-white hover:bg-black/70'
                      }`}
                    >
                      <ThumbsDown className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-medium drop-shadow">Dislike</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenComments(short)}
                    className="flex flex-col items-center gap-1 min-w-[44px]"
                  >
                    <div className="w-11 h-11 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md flex items-center justify-center">
                      <MessageSquare className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-semibold tabular-nums drop-shadow">
                      {resolvedCommentCount}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const shareUrl = short.youtubeId
                        ? `https://www.youtube.com/shorts/${short.youtubeId}`
                        : window.location.href;
                      if (navigator.share) {
                        void navigator.share({ title: short.title, url: shareUrl });
                      } else if (navigator.clipboard) {
                        void navigator.clipboard.writeText(shareUrl);
                      }
                    }}
                    className="flex flex-col items-center gap-1 min-w-[44px]"
                  >
                    <div className="w-11 h-11 rounded-full bg-black/50 hover:bg-black/70 backdrop-blur-md flex items-center justify-center">
                      <Share2 className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-medium drop-shadow">Share</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onOpenDownloadSheet(short)}
                    className="flex flex-col items-center gap-1 min-w-[44px]"
                  >
                    <div className="w-11 h-11 rounded-full bg-[var(--nextube-accent)] flex items-center justify-center shadow-lg">
                      <Download className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-semibold drop-shadow">Save</span>
                  </button>

                  {/* Bottom-Right Creator / Sound Avatar Tile */}
                  <div className="w-9 h-9 rounded-lg border-2 border-white/80 overflow-hidden bg-zinc-900 shrink-0">
                    <MediaImage
                      src={short.channelAvatarUrl || short.thumbnailUrl}
                      alt={short.channelTitle}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>

                {/* Bottom 2px Shorts Progress Hairline */}
                <div className="absolute inset-x-0 bottom-0 h-0.5 bg-white/20 z-30">
                  <div
                    className="h-full bg-[var(--nextube-accent)] transition-all duration-150"
                    style={{ width: `${short.streamUrl ? progressPct : 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Desktop Prev/Next Quick Navigation Arrows beside Shorts Column */}
      <div className="hidden md:flex flex-col gap-2 ml-4">
        <button
          type="button"
          disabled={activeIndex === 0}
          onClick={() => scrollToShort(activeIndex - 1)}
          aria-label="Previous Short"
          className="w-11 h-11 rounded-full bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white disabled:opacity-30 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-white/20 transition-colors"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
        <button
          type="button"
          disabled={activeIndex >= shorts.length - 1}
          onClick={() => scrollToShort(activeIndex + 1)}
          aria-label="Next Short"
          className="w-11 h-11 rounded-full bg-zinc-100 dark:bg-white/10 text-zinc-900 dark:text-white disabled:opacity-30 flex items-center justify-center hover:bg-zinc-200 dark:hover:bg-white/20 transition-colors"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
