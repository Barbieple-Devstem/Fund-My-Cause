"use client";

import React, { useState } from "react";
import {
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Reply,
  Flag,
  Trash2,
  Send,
} from "lucide-react";
import type { Comment } from "@/types/comment";
import { formatAddress } from "@/lib/format";
import { sanitizeComment } from "@/lib/sanitize";
import { useWallet } from "@/hooks/useWallet";

interface Props {
  campaignId: string;
  comments: Comment[];
  onAddComment: (content: string, parentId?: string) => Promise<void>;
  onVote: (commentId: string, type: "up" | "down") => Promise<void>;
  onFlag: (commentId: string, reason?: string) => Promise<void>;
  onDelete: (commentId: string) => Promise<void>;
  onModerate?: (
    commentId: string,
    action: "approve" | "reject",
  ) => Promise<void>;
  isCreator: boolean;
  pendingComments?: Comment[];
}

export function CommentSection({
  campaignId: _campaignId,
  comments,
  onAddComment,
  onVote,
  onFlag,
  onDelete,
  onModerate,
  isCreator,
  pendingComments,
}: Props) {
  const { address } = useWallet();
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [flagReason, setFlagReason] = useState("");
  const [flaggingId, setFlaggingId] = useState<string | null>(null);

  const topLevelComments = comments.filter((c) => !c.parentId && !c.isDeleted);

  const getReplies = (parentId: string) =>
    comments.filter((c) => c.parentId === parentId && !c.isDeleted);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAddComment(sanitizeComment(newComment.trim()));
      setNewComment("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReply = async (parentId: string) => {
    if (!replyContent.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAddComment(sanitizeComment(replyContent.trim()), parentId);
      setReplyContent("");
      setReplyTo(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFlag = async (commentId: string) => {
    if (flagReason.trim()) {
      await onFlag(commentId, flagReason.trim());
    } else {
      await onFlag(commentId);
    }
    setFlaggingId(null);
    setFlagReason("");
  };

  const CommentItem = ({
    comment,
    isReply = false,
  }: {
    comment: Comment;
    isReply?: boolean;
  }) => {
    const replies = getReplies(comment.id);
    const isAuthor = address === comment.author;
    const score = comment.upvotes - comment.downvotes;

    return (
      <div className={`${isReply ? "ml-8 mt-2" : ""}`}>
        <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1">
              <button
                onClick={() => onVote(comment.id, "up")}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                aria-label="Upvote"
              >
                <ThumbsUp
                  size={14}
                  className="text-gray-500 dark:text-gray-400"
                />
              </button>
              <span
                className={`text-xs font-medium ${
                  score > 0
                    ? "text-green-600 dark:text-green-400"
                    : score < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {score}
              </span>
              <button
                onClick={() => onVote(comment.id, "down")}
                className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                aria-label="Downvote"
              >
                <ThumbsDown
                  size={14}
                  className="text-gray-500 dark:text-gray-400"
                />
              </button>
            </div>

            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                <span className="font-mono">
                  {formatAddress(comment.author)}
                </span>
                {isAuthor && (
                  <span className="px-1.5 py-0.5 rounded bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-semibold">
                    You
                  </span>
                )}
                {comment.isFlagged && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 font-semibold">
                    Flagged
                  </span>
                )}
                <span>•</span>
                <span>{new Date(comment.timestamp).toLocaleDateString()}</span>
              </div>

              <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                {comment.content}
              </p>

              <div className="flex items-center gap-3 text-xs">
                {!isReply && (
                  <button
                    onClick={() => setReplyTo(comment.id)}
                    className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
                  >
                    <Reply size={12} />
                    Reply
                  </button>
                )}
                <button
                  onClick={() => setFlaggingId(comment.id)}
                  className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition"
                >
                  <Flag size={12} />
                  Flag
                </button>
                {(isCreator || isAuthor) && (
                  <button
                    onClick={() => onDelete(comment.id)}
                    className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition"
                  >
                    <Trash2 size={12} />
                    Delete
                  </button>
                )}
              </div>

              {flaggingId === comment.id && (
                <div className="flex gap-2 pt-2">
                  <input
                    type="text"
                    value={flagReason}
                    onChange={(e) => setFlagReason(e.target.value)}
                    placeholder="Reason for flagging (optional)"
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500"
                    maxLength={200}
                  />
                  <button
                    onClick={() => handleFlag(comment.id)}
                    className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition"
                  >
                    Report
                  </button>
                  <button
                    onClick={() => {
                      setFlaggingId(null);
                      setFlagReason("");
                    }}
                    className="px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-medium transition"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {replyTo === comment.id && (
          <div className="ml-8 mt-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="Write a reply..."
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent"
                maxLength={500}
              />
              <button
                onClick={() => handleReply(comment.id)}
                disabled={!replyContent.trim() || isSubmitting}
                className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition disabled:opacity-50"
              >
                Reply
              </button>
              <button
                onClick={() => {
                  setReplyTo(null);
                  setReplyContent("");
                }}
                className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {replies.length > 0 && (
          <div className="space-y-2 mt-2">
            {replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} isReply />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (!address) {
    return (
      <section className="p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
          Connect your wallet to join the discussion
        </p>
      </section>
    );
  }

  return (
    <section aria-labelledby="comments-heading" className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare size={20} className="text-gray-600 dark:text-gray-400" />
        <h3
          id="comments-heading"
          className="text-base font-semibold text-gray-900 dark:text-white"
        >
          Discussion ({comments.filter((c) => !c.isDeleted).length})
        </h3>
        {isCreator && pendingComments && pendingComments.length > 0 && (
          <span className="ml-2 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 text-xs font-semibold">
            {pendingComments.length} pending
          </span>
        )}
      </div>

      {/* Moderation queue for creators */}
      {isCreator && pendingComments && pendingComments.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20">
          <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">
            Moderation Queue ({pendingComments.length})
          </h4>
          {pendingComments.map((pc) => (
            <div
              key={pc.id}
              className="flex items-start gap-2 py-2 border-b border-amber-200 dark:border-amber-800 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500">
                  {formatAddress(pc.author)}
                </p>
                <p className="text-sm text-gray-800 dark:text-gray-200 truncate">
                  {pc.content}
                </p>
                {pc.flagReason && (
                  <p className="text-xs text-red-500 mt-1">
                    Reason: {pc.flagReason}
                  </p>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={() => onModerate?.(pc.id, "approve")}
                  className="px-2 py-1 rounded bg-green-600 hover:bg-green-500 text-white text-xs font-medium"
                >
                  Approve
                </button>
                <button
                  onClick={() => onModerate?.(pc.id, "reject")}
                  className="px-2 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-medium"
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Share your thoughts..."
          className="w-full px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 focus:border-transparent resize-none"
          rows={3}
          maxLength={1000}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            {newComment.length}/1000
          </span>
          <button
            type="submit"
            disabled={!newComment.trim() || isSubmitting}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition disabled:opacity-50"
          >
            <Send size={14} />
            Post Comment
          </button>
        </div>
      </form>

      <div className="space-y-3">
        {topLevelComments.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            No comments yet. Be the first to share your thoughts!
          </p>
        ) : (
          topLevelComments.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))
        )}
      </div>
    </section>
  );
}
