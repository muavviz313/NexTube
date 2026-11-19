import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bell,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  Clock,
  Download,
  Gauge,
  Headphones,
  Languages,
  Maximize2,
  Pause,
  PictureInPicture2,
  Play,
  Share2,
  ShieldCheck,
  Sparkles,
  Sun,
  ThumbsUp,
  Volume2,
  VolumeX,
  X,
  ZoomIn,
} from 'lucide-react';
import type { CommentItem, LanguageOption, SponsorSegment, VideoItem } from '../types/nextube';
import { translateTexts } from '../services/translatorApi';
import { fetchChannelSubscriberLabel, fetchSponsorBlockSegments } from '../services/youtubeApi';
import { getAccessToken } from '../services/firebaseAuth';
import { CommentsSection } from './CommentsSection';
import { MediaImage } from './MediaImage';

interface VideoPlayerModalProps {
  video: VideoItem | null;
  offlineBlobUrl?: string | null;
  isMinimized: boolean;
  onMinimize: () => void;
  onClose: () => void;
  onOpenDownloadSheet: (video: VideoItem) => void;
  onToggleLike: (video: VideoItem) => void;
  onToggleSubscribe: (video: VideoItem) => void;
  isWatchLater?: boolean;
  onToggleWatchLater?: (video: VideoItem) => void;
  sponsorBlockEnabled: boolean;
  preferredLanguage: LanguageOption;
  onOpenLanguagePicker: () => void;
  comments: CommentItem[];
  onAddComment: (videoId: string, text: string) => Promise<void>;
  onDeleteComment: (comment: CommentItem) => Promise<void>;
  onReportComment: (comment: CommentItem, reason: string) => Promise<void>;
  onToggleLikeComment: (videoId: string, commentId: string) => void;
  relatedVideos: VideoItem[];
  onSelectRelated: (video: VideoItem) => void;
  onPlayerStateSync?: (state: { isPlaying: boolean; currentTime: number; duration: number }) => void;
  externalVideoRef?: React.RefObject<HTMLVideoElement | null>;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const QUALITY_OPTIONS = ['2160p 4K60', '1440p60', '1080p60', '720p', '480p'];
const SLEEP_TIMERS = [0, 15, 30, 45, 60];

export function VideoPlayerModal({
  video,
  offlineBlobUrl,
  isMinimized,
  onMinimize,
  onClose,
  onOpenDownloadSheet,
  onToggleLike,
  onToggleSubscribe,
  isWatchLater = false,
  onToggleWatchLater,
  sponsorBlockEnabled,
  preferredLanguage,
  onOpenLanguagePicker,
  comments,
  onAddComment,
  onDeleteComment,
  onReportComment,
  onToggleLikeComment,
  relatedVideos,
  onSelectRelated,
  onPlayerStateSync,
  externalVideoRef,
}: VideoPlayerModalProps) {
  const internalVideoRef = useRef<HTMLVideoElement | null>(null);
  const videoRef = externalVideoRef ?? internalVideoRef;
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const hudTimerRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [brightness, setBrightness] = useState(1);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [zoomScale, setZoomScale] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [selectedQuality, setSelectedQuality] = useState('1080p60');
  const [backgroundPlayEnabled, setBackgroundPlayEnabled] = useState(true);
  const [sleepMinutes, setSleepMinutes] = useState(0);
  const [sleepRemainingSec, setSleepRemainingSec] = useState<number | null>(null);
  const [showControlsMenu, setShowControlsMenu] = useState<'none' | 'settings' | 'sleep'>('none');
  const [sponsorSegments, setSponsorSegments] = useState<SponsorSegment[]>([]);
  const [channelSubsLabel, setChannelSubsLabel] = useState<string | null>(null);

  // Gesture HUDs
  const [gestureHud, setGestureHud] = useState<{
    type: 'brightness' | 'volume' | 'seek-back' | 'seek-fwd' | 'zoom';
    label: string;
  } | null>(null);
  const [sponsorToast, setSponsorToast] = useState<string | null>(null);
  const lastSkippedSegmentRef = useRef<string | null>(null);

  // Touch / Pointer gesture tracking
  const gestureStartRef = useRef<{
    x: number;
    y: number;
    side: 'left' | 'right';
    startVal: number;
    moved: boolean;
  } | null>(null);
  const pinchStartDistRef = useRef<number | null>(null);
  const pinchStartScaleRef = useRef<number>(1);
  const lastTapRef = useRef<{ time: number; side: 'left' | 'right' } | null>(null);
  const dragDownStartYRef = useRef<number | null>(null);

  // Text-only AI Translation states (Title, Description, Comments)
  const [isTranslated, setIsTranslated] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [translatedTitle, setTranslatedTitle] = useState<string | null>(null);
  const [translatedDescription, setTranslatedDescription] = useState<string | null>(null);
  const [translatedComments, setTranslatedComments] = useState<Record<string, string>>({});
  const [translationError, setTranslationError] = useState<string | null>(null);

  const activeStreamSrc = offlineBlobUrl || video?.streamUrl || '';
  const hasNativeVideoSource = Boolean(activeStreamSrc);
  const isYoutubeIframe = Boolean(video?.youtubeId && !offlineBlobUrl);
  const embedOrigin =
    typeof window !== 'undefined' ? `&origin=${encodeURIComponent(window.location.origin)}` : '';

  const sendYouTubeCommand = (func: string, args: unknown[] = []) => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        '*'
      );
    } catch {
      // Ignore iframe communication errors before ready
    }
  };

  const applyVolume = (rawVol: number, mutedOverride?: boolean) => {
    const nextVol = Math.min(1, Math.max(0, Number(rawVol.toFixed(2))));
    const nextMuted = mutedOverride !== undefined ? mutedOverride : nextVol === 0;
    setVolume(nextVol);
    setIsMuted(nextMuted);

    const el = videoRef.current;
    if (el) {
      el.volume = nextMuted ? 0 : nextVol;
      el.muted = nextMuted || nextVol === 0;
    }

    if (isYoutubeIframe) {
      sendYouTubeCommand(nextMuted || nextVol === 0 ? 'mute' : 'unMute');
      sendYouTubeCommand('setVolume', [Math.round(nextVol * 100)]);
    }
  };

  // Reset per-video state and fetch real SponsorBlock + Channel Subscriber data
  useEffect(() => {
    setIsTranslated(false);
    setTranslatedTitle(null);
    setTranslatedDescription(null);
    setTranslatedComments({});
    setTranslationError(null);
    setShowControlsMenu('none');
    lastSkippedSegmentRef.current = null;
    setCurrentTime(0);
    setIsPlaying(true);
    setSponsorSegments(video?.sponsorSegments || []);
    setChannelSubsLabel(null);

    if (video?.youtubeId) {
      void fetchSponsorBlockSegments(video.youtubeId).then((segs) => {
        if (segs.length > 0) setSponsorSegments(segs);
      });
      const token = getAccessToken();
      if (token && video.channelId) {
        void fetchChannelSubscriberLabel(video.channelId, token).then((label) => {
          if (label) setChannelSubsLabel(label);
        });
      }
    }
  }, [video?.id]);

  // Re-translate automatically if user switches target language while translation is ON
  useEffect(() => {
    if (isTranslated && video) {
      void runTranslation(true);
    }
  }, [preferredLanguage.code]);

  // Sync Media Session API for Background Play & Lockscreen Controls
  useEffect(() => {
    if (!video || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: video.title,
      artist: video.channelTitle,
      album: 'NexTube',
      artwork: video.thumbnailUrl
        ? [{ src: video.thumbnailUrl, sizes: '512x512', type: 'image/jpeg' }]
        : [],
    });
    navigator.mediaSession.setActionHandler('play', () => {
      if (videoRef.current?.src) {
        videoRef.current.play().catch(() => {});
        setIsPlaying(true);
      }
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      videoRef.current?.pause();
      setIsPlaying(false);
    });
  }, [video?.id]);

  // Sleep Timer countdown
  useEffect(() => {
    if (sleepMinutes <= 0) {
      setSleepRemainingSec(null);
      return;
    }
    setSleepRemainingSec(sleepMinutes * 60);
    const timer = window.setInterval(() => {
      setSleepRemainingSec((prev) => {
        if (prev === null) return null;
        if (prev <= 1) {
          videoRef.current?.pause();
          sendYouTubeCommand('pauseVideo');
          setIsPlaying(false);
          setSleepMinutes(0);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sleepMinutes]);

  const showHudTemporarily = (
    type: 'brightness' | 'volume' | 'seek-back' | 'seek-fwd' | 'zoom',
    label: string
  ) => {
    setGestureHud({ type, label });
    if (hudTimerRef.current) window.clearTimeout(hudTimerRef.current);
    hudTimerRef.current = window.setTimeout(() => {
      setGestureHud(null);
    }, 900);
  };

  const runTranslation = async (force = false) => {
    if (!video) return;
    if (isTranslated && !force) {
      setIsTranslated(false);
      return;
    }
    setIsTranslating(true);
    setTranslationError(null);
    try {
      const commentList = comments.map((c) => c.text);
      const payload = [video.title, video.description || '', ...commentList];

      const translated = await translateTexts(
        payload,
        preferredLanguage.name,
        preferredLanguage.code
      );

      setTranslatedTitle(translated[0] || video.title);
      setTranslatedDescription(translated[1] || video.description);

      const comMap: Record<string, string> = {};
      const offset = 2;
      comments.forEach((c, i) => {
        comMap[c.id] = translated[offset + i] || c.text;
      });
      setTranslatedComments(comMap);
      setIsTranslated(true);
    } catch (err: unknown) {
      setTranslationError(err instanceof Error ? err.message : 'Translation failed');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleTimeUpdate = () => {
    const el = videoRef.current;
    if (!el || !video) return;
    const t = el.currentTime;
    setCurrentTime(t);
    setDuration(el.duration || video.durationSeconds);
    onPlayerStateSync?.({
      isPlaying: !el.paused,
      currentTime: t,
      duration: el.duration || video.durationSeconds,
    });

    if (sponsorBlockEnabled && sponsorSegments.length > 0) {
      const hit = sponsorSegments.find((seg) => t >= seg.start && t < seg.end - 0.35);
      if (hit && lastSkippedSegmentRef.current !== hit.id) {
        lastSkippedSegmentRef.current = hit.id;
        el.currentTime = hit.end;
        setSponsorToast(`Skipped ${hit.label}`);
        window.setTimeout(() => setSponsorToast(null), 2600);
      }
    }
  };

  const togglePlayPause = () => {
    const el = videoRef.current;
    if (!el || !el.src) return;
    if (el.paused) {
      el.play().catch(() => {});
      setIsPlaying(true);
    } else {
      el.pause();
      setIsPlaying(false);
    }
  };

  const handlePiP = async () => {
    const el = videoRef.current;
    if (!el || !el.src) {
      onMinimize();
      return;
    }
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await el.requestPictureInPicture();
      } else {
        onMinimize();
      }
    } catch {
      onMinimize();
    }
  };

  // Pointer & Touch gesture handlers on the player canvas
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDistRef.current = Math.hypot(dx, dy);
      pinchStartScaleRef.current = zoomScale;
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const t = e.touches[0];
    const relX = t.clientX - rect.left;
    const side = relX < rect.width / 2 ? 'left' : 'right';

    gestureStartRef.current = {
      x: t.clientX,
      y: t.clientY,
      side,
      startVal: side === 'left' ? brightness : volume,
      moved: false,
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && pinchStartDistRef.current) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      const nextScale = Math.min(
        1.8,
        Math.max(1, pinchStartScaleRef.current * (dist / pinchStartDistRef.current))
      );
      setZoomScale(nextScale);
      showHudTemporarily('zoom', `${nextScale.toFixed(2)}x Zoom`);
      return;
    }

    const g = gestureStartRef.current;
    if (!g || e.touches.length !== 1) return;
    const dy = g.y - e.touches[0].clientY;
    if (Math.abs(dy) > 12) {
      g.moved = true;
      const delta = dy / 180;
      if (g.side === 'left') {
        const nextB = Math.min(1.4, Math.max(0.35, g.startVal + delta));
        setBrightness(nextB);
        showHudTemporarily('brightness', `Brightness ${Math.round(nextB * 100)}%`);
      } else {
        const nextV = Math.min(1, Math.max(0, g.startVal + delta));
        applyVolume(nextV, nextV === 0);
        showHudTemporarily('volume', `Volume ${Math.round(nextV * 100)}%`);
      }
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    pinchStartDistRef.current = null;
    const g = gestureStartRef.current;
    gestureStartRef.current = null;
    if (!g || g.moved) return;

    const now = Date.now();
    const prev = lastTapRef.current;
    if (prev && now - prev.time < 280 && prev.side === g.side) {
      lastTapRef.current = null;
      const el = videoRef.current;
      if (el && el.src) {
        const delta = g.side === 'left' ? -10 : 10;
        el.currentTime = Math.max(0, Math.min(el.duration || 999, el.currentTime + delta));
        showHudTemporarily(
          g.side === 'left' ? 'seek-back' : 'seek-fwd',
          g.side === 'left' ? '-10s' : '+10s'
        );
      }
      e.preventDefault();
    } else {
      lastTapRef.current = { time: now, side: g.side };
    }
  };

  const handleDesktopDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = videoRef.current;
    if (!el || !el.src) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const isLeft = e.clientX - rect.left < rect.width / 2;
    el.currentTime = Math.max(0, Math.min(el.duration || 999, el.currentTime + (isLeft ? -10 : 10)));
    showHudTemporarily(isLeft ? 'seek-back' : 'seek-fwd', isLeft ? '-10s' : '+10s');
  };

  const formatTime = (sec: number) => {
    const s = Math.floor(sec || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${String(rem).padStart(2, '0')}`;
  };

  if (!video) return null;

  return (
    <div
      className={`fixed inset-0 z-50 bg-[#F8F9FA] dark:bg-[#0A0A0A] text-zinc-900 dark:text-zinc-100 overflow-y-auto transition-opacity duration-200 ${
        isMinimized ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
      aria-hidden={isMinimized}
    >
      {/* Top Player Bar with Drag-to-Minimize Handle */}
      <div
        className="sticky top-0 z-30 h-14 px-3 sm:px-6 flex items-center justify-between bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur-md border-b border-zinc-200 dark:border-white/10"
        onPointerDown={(e) => {
          dragDownStartYRef.current = e.clientY;
        }}
        onPointerUp={(e) => {
          if (dragDownStartYRef.current !== null && e.clientY - dragDownStartYRef.current > 45) {
            onMinimize();
          }
          dragDownStartYRef.current = null;
        }}
      >
        <button
          type="button"
          onClick={onMinimize}
          aria-label="Minimize to mini player"
          className="min-h-[44px] px-2 -ml-1 flex items-center gap-1.5 text-sm font-medium text-zinc-700 dark:text-zinc-200 hover:text-zinc-900 dark:hover:text-white"
        >
          <ChevronDown className="w-5 h-5" />
          <span>Minimize</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close player"
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Layout: 2-Column on Desktop, Stacked on Mobile */}
      <div className="max-w-7xl mx-auto px-0 sm:px-6 py-0 sm:py-6 grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6">
        {/* Left Primary Video + Controls + Metadata + Comments Column */}
        <div className="lg:col-span-8 space-y-4">
          {/* Responsive Video Viewport */}
          <div
            ref={containerRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onDoubleClick={handleDesktopDoubleClick}
            className="relative w-full aspect-video bg-black sm:rounded-2xl overflow-hidden select-none"
          >
            {isYoutubeIframe ? (
              <iframe
                ref={iframeRef}
                src={`https://www.youtube.com/embed/${video.youtubeId}?autoplay=1&playsinline=1&rel=0&enablejsapi=1${embedOrigin}`}
                title={video.title}
                onLoad={() => {
                  sendYouTubeCommand(isMuted || volume === 0 ? 'mute' : 'unMute');
                  sendYouTubeCommand('setVolume', [Math.round(volume * 100)]);
                  if (playbackRate !== 1) sendYouTubeCommand('setPlaybackRate', [playbackRate]);
                }}
                className="w-full h-full border-0 transition-transform duration-150"
                style={{
                  filter: `brightness(${brightness})`,
                  transform: `scale(${zoomScale})`,
                }}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : hasNativeVideoSource ? (
              <video
                ref={videoRef}
                src={activeStreamSrc}
                poster={video.thumbnailUrl}
                autoPlay
                playsInline
                muted={isMuted || volume === 0}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={() => {
                  if (videoRef.current) {
                    videoRef.current.volume = isMuted ? 0 : volume;
                    videoRef.current.muted = isMuted || volume === 0;
                    videoRef.current.playbackRate = playbackRate;
                    setDuration(videoRef.current.duration || video.durationSeconds);
                  }
                }}
                onVolumeChange={() => {
                  if (videoRef.current) {
                    setIsMuted(videoRef.current.muted || videoRef.current.volume === 0);
                    if (!videoRef.current.muted) {
                      setVolume(Number(videoRef.current.volume.toFixed(2)));
                    }
                  }
                }}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onClick={togglePlayPause}
                className="w-full h-full object-contain transition-transform duration-150"
                style={{
                  filter: `brightness(${brightness})`,
                  transform: `scale(${zoomScale})`,
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-zinc-950 text-white text-xs">
                No playable stream source available.
              </div>
            )}

            {/* SponsorBlock Skip Toast */}
            <AnimatePresence>
              {sponsorToast && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="absolute top-3 left-3 z-20 px-3 py-1.5 rounded-xl bg-emerald-600/90 backdrop-blur-md text-white text-xs font-medium flex items-center gap-1.5"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {sponsorToast}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Gesture Feedback HUD */}
            <AnimatePresence>
              {gestureHud && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.92 }}
                  className="absolute inset-0 m-auto w-fit h-fit px-4 py-2 rounded-2xl bg-black/75 backdrop-blur-md text-white text-xs font-semibold flex items-center gap-2 pointer-events-none z-20"
                >
                  {gestureHud.type === 'brightness' && <Sun className="w-4 h-4 text-amber-400" />}
                  {gestureHud.type === 'volume' && <Volume2 className="w-4 h-4 text-sky-400" />}
                  {gestureHud.type === 'zoom' && <ZoomIn className="w-4 h-4 text-emerald-400" />}
                  <span>{gestureHud.label}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Mobile-Responsive Transport Bar for Native/Offline Video Playback */}
            {hasNativeVideoSource && !isYoutubeIframe && (
              <div
                className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/60 to-transparent pt-6 pb-2 px-2.5 sm:px-4 space-y-1 z-20"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Timeline with SponsorBlock Segment Markers */}
                <div className="relative h-5 flex items-center">
                  <div className="absolute inset-x-0 h-1.5 rounded-full bg-white/25 overflow-hidden">
                    {sponsorBlockEnabled &&
                      duration > 0 &&
                      sponsorSegments.map((seg) => {
                        const leftPct = (seg.start / duration) * 100;
                        const widthPct = ((seg.end - seg.start) / duration) * 100;
                        return (
                          <div
                            key={seg.id}
                            title={seg.label}
                            className={`absolute top-0 bottom-0 ${
                              seg.category === 'sponsor' ? 'bg-emerald-400' : 'bg-sky-400'
                            }`}
                            style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                          />
                        );
                      })}
                    <div
                      className="h-full bg-[var(--nextube-accent)]"
                      style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                    />
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    value={currentTime}
                    aria-label="Seek timeline"
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (videoRef.current) videoRef.current.currentTime = val;
                      setCurrentTime(val);
                    }}
                    className="relative w-full opacity-0 cursor-pointer h-5"
                  />
                </div>

                {/* Compact Mobile-Safe Control Row */}
                <div className="flex items-center justify-between text-white gap-1">
                  <div className="flex items-center gap-1 sm:gap-2 min-w-0">
                    <button
                      type="button"
                      onClick={togglePlayPause}
                      aria-label={isPlaying ? 'Pause' : 'Play'}
                      className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg hover:bg-white/10 shrink-0"
                    >
                      {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const nextMuted = !isMuted;
                        const restoredVol = nextMuted ? volume : volume === 0 ? 0.85 : volume;
                        applyVolume(restoredVol, nextMuted);
                        showHudTemporarily(
                          'volume',
                          nextMuted ? 'Muted' : `Volume ${Math.round(restoredVol * 100)}%`
                        );
                      }}
                      aria-label={isMuted || volume === 0 ? 'Unmute video' : 'Mute video'}
                      className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg hover:bg-white/10 shrink-0"
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-4 h-4 sm:w-5 sm:h-5" />
                      ) : (
                        <Volume2 className="w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                    </button>

                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={isMuted ? 0 : Math.round(volume * 100)}
                      aria-label="Native video volume slider"
                      onChange={(e) => {
                        const pct = Number(e.target.value);
                        const nextV = pct / 100;
                        applyVolume(nextV, pct === 0);
                        showHudTemporarily('volume', pct === 0 ? 'Muted' : `Volume ${pct}%`);
                      }}
                      className="hidden sm:block w-16 md:w-20 h-1 accent-[var(--nextube-accent)] cursor-pointer"
                    />

                    <span className="font-mono text-[11px] sm:text-xs tabular-nums text-white/90 truncate">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setZoomScale((s) => {
                          const next = s >= 1.5 ? 1 : Number((s + 0.25).toFixed(2));
                          showHudTemporarily('zoom', `${next}x Zoom`);
                          return next;
                        })
                      }
                      aria-label="Cycle video zoom"
                      className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg text-white/80 hover:bg-white/10"
                    >
                      <Maximize2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={handlePiP}
                      aria-label="Picture in Picture"
                      className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg text-white/80 hover:bg-white/10"
                    >
                      <PictureInPicture2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setShowControlsMenu((m) => (m === 'sleep' ? 'none' : 'sleep'))
                      }
                      aria-label="Sleep timer"
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center ${
                        sleepRemainingSec ? 'text-amber-400' : 'text-white/80 hover:bg-white/10'
                      }`}
                    >
                      <Clock className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setShowControlsMenu((m) => (m === 'settings' ? 'none' : 'settings'))
                      }
                      aria-label="Quality and speed settings"
                      className="w-9 h-9 sm:w-10 sm:h-10 sm:w-auto sm:px-2.5 rounded-lg flex items-center justify-center gap-1 text-xs text-white/85 hover:bg-white/10"
                    >
                      <Gauge className="w-4 h-4" />
                      <span className="hidden sm:inline font-mono">{playbackRate}x</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Mobile-Friendly Quick Player Controls Bar (Works for both YouTube IFrame & Offline Video!) */}
          <div className="px-4 sm:px-0 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <div className="min-h-[38px] px-2.5 rounded-xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-white/10 flex items-center gap-2 whitespace-nowrap shrink-0">
              <button
                type="button"
                onClick={() => {
                  const nextMuted = !isMuted;
                  const restoredVol = nextMuted ? volume : volume === 0 ? 0.85 : volume;
                  applyVolume(restoredVol, nextMuted);
                  showHudTemporarily(
                    'volume',
                    nextMuted ? 'Muted' : `Volume ${Math.round(restoredVol * 100)}%`
                  );
                }}
                aria-label={isMuted || volume === 0 ? 'Unmute audio' : 'Mute audio'}
                className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-white/10"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-3.5 h-3.5 text-rose-500" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5 text-sky-500" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={isMuted ? 0 : Math.round(volume * 100)}
                aria-label="Volume level"
                onChange={(e) => {
                  const pct = Number(e.target.value);
                  const nextV = pct / 100;
                  applyVolume(nextV, pct === 0);
                  showHudTemporarily('volume', pct === 0 ? 'Muted' : `Volume ${pct}%`);
                }}
                className="w-20 sm:w-24 h-1.5 accent-[var(--nextube-accent)] cursor-pointer"
              />
              <span className="text-[11px] font-mono tabular-nums text-zinc-600 dark:text-zinc-300 w-8 text-right">
                {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
              </span>
            </div>

            <button
              type="button"
              onClick={() =>
                setBrightness((b) => {
                  const next = b >= 1.2 ? 0.6 : Number((b + 0.2).toFixed(1));
                  showHudTemporarily('brightness', `Brightness ${Math.round(next * 100)}%`);
                  return next;
                })
              }
              className="min-h-[38px] px-3 rounded-xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-white/10 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              Brightness {Math.round(brightness * 100)}%
            </button>

            <button
              type="button"
              onClick={() =>
                setZoomScale((s) => {
                  const next = s >= 1.5 ? 1 : Number((s + 0.25).toFixed(2));
                  showHudTemporarily('zoom', `${next}x Zoom`);
                  return next;
                })
              }
              className="min-h-[38px] px-3 rounded-xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-white/10 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <ZoomIn className="w-3.5 h-3.5 text-emerald-500" />
              Zoom {zoomScale}x
            </button>

            <button
              type="button"
              onClick={() => setShowControlsMenu((m) => (m === 'sleep' ? 'none' : 'sleep'))}
              className={`min-h-[38px] px-3 rounded-xl border text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                sleepRemainingSec
                  ? 'border-[var(--nextube-accent)] text-[var(--nextube-accent)] bg-[var(--nextube-accent)]/10'
                  : 'bg-white dark:bg-[#141414] border-zinc-200 dark:border-white/10'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              {sleepRemainingSec ? `Sleep ${Math.ceil(sleepRemainingSec / 60)}m` : 'Sleep Timer'}
            </button>

            <button
              type="button"
              onClick={() => setShowControlsMenu((m) => (m === 'settings' ? 'none' : 'settings'))}
              className="min-h-[38px] px-3 rounded-xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-white/10 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Gauge className="w-3.5 h-3.5" />
              Player Options
            </button>

            <button
              type="button"
              onClick={onOpenLanguagePicker}
              className="min-h-[38px] px-3 rounded-xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-white/10 text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <Languages className="w-3.5 h-3.5 text-sky-500" />
              Text Lang: {preferredLanguage.name}
            </button>
          </div>

          {sponsorBlockEnabled && sponsorSegments.length > 0 && (
            <div className="mx-4 sm:mx-0 px-3.5 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>
                SponsorBlock active: {sponsorSegments.length} community segment
                {sponsorSegments.length > 1 ? 's' : ''} detected
              </span>
            </div>
          )}

          {translationError && (
            <div className="mx-4 sm:mx-0 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 text-xs text-rose-700 dark:text-rose-300">
              {translationError}
            </div>
          )}

          {/* Video Title & Primary Actions */}
          <div className="px-4 sm:px-0 space-y-4">
            <h1
              dir={isTranslated && preferredLanguage.rtl ? 'rtl' : 'ltr'}
              className="text-lg sm:text-2xl font-bold tracking-tight text-balance"
            >
              {isTranslated && translatedTitle ? translatedTitle : video.title}
            </h1>

            <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <span>{video.viewCountLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{video.publishedAtLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{selectedQuality}</span>
              {offlineBlobUrl && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    Playing Offline Copy
                  </span>
                </>
              )}
            </div>

            {/* Channel Row & Responsive Wrapped Action Buttons */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-3 border-y border-zinc-200 dark:border-white/10">
              <div className="flex items-center justify-between sm:justify-start gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {video.channelAvatarUrl ? (
                    <MediaImage
                      src={video.channelAvatarUrl}
                      alt={video.channelTitle}
                      className="w-10 h-10 rounded-full object-cover border border-zinc-200 dark:border-white/10 shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-zinc-900 dark:bg-zinc-800 text-white font-semibold flex items-center justify-center shrink-0">
                      {video.channelTitle.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{video.channelTitle}</p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                      {channelSubsLabel || video.channelSubscribers}
                    </p>
                  </div>
                </div>

                <motion.button
                  type="button"
                  whileTap={{ scale: 0.94 }}
                  onClick={() => onToggleSubscribe(video)}
                  className={`min-h-[42px] px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                    video.isSubscribed
                      ? 'bg-zinc-200 dark:bg-white/10 text-zinc-900 dark:text-zinc-100'
                      : 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                  }`}
                >
                  {video.isSubscribed && <Bell className="w-3.5 h-3.5" />}
                  {video.isSubscribed ? 'Subscribed' : 'Subscribe'}
                </motion.button>
              </div>

              {/* Action Strip: Flex-wrap on mobile so no controls clip off-screen */}
              <div className="flex flex-wrap items-center gap-2">
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.9 }}
                  animate={video.isLiked ? { scale: [1, 1.12, 1] } : undefined}
                  transition={{ duration: 0.2 }}
                  onClick={() => onToggleLike(video)}
                  className={`min-h-[42px] px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                    video.isLiked
                      ? 'border-[var(--nextube-accent)] bg-[var(--nextube-accent)]/10 text-[var(--nextube-accent)]'
                      : 'border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5'
                  }`}
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span className="tabular-nums">{video.likeCount.toLocaleString()}</span>
                </motion.button>

                <button
                  type="button"
                  onClick={() => onOpenDownloadSheet(video)}
                  className="min-h-[42px] px-3.5 rounded-xl bg-[var(--nextube-accent)] text-white text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-opacity hover:opacity-90"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>

                {onToggleWatchLater && (
                  <button
                    type="button"
                    aria-pressed={isWatchLater}
                    onClick={() => onToggleWatchLater(video)}
                    className={`min-h-[42px] px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                      isWatchLater
                        ? 'border-[var(--nextube-accent)] bg-[var(--nextube-accent)]/10 text-[var(--nextube-accent)]'
                        : 'border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5'
                    }`}
                  >
                    {isWatchLater ? (
                      <BookmarkCheck className="w-4 h-4" />
                    ) : (
                      <Bookmark className="w-4 h-4" />
                    )}
                    {isWatchLater ? 'Saved' : 'Watch Later'}
                  </button>
                )}

                <button
                  type="button"
                  disabled={isTranslating}
                  onClick={() => void runTranslation()}
                  className={`min-h-[42px] px-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
                    isTranslated
                      ? 'border-[var(--nextube-accent)] bg-[var(--nextube-accent)]/10 text-[var(--nextube-accent)]'
                      : 'border-zinc-200 dark:border-white/10 hover:bg-zinc-100 dark:hover:bg-white/5'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isTranslating
                    ? 'Translating Text...'
                    : isTranslated
                    ? 'Original Text'
                    : 'Translate Text'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (navigator.share) {
                      void navigator.share({ title: video.title, url: window.location.href });
                    } else if (navigator.clipboard) {
                      void navigator.clipboard.writeText(window.location.href);
                    }
                  }}
                  aria-label="Share video"
                  className="min-h-[42px] px-3.5 rounded-xl border border-zinc-200 dark:border-white/10 text-xs font-medium flex items-center gap-1.5 hover:bg-zinc-100 dark:hover:bg-white/5 shrink-0"
                >
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>
            </div>

            {/* Description Block */}
            {video.description && (
              <div className="p-4 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-white/10">
                <p
                  dir={isTranslated && preferredLanguage.rtl ? 'rtl' : 'ltr'}
                  className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-line break-words"
                >
                  {isTranslated && translatedDescription
                    ? translatedDescription
                    : video.description}
                </p>
              </div>
            )}

            {/* Comments & Moderation Section */}
            <div className="pt-2">
              <CommentsSection
                videoId={video.id}
                isCreatorOwnedVideo={Boolean(video.isCreatorOwned)}
                comments={comments}
                translatedComments={translatedComments}
                isTranslated={isTranslated}
                isTranslating={isTranslating}
                targetLanguage={preferredLanguage}
                onToggleTranslate={() => void runTranslation()}
                onAddComment={(txt) => onAddComment(video.id, txt)}
                onDeleteComment={onDeleteComment}
                onReportComment={onReportComment}
                onToggleLikeComment={(cid) => onToggleLikeComment(video.id, cid)}
              />
            </div>
          </div>
        </div>

        {/* Right Up-Next Queue Column */}
        <div className="lg:col-span-4 px-4 sm:px-0 pb-10 space-y-3">
          <h3 className="text-sm font-semibold">Up Next</h3>
          <div className="space-y-3">
            {relatedVideos.map((rel) => (
              <button
                key={rel.id}
                type="button"
                onClick={() => onSelectRelated(rel)}
                className="w-full flex items-start gap-3 text-left group rounded-xl p-1.5 hover:bg-zinc-100 dark:hover:bg-white/[0.04] transition-colors"
              >
                <div className="relative w-36 aspect-video rounded-xl overflow-hidden shrink-0 bg-zinc-200 dark:bg-zinc-800">
                  <MediaImage
                    src={rel.thumbnailUrl}
                    alt={rel.title}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                  />
                  <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-white font-mono text-[10px] tabular-nums">
                    {rel.durationLabel}
                  </span>
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium line-clamp-2 leading-snug">{rel.title}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                    {rel.channelTitle}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {rel.viewCountLabel} · {rel.publishedAtLabel}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Responsive Mobile Bottom Sheet / Desktop Modal for Player Settings & Sleep Timer */}
      {showControlsMenu !== 'none' && (
        <div
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
          onClick={() => setShowControlsMenu('none')}
        >
          <div
            className="w-full sm:max-w-sm bg-white dark:bg-[#161619] text-zinc-900 dark:text-zinc-100 rounded-t-3xl sm:rounded-2xl border border-zinc-200 dark:border-white/15 p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sm:hidden w-10 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto" />
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {showControlsMenu === 'settings' ? 'Player Settings' : 'Sleep Timer'}
              </h3>
              <button
                type="button"
                onClick={() => setShowControlsMenu('none')}
                aria-label="Close player menu"
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl text-zinc-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {showControlsMenu === 'settings' ? (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                    Preferred Resolution
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {QUALITY_OPTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setSelectedQuality(q)}
                        className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-medium ${
                          selectedQuality === q
                            ? 'bg-[var(--nextube-accent)] text-white'
                            : 'bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-200'
                        }`}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-2">
                    Playback Speed
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {SPEED_OPTIONS.map((sp) => (
                      <button
                        key={sp}
                        type="button"
                        onClick={() => {
                          setPlaybackRate(sp);
                          if (videoRef.current) videoRef.current.playbackRate = sp;
                          if (isYoutubeIframe) sendYouTubeCommand('setPlaybackRate', [sp]);
                        }}
                        className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-mono ${
                          playbackRate === sp
                            ? 'bg-[var(--nextube-accent)] text-white'
                            : 'bg-zinc-100 dark:bg-white/10 text-zinc-700 dark:text-zinc-200'
                        }`}
                      >
                        {sp}x
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setBackgroundPlayEnabled((b) => !b)}
                  className="w-full min-h-[44px] px-3.5 rounded-xl bg-zinc-100 dark:bg-white/10 flex items-center justify-between text-xs font-medium"
                >
                  <span className="flex items-center gap-2">
                    <Headphones className="w-4 h-4" /> Background Audio Play
                  </span>
                  <span className="text-[var(--nextube-accent)] font-semibold">
                    {backgroundPlayEnabled ? 'On' : 'Off'}
                  </span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Automatically pause playback after:
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {SLEEP_TIMERS.map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => {
                        setSleepMinutes(mins);
                        setShowControlsMenu('none');
                      }}
                      className={`min-h-[44px] rounded-xl text-xs font-semibold ${
                        sleepMinutes === mins
                          ? 'bg-[var(--nextube-accent)] text-white'
                          : 'bg-zinc-100 dark:bg-white/10'
                      }`}
                    >
                      {mins === 0 ? 'Off' : `${mins} min`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
