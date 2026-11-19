import { useState } from 'react';
import {
  Flag,
  Languages,
  MoreVertical,
  Pin,
  Send,
  ShieldAlert,
  ThumbsUp,
  Trash2,
} from 'lucide-react';
import type { CommentItem, LanguageOption } from '../types/nextube';

interface CommentsSectionProps {
  videoId: string;
  isCreatorOwnedVideo: boolean;
  comments: CommentItem[];
  translatedComments: Record<string, string>;
  isTranslated: boolean;
  isTranslating: boolean;
  targetLanguage: LanguageOption;
  onToggleTranslate: () => void;
  onAddComment: (text: string) => Promise<void>;
  onDeleteComment: (comment: CommentItem) => Promise<void>;
  onReportComment: (comment: CommentItem, reason: string) => Promise<void>;
  onToggleLikeComment: (commentId: string) => void;
}

const REPORT_REASONS = [
  'Spam or misleading commercial links',
  'Harassment or personal attacks',
  'Hate speech or abusive content',
  'Dangerous or harmful misinformation',
];

export function CommentsSection({
  isCreatorOwnedVideo,
  comments,
  translatedComments,
  isTranslated,
  isTranslating,
  targetLanguage,
  onToggleTranslate,
  onAddComment,
  onDeleteComment,
  onReportComment,
  onToggleLikeComment,
}: CommentsSectionProps) {
  const [draft, setDraft] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Explicit confirmation modal state (required before mutating/deleting user data)
  const [confirmDelete, setConfirmDelete] = useState<CommentItem | null>(null);
  const [confirmReport, setConfirmReport] = useState<CommentItem | null>(null);
  const [reportReason, setReportReason] = useState(REPORT_REASONS[0]);
  const [isModerating, setIsModerating] = useState(false);

  const visibleComments = comments.filter((c) => c.moderationStatus !== 'deleted');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || isPosting) return;
    setIsPosting(true);
    try {
      await onAddComment(draft.trim());
      setDraft('');
    } finally {
      setIsPosting(false);
    }
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    setIsModerating(true);
    try {
      await onDeleteComment(confirmDelete);
      setConfirmDelete(null);
    } finally {
      setIsModerating(false);
    }
  };

  const executeReport = async () => {
    if (!confirmReport) return;
    setIsModerating(true);
    try {
      await onReportComment(confirmReport, reportReason);
      setConfirmReport(null);
    } finally {
      setIsModerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header + Floating One-Tap Translate Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">
            Comments <span className="text-zinc-500 dark:text-zinc-400 font-normal">({visibleComments.length})</span>
          </h3>
          {isCreatorOwnedVideo && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
              · <ShieldAlert className="w-3.5 h-3.5 text-emerald-500" /> Creator Moderation Active
            </span>
          )}
        </div>

        <button
          type="button"
          disabled={isTranslating}
          onClick={onToggleTranslate}
          className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-2 border transition-colors whitespace-nowrap shrink-0 ${
            isTranslated
              ? 'bg-[var(--nextube-accent)] text-white border-[var(--nextube-accent)]'
              : 'bg-zinc-100 dark:bg-white/[0.06] border-zinc-200 dark:border-white/10 hover:border-zinc-300 dark:hover:border-white/20'
          }`}
        >
          <Languages className="w-3.5 h-3.5" />
          {isTranslating
            ? 'Translating...'
            : isTranslated
            ? `Showing ${targetLanguage.name}`
            : `Translate to ${targetLanguage.name}`}
        </button>
      </div>

      {/* Add Comment Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add a comment..."
          className="flex-1 h-11 px-4 rounded-xl bg-zinc-100 dark:bg-white/[0.06] border border-transparent focus:border-[var(--nextube-accent)] text-sm outline-none transition-colors"
        />
        <button
          type="submit"
          disabled={!draft.trim() || isPosting}
          aria-label="Post comment"
          className="min-w-[44px] h-11 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 disabled:opacity-40 text-xs font-semibold flex items-center justify-center gap-1.5 transition-opacity"
        >
          <Send className="w-3.5 h-3.5" />
          Post
        </button>
      </form>

      {/* Comment Thread */}
      <div className="divide-y divide-zinc-100 dark:divide-white/5">
        {visibleComments.map((c) => {
          const canDelete = isCreatorOwnedVideo || c.isCreatorOwnComment;
          const displayText =
            isTranslated && translatedComments[c.id] ? translatedComments[c.id] : c.text;
          const isRtl = isTranslated && Boolean(targetLanguage.rtl);

          return (
            <div key={c.id} className="py-3.5 flex items-start gap-3 relative">
              <div
                className="w-9 h-9 rounded-full text-white text-xs font-semibold flex items-center justify-center shrink-0 mt-0.5"
                style={{ backgroundColor: c.authorAvatarColor }}
              >
                {c.authorName.slice(0, 1).toUpperCase()}
              </div>

              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {c.authorName}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{c.publishedAt}</span>
                  {c.isPinned && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1 text-zinc-600 dark:text-zinc-300">
                        <Pin className="w-3 h-3" /> Pinned
                      </span>
                    </>
                  )}
                  {c.moderationStatus === 'reported' && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span className="text-amber-600 dark:text-amber-400 font-medium">
                        Flagged for review
                      </span>
                    </>
                  )}
                </div>

                <p
                  dir={isRtl ? 'rtl' : 'ltr'}
                  className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed break-words"
                >
                  {displayText}
                </p>

                <div className="flex items-center gap-4 pt-1">
                  <button
                    type="button"
                    onClick={() => onToggleLikeComment(c.id)}
                    className={`min-h-[36px] flex items-center gap-1.5 text-xs transition-colors ${
                      c.isLiked
                        ? 'text-[var(--nextube-accent)] font-semibold'
                        : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                    }`}
                  >
                    <ThumbsUp className="w-3.5 h-3.5" />
                    <span className="tabular-nums">{c.likeCount}</span>
                  </button>
                </div>
              </div>

              {/* Moderation Menu Button */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  aria-label="Comment moderation options"
                  onClick={() => setOpenMenuId(openMenuId === c.id ? null : c.id)}
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-white/5"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>

                {openMenuId === c.id && (
                  <div className="absolute right-0 top-10 z-30 w-52 rounded-xl bg-white dark:bg-[#1C1C1F] border border-zinc-200 dark:border-white/10 shadow-xl py-1.5">
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => {
                          setOpenMenuId(null);
                          setConfirmDelete(c);
                        }}
                        className="w-full min-h-[42px] px-3.5 py-2 text-left text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 flex items-center gap-2.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete comment
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setOpenMenuId(null);
                        setConfirmReport(c);
                      }}
                      className="w-full min-h-[42px] px-3.5 py-2 text-left text-xs font-medium text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-white/5 flex items-center gap-2.5"
                    >
                      <Flag className="w-3.5 h-3.5 text-amber-500" />
                      Report violation
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {visibleComments.length === 0 && (
          <p className="py-6 text-center text-xs text-zinc-500 dark:text-zinc-400">
            No comments yet. Be the first to share a note.
          </p>
        )}
      </div>

      {/* Explicit Confirmation Modal: Delete Comment */}
      {confirmDelete && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => !isModerating && setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#161618] rounded-2xl border border-zinc-200 dark:border-white/10 p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirm Delete Comment"
          >
            <h4 className="text-base font-semibold">Delete comment permanently?</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
              This will remove <span className="font-medium text-zinc-900 dark:text-zinc-100">{confirmDelete.authorName}</span>&apos;s comment from this video and sync the deletion to YouTube if connected.
            </p>
            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-white/[0.04] text-xs text-zinc-600 dark:text-zinc-300 line-clamp-3">
              &ldquo;{confirmDelete.text}&rdquo;
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isModerating}
                onClick={() => setConfirmDelete(null)}
                className="h-10 px-4 rounded-xl text-xs font-medium border border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isModerating}
                onClick={executeDelete}
                className="h-10 px-4 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white"
              >
                {isModerating ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Explicit Confirmation Modal: Report Comment */}
      {confirmReport && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => !isModerating && setConfirmReport(null)}
        >
          <div
            className="w-full max-w-sm bg-white dark:bg-[#161618] rounded-2xl border border-zinc-200 dark:border-white/10 p-5 space-y-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="alertdialog"
            aria-modal="true"
            aria-label="Report Comment Violation"
          >
            <h4 className="text-base font-semibold">Report community guideline violation</h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Select the reason for reporting {confirmReport.authorName}&apos;s comment:
            </p>
            <div className="space-y-2">
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setReportReason(reason)}
                  className={`w-full min-h-[42px] px-3.5 py-2 rounded-xl border text-left text-xs transition-colors ${
                    reportReason === reason
                      ? 'border-[var(--nextube-accent)] bg-[var(--nextube-accent)]/10 font-medium'
                      : 'border-zinc-200 dark:border-white/10 hover:bg-zinc-50 dark:hover:bg-white/[0.04]'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isModerating}
                onClick={() => setConfirmReport(null)}
                className="h-10 px-4 rounded-xl text-xs font-medium border border-zinc-200 dark:border-white/10"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isModerating}
                onClick={executeReport}
                className="h-10 px-4 rounded-xl text-xs font-semibold bg-[var(--nextube-accent)] hover:opacity-90 text-white"
              >
                {isModerating ? 'Reporting...' : 'Submit Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
