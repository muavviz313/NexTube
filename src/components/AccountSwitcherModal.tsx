import { useState } from 'react';
import {
  Check,
  EyeOff,
  Globe,
  LogOut,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  UserCheck,
  X,
} from 'lucide-react';
import type { GoogleAccountProfile, LanguageOption, ThemeMode } from '../types/nextube';
import { MediaImage } from './MediaImage';

export const ACCENT_COLORS = [
  { name: 'Crimson', value: '#FF2E4C' },
  { name: 'Cobalt', value: '#2563EB' },
  { name: 'Emerald', value: '#10B981' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Violet', value: '#7C3AED' },
  { name: 'Rose', value: '#EC4899' },
];

interface AccountSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: GoogleAccountProfile[];
  activeAccount: GoogleAccountProfile | null;
  isIncognito: boolean;
  onToggleIncognito: () => void;
  onSignInNewAccount: () => Promise<void>;
  onSwitchAccount: (uid: string) => void;
  onSignOut: () => Promise<void>;
  themeMode: ThemeMode;
  onChangeThemeMode: (mode: ThemeMode) => void;
  accentColor: string;
  onChangeAccentColor: (color: string) => void;
  sponsorBlockEnabled: boolean;
  onToggleSponsorBlock: () => void;
  preferredLanguage: LanguageOption;
  onOpenLanguagePicker: () => void;
  authError: string | null;
}

export function AccountSwitcherModal({
  isOpen,
  onClose,
  accounts,
  activeAccount,
  isIncognito,
  onToggleIncognito,
  onSignInNewAccount,
  onSwitchAccount,
  onSignOut,
  themeMode,
  onChangeThemeMode,
  accentColor,
  onChangeAccentColor,
  sponsorBlockEnabled,
  onToggleSponsorBlock,
  preferredLanguage,
  onOpenLanguagePicker,
  authError,
}: AccountSwitcherModalProps) {
  const [isConnecting, setIsConnecting] = useState(false);

  if (!isOpen) return null;

  const handleGoogleConnect = async () => {
    setIsConnecting(true);
    try {
      await onSignInNewAccount();
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-[#141414] text-zinc-900 dark:text-zinc-100 rounded-t-3xl sm:rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Account Switcher & Preferences"
      >
        {/* Mobile grab handle */}
        <div className="sm:hidden w-10 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mt-3" />

        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-white/10">
          <h2 className="text-base font-semibold">Google Account &amp; Appearance</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close account switcher"
            className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* Active Profile Banner */}
          {activeAccount && !isIncognito ? (
            <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/10">
              {activeAccount.photoURL ? (
                <MediaImage
                  src={activeAccount.photoURL}
                  alt={activeAccount.displayName}
                  className="w-11 h-11 rounded-full object-cover shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-[var(--nextube-accent)] text-white font-semibold flex items-center justify-center shrink-0">
                  {activeAccount.displayName.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{activeAccount.displayName}</p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                  {activeAccount.email} · Synced with YouTube
                </p>
              </div>
              <UserCheck className="w-4 h-4 text-emerald-500 shrink-0" />
            </div>
          ) : (
            <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-zinc-50 dark:bg-white/[0.04] border border-zinc-200 dark:border-white/10">
              <div className="w-11 h-11 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 flex items-center justify-center shrink-0">
                <EyeOff className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">
                  {isIncognito ? 'Incognito Mode Active' : 'Not Signed In'}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {isIncognito
                    ? 'Watch history syncing is paused'
                    : 'Sign in with Google to sync your YouTube feeds & playlists'}
                </p>
              </div>
            </div>
          )}

          {authError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 text-xs text-rose-700 dark:text-rose-300">
              {authError}
            </div>
          )}

          {/* Connected Accounts List */}
          {accounts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 px-1">
                Switch Google Account
              </p>
              <div className="divide-y divide-zinc-100 dark:divide-white/5 rounded-xl border border-zinc-200 dark:border-white/10 overflow-hidden">
                {accounts.map((acc) => {
                  const isActive = !isIncognito && activeAccount?.uid === acc.uid;
                  return (
                    <button
                      key={acc.uid}
                      type="button"
                      onClick={() => onSwitchAccount(acc.uid)}
                      className="w-full min-h-[52px] flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors"
                    >
                      {acc.photoURL ? (
                        <MediaImage
                          src={acc.photoURL}
                          alt={acc.displayName}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-800 text-xs font-semibold flex items-center justify-center shrink-0">
                          {acc.displayName.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{acc.displayName}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{acc.email}</p>
                      </div>
                      {isActive && <Check className="w-4 h-4 text-[var(--nextube-accent)] shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Official Google Sign-In / Add Account CTA */}
          <div className="space-y-2.5">
            <button
              type="button"
              disabled={isConnecting}
              onClick={handleGoogleConnect}
              className="gsi-material-button w-full"
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
                  {isConnecting
                    ? 'Connecting Google Account...'
                    : activeAccount
                    ? 'Add or Switch Google Account'
                    : 'Sign in with Google'}
                </span>
              </div>
            </button>

            {activeAccount && (
              <button
                type="button"
                onClick={onSignOut}
                className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl border border-zinc-200 dark:border-white/10 text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out of YouTube Sync
              </button>
            )}
          </div>

          {/* Theme Mode User Control: White (Light), Dark, System */}
          <div className="space-y-3 pt-3 border-t border-zinc-200 dark:border-white/10">
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                Theme Mode (White / Dark / System)
              </p>
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-white/[0.06]">
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
                      onClick={() => onChangeThemeMode(mode.id)}
                      className={`min-h-[40px] rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                        active
                          ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm'
                          : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {mode.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* User Accent Color Control */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5" />
                  Accent Color
                </p>
                <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
                  {ACCENT_COLORS.find((c) => c.value === accentColor)?.name || 'Custom'}
                </span>
              </div>
              <div className="flex items-center gap-2.5">
                {ACCENT_COLORS.map((preset) => {
                  const active = accentColor.toLowerCase() === preset.value.toLowerCase();
                  return (
                    <button
                      key={preset.value}
                      type="button"
                      aria-label={`Set accent color ${preset.name}`}
                      onClick={() => onChangeAccentColor(preset.value)}
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-transform ${
                        active ? 'ring-2 ring-offset-2 ring-zinc-900 dark:ring-white dark:ring-offset-[#141414] scale-105' : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: preset.value }}
                    >
                      {active && <Check className="w-4 h-4 text-white" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* App Controls & Modes */}
          <div className="space-y-1 pt-2 border-t border-zinc-200 dark:border-white/10">
            <button
              type="button"
              onClick={onToggleIncognito}
              className="w-full min-h-[48px] flex items-center justify-between px-3 py-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors"
            >
              <span className="flex items-center gap-3 text-sm font-medium">
                <EyeOff className="w-4 h-4 text-zinc-500 dark:text-zinc-400" />
                Incognito Mode
              </span>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {isIncognito ? 'On' : 'Off'}
              </span>
            </button>

            <button
              type="button"
              onClick={onToggleSponsorBlock}
              className="w-full min-h-[48px] flex items-center justify-between px-3 py-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors"
            >
              <span className="flex items-center gap-3 text-sm font-medium">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                SponsorBlock Auto-Skip
              </span>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {sponsorBlockEnabled ? 'Enabled' : 'Paused'}
              </span>
            </button>

            <button
              type="button"
              onClick={onOpenLanguagePicker}
              className="w-full min-h-[48px] flex items-center justify-between px-3 py-2 rounded-xl hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors"
            >
              <span className="flex items-center gap-3 text-sm font-medium">
                <Globe className="w-4 h-4 text-sky-500" />
                AI Translation Language
              </span>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                {preferredLanguage.name}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
