import { Cpu, Database, Download, Globe, ShieldCheck, Smartphone } from 'lucide-react';

const MODULES = [
  {
    icon: ShieldCheck,
    title: '01. OAuth 2.0 & Real-Time YouTube Sync',
    summary:
      'Uses Firebase Auth with GoogleAuthProvider (youtube.force-ssl, userinfo.profile, userinfo.email) and in-memory access token caching. Multi-account switching triggers prompt: select_account while syncing feeds, subscriptions, playlists, likes, and comment moderation back to YouTube Data API v3.',
  },
  {
    icon: Smartphone,
    title: '02. Gesture Player, PiP & Background Audio',
    summary:
      'Custom touch-gesture surface supporting left-edge brightness scrubbing, right-edge volume control, double-tap -10s/+10s seeking, two-finger pinch-to-zoom, Picture-in-Picture, MediaSession lock-screen controls, Sleep Timer, and SponsorBlock auto-skip segments.',
  },
  {
    icon: Download,
    title: '03. Direct Gallery & Offline Playlist Vault',
    summary:
      'Chunked stream downloader stores selected resolutions (1080p, 720p, 480p, Audio M4A) in IndexedDB for offline playback and exports media directly to the device Media Gallery / Camera Roll (MediaStore API on Android, PHPhotoLibrary on iOS, File System / Blob export on Web).',
  },
  {
    icon: Globe,
    title: '04. Text-Only 100+ Language AI Translator',
    summary:
      'Server-side Express proxy (/api/translate) powered by Gemini 4 Hydrogen with ThinkingLevel.LOW and strict JSON schema output. Translates text content only (video titles, descriptions, and user comments) with full RTL layout support for Urdu, Arabic, Persian, and Hebrew.',
  },
  {
    icon: Database,
    title: '05. Creator Comment Moderation & Safety',
    summary:
      'Provides confirmation-gated comment deletion (comments.delete) on creator-owned videos and community guideline violation reporting (comments.markAsSpam) backed by an auditable in-app Moderation Log.',
  },
  {
    icon: Cpu,
    title: '06. Cross-Platform Mobile Parity',
    summary:
      'Clean separation between UI screens, state hooks, API adapters, and local storage mirrors React Native (Expo AV + react-native-gesture-handler + expo-media-library) and Flutter (better_player + photo_manager + dio) production module boundaries.',
  },
];

export function ArchitectureBlueprintView() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 max-w-2xl">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-balance">
          NexTube Modular System Architecture
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
          Production-ready module boundaries bridging Google OAuth 2.0, YouTube Data API v3, gesture playback, local offline storage, and server-side AI translation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {MODULES.map((mod) => {
          const Icon = mod.icon;
          return (
            <div
              key={mod.title}
              className="p-5 rounded-2xl bg-white dark:bg-[#141414] border border-zinc-200 dark:border-white/10 space-y-3"
            >
              <div className="w-10 h-10 rounded-xl bg-[var(--nextube-accent)]/10 text-[var(--nextube-accent)] flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </div>
              <h3 className="text-sm font-semibold">{mod.title}</h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
                {mod.summary}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
