import { useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { WORLD_LANGUAGES } from '../data/languages';
import type { LanguageOption } from '../types/nextube';

interface LanguagePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLanguage: LanguageOption;
  onSelect: (lang: LanguageOption) => void;
}

export function LanguagePickerModal({
  isOpen,
  onClose,
  selectedLanguage,
  onSelect,
}: LanguagePickerModalProps) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return WORLD_LANGUAGES;
    return WORLD_LANGUAGES.filter(
      (l) =>
        l.name.toLowerCase().includes(q) ||
        l.nativeName.toLowerCase().includes(q) ||
        l.code.toLowerCase().includes(q)
    );
  }, [query]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/65 backdrop-blur-sm p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md bg-white dark:bg-[#141414] text-zinc-900 dark:text-zinc-100 rounded-t-3xl sm:rounded-2xl border border-zinc-200 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[82vh]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Select AI Translation Language"
      >
        <div className="sm:hidden w-10 h-1.5 bg-zinc-300 dark:bg-zinc-700 rounded-full mx-auto mt-3" />

        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-white/10">
          <div>
            <h2 className="text-base font-semibold">AI Text Translation Language</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {WORLD_LANGUAGES.length}+ languages for titles, descriptions &amp; comments (text-only)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close language picker"
            className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-zinc-200 dark:border-white/10">
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search Urdu, Hindi, Arabic, Spanish..."
              className="w-full h-11 pl-10 pr-4 rounded-xl bg-zinc-100 dark:bg-white/[0.06] border border-transparent focus:border-[var(--nextube-accent)] text-sm outline-none transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-white/5">
          {filtered.map((lang) => {
            const active = lang.code === selectedLanguage.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  onSelect(lang);
                  onClose();
                }}
                className="w-full min-h-[52px] px-5 py-3 flex items-center justify-between text-left hover:bg-zinc-50 dark:hover:bg-white/[0.04] transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{lang.name}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {lang.nativeName} {lang.rtl ? '· RTL' : ''}
                  </p>
                </div>
                {active && <Check className="w-4 h-4 text-[var(--nextube-accent)] shrink-0" />}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
              No matching languages found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
