"use client";

import React, { useRef, useState } from "react";
import { Loader2, PlusCircle, Trash2, X } from "lucide-react";
import type { ProfileData } from "@/types/profile";
import { writeProfile } from "@/lib/profileStore";
import {
  validateBio,
  validateSocialLinks,
  MAX_BIO_LENGTH,
  MAX_SOCIAL_LINKS,
} from "@/lib/profileValidation";
import { uploadToPinata } from "@/lib/pinata";
import { validateImageFile } from "@/lib/imageValidation";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { Input, Textarea } from "@fund-my-cause/components";
import {
  FORM_ERROR_CLS_XS,
  FORM_FIELD_CLS,
  FORM_INPUT_CLS_SM,
  FORM_LABEL_CLS_MUTED,
} from "@/lib/formStyles";

interface EditProfileModalProps {
  address: string;
  current: ProfileData;
  onSave: (updated: ProfileData) => void;
  onClose: () => void;
}

/**
 * Modal for editing profile metadata: avatar, bio, and social links.
 */
export function EditProfileModal({
  address,
  current,
  onSave,
  onClose,
}: EditProfileModalProps) {
  const [avatarUri, setAvatarUri] = useState(current.avatarUri);
  const [bio, setBio] = useState(current.bio);
  const [socialLinks, setSocialLinks] = useState<string[]>(
    current.socialLinks.length > 0 ? current.socialLinks : [""],
  );
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [bioError, setBioError] = useState<string | null>(null);
  const [linksError, setLinksError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useFocusTrap(true, {
    onEscape: onClose,
  }) as React.RefObject<HTMLDivElement>;

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const result = validateImageFile(file);
    if (!result.valid) {
      setAvatarError(result.error ?? "Invalid file.");
      return;
    }

    setAvatarError(null);
    setAvatarUploading(true);
    try {
      const uri = await uploadToPinata(file);
      setAvatarUri(uri);
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : "Upload failed.");
      // Retain previous avatar — no state change for avatarUri
    } finally {
      setAvatarUploading(false);
    }
  };

  const updateLink = (i: number, value: string) => {
    setSocialLinks((prev) => prev.map((l, idx) => (idx === i ? value : l)));
  };

  const addLink = () => {
    if (socialLinks.length < MAX_SOCIAL_LINKS) {
      setSocialLinks((prev) => [...prev, ""]);
    }
  };

  const removeLink = (i: number) => {
    setSocialLinks((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSave = () => {
    let valid = true;

    if (!validateBio(bio)) {
      setBioError(`Bio must be at most ${MAX_BIO_LENGTH} characters.`);
      valid = false;
    } else {
      setBioError(null);
    }

    const filledLinks = socialLinks.filter((l) => l.trim() !== "");
    if (!validateSocialLinks(filledLinks)) {
      setLinksError(
        filledLinks.length > MAX_SOCIAL_LINKS
          ? `At most ${MAX_SOCIAL_LINKS} social links allowed.`
          : "All links must be valid URLs.",
      );
      valid = false;
    } else {
      setLinksError(null);
    }

    if (!valid) return;

    const updated: ProfileData = {
      avatarUri,
      bio: bio.trim(),
      socialLinks: filledLinks,
    };

    writeProfile(address, updated);
    onSave(updated);
  };

  /** Styling handed to every shared form primitive in this modal. */
  const fieldStyles = {
    unstyled: true as const,
    className: FORM_INPUT_CLS_SM,
    fieldClassName: FORM_FIELD_CLS,
    labelClassName: FORM_LABEL_CLS_MUTED,
    errorClassName: FORM_ERROR_CLS_XS,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-profile-title"
        className="w-full max-w-lg space-y-5 rounded-2xl border border-gray-700 bg-gray-900 p-6 max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 id="edit-profile-title" className="text-lg font-semibold">
            Edit Profile
          </h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="text-gray-500 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Avatar */}
        <div className="space-y-2">
          <p className="text-sm text-gray-400">Avatar</p>
          <div className="flex items-center gap-4">
            {avatarUri ? (
              <img
                src={
                  avatarUri.startsWith("ipfs://")
                    ? `https://gateway.pinata.cloud/ipfs/${avatarUri.slice(7)}`
                    : avatarUri
                }
                alt="Current avatar"
                className="w-16 h-16 rounded-full object-cover border border-gray-700"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-gray-500 text-xs">
                No avatar
              </div>
            )}
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarUploading}
                className="px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm text-gray-300 transition disabled:opacity-50"
              >
                {avatarUploading ? (
                  <span className="flex items-center gap-1">
                    <Loader2 size={12} className="animate-spin" />
                    Uploading…
                  </span>
                ) : (
                  "Upload Image"
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleAvatarChange}
                disabled={avatarUploading}
                aria-hidden="true"
              />
              <p className="text-xs text-gray-600 mt-1">
                PNG, JPG, WebP — max 5 MB
              </p>
            </div>
          </div>
          {avatarError && <p className="text-xs text-red-400">{avatarError}</p>}
        </div>

        {/* Bio */}
        <Textarea
          {...fieldStyles}
          id="edit-bio"
          fieldClassName={`${FORM_FIELD_CLS} space-y-1`}
          label={
            <>
              Bio{" "}
              <span className="text-gray-600">
                ({bio.length}/{MAX_BIO_LENGTH})
              </span>
            </>
          }
          error={bioError}
          rows={3}
          placeholder="Tell the community about yourself…"
          value={bio}
          maxLength={MAX_BIO_LENGTH}
          onChange={(e) => setBio(e.target.value)}
        />

        {/* Social links */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Social Links{" "}
              <span className="text-gray-600">
                ({socialLinks.length}/{MAX_SOCIAL_LINKS})
              </span>
            </p>
            {socialLinks.length < MAX_SOCIAL_LINKS && (
              <button
                type="button"
                onClick={addLink}
                className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition"
              >
                <PlusCircle size={12} /> Add
              </button>
            )}
          </div>
          {socialLinks.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                {...fieldStyles}
                fieldClassName={`${FORM_FIELD_CLS} flex-1`}
                type="url"
                aria-label={`Social link ${i + 1}`}
                placeholder="https://twitter.com/yourhandle"
                value={link}
                onChange={(e) => updateLink(i, e.target.value)}
              />
              <button
                type="button"
                onClick={() => removeLink(i)}
                aria-label="Remove link"
                className="text-gray-500 hover:text-red-400 transition shrink-0"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {linksError && <p className="text-xs text-red-400">{linksError}</p>}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white transition"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
