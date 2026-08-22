"use client";

import React, { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { createUpdate, editUpdate } from "@/lib/updateStore";
import type { Update } from "@/lib/updateStore";
import { useNotifications } from "@/hooks/useNotifications";
import { useFocusTrap } from "@/hooks/useFocusTrap";

const MAX_TITLE = 100;
const MAX_BODY = 2000;

type ModalState = "idle" | "submitting" | "error";

interface PostUpdateModalProps {
  campaignId: string;
  campaignTitle: string;
  authorAddress: string;
  /** Present when editing an existing update */
  existingCid?: string;
  existingUpdate?: Update;
  onClose: () => void;
  onSuccess: (cid: string) => void;
}

/**
 * Modal for creating or editing a campaign update.
 * Collects title + body, validates, uploads to IPFS via UpdateStore.
 */
export function PostUpdateModal({
  campaignId,
  campaignTitle,
  authorAddress,
  existingCid,
  existingUpdate,
  onClose,
  onSuccess,
}: PostUpdateModalProps) {
  const { addNotification } = useNotifications();
  const [title, setTitle] = useState(existingUpdate?.title ?? "");
  const [body, setBody] = useState(existingUpdate?.body ?? "");
  const [state, setState] = useState<ModalState>("idle");
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const isLocked = state === "submitting";
  const dialogRef = useFocusTrap(true, {
    onEscape: () => {
      if (!isLocked) onClose();
    },
  }) as React.RefObject<HTMLDivElement>;

  // Focus title on open
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const isEditing = !!existingCid && !!existingUpdate;

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    if (!body.trim()) {
      setError("Body is required.");
      return;
    }

    setState("submitting");
    setError(null);

    try {
      let cid: string;
      if (isEditing && existingCid) {
        cid = await editUpdate(campaignId, existingCid, {
          title: title.trim(),
          body: body.trim(),
        });
      } else {
        cid = await createUpdate(
          {
            campaignId,
            title: title.trim(),
            body: body.trim(),
            authorAddress,
          },
          addNotification,
        );
      }
      onSuccess(cid);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Upload failed. Please try again.",
      );
      setState("error");
    }
  };

  const inputCls =
    "w-full rounded-xl border border-gray-700 bg-gray-800 px-4 py-2 text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-update-title"
        className="w-full max-w-lg space-y-4 rounded-2xl border border-gray-700 bg-gray-900 p-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 id="post-update-title" className="text-lg font-semibold">
            {isEditing ? "Edit Update" : "Post Update"}
          </h2>
          <button
            onClick={onClose}
            disabled={isLocked}
            aria-label="Close modal"
            className="text-gray-500 hover:text-white transition disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-gray-500">
          Campaign: <span className="text-gray-300">{campaignTitle}</span>
        </p>

        {/* Title */}
        <div>
          <label
            htmlFor="update-title"
            className="mb-1 block text-sm text-gray-400"
          >
            Title{" "}
            <span className="text-gray-600">
              ({title.length}/{MAX_TITLE})
            </span>
          </label>
          <input
            id="update-title"
            ref={titleRef}
            className={inputCls}
            placeholder="What's new with your campaign?"
            value={title}
            maxLength={MAX_TITLE}
            onChange={(e) => setTitle(e.target.value)}
            disabled={isLocked}
          />
        </div>

        {/* Body */}
        <div>
          <label
            htmlFor="update-body"
            className="mb-1 block text-sm text-gray-400"
          >
            Body{" "}
            <span className="text-gray-600">
              ({body.length}/{MAX_BODY})
            </span>
          </label>
          <textarea
            id="update-body"
            rows={6}
            className={inputCls}
            placeholder="Share your progress, milestones, or updates with your backers…"
            value={body}
            maxLength={MAX_BODY}
            onChange={(e) => setBody(e.target.value)}
            disabled={isLocked}
          />
        </div>

        {/* Error */}
        {error && <p className="text-sm text-red-400">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={isLocked}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isLocked}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:opacity-50"
          >
            {isLocked && <Loader2 size={14} className="animate-spin" />}
            {isEditing ? "Save Changes" : "Post Update"}
          </button>
        </div>
      </div>
    </div>
  );
}
