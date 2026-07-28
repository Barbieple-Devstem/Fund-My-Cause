"use client";

import React, { ReactNode } from "react";
import { Bookmark, Share2 } from "lucide-react";
import { cn } from "./lib/utils";

export interface CampaignActionsClassNames {
  root?: string;
  donate?: string;
  iconButton?: string;
  icon?: string;
  savedIcon?: string;
}

export interface CampaignActionsProps {
  /**
   * `inline` lays the actions out in a row of icon buttons (for overlaying on
   * the card media); `stacked` renders a full-width primary action.
   */
  layout?: "inline" | "stacked";

  /** Primary call to action. Omit to render no donate button. */
  onDonate?: () => void;
  donateLabel?: ReactNode;
  donateAriaLabel?: string;
  donateDisabled?: boolean;

  /** Share handler. Omit to hide the share button entirely. */
  onShare?: () => void;
  shareAriaLabel?: string;

  /** Save/bookmark handler. Omit to hide the save button entirely. */
  onSave?: () => void;
  /** Current saved state — drives the filled icon and the aria label. */
  saved?: boolean;
  saveAriaLabel?: string;
  unsaveAriaLabel?: string;

  /** Extra controls rendered alongside the buttons (e.g. a compare checkbox). */
  children?: ReactNode;

  /** Disables every action and marks the primary button busy. */
  isLoading?: boolean;
  /** Shown in place of the actions. */
  error?: string | null;

  /**
   * Drops the library's default button styling so `classNames` fully owns the
   * look. Use when adopting the component inside an app that already has its
   * own button styles and needs pixel-identical output.
   */
  unstyled?: boolean;

  classNames?: CampaignActionsClassNames;
  className?: string;
}

const DEFAULT_ICON_BUTTON =
  "p-2 rounded-full transition touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center";

const DEFAULT_DONATE =
  "w-full py-3 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation";

/**
 * Action controls for a campaign — donate, share and save.
 *
 * Every action is opt-in via its handler, so the same component serves the
 * icon row overlaid on card media and the full-width donate button below it.
 * Click handlers stop propagation so the actions stay usable inside a card
 * that is itself clickable.
 *
 * @example
 * <CampaignActions layout="inline" onShare={share} onSave={save} saved={bookmarked} />
 * <CampaignActions onDonate={pledge} donateLabel="Pledge now" />
 */
export function CampaignActions({
  layout = "stacked",
  onDonate,
  donateLabel,
  donateAriaLabel,
  donateDisabled = false,
  onShare,
  shareAriaLabel = "Share campaign",
  onSave,
  saved = false,
  saveAriaLabel = "Save campaign",
  unsaveAriaLabel = "Remove from saved",
  children,
  isLoading = false,
  error = null,
  unstyled = false,
  classNames,
  className,
}: CampaignActionsProps) {
  if (error) {
    return (
      <p
        role="alert"
        className={cn("text-sm text-red-500", classNames?.root, className)}
      >
        {error}
      </p>
    );
  }

  const iconButtonClass = cn(
    !unstyled && DEFAULT_ICON_BUTTON,
    classNames?.iconButton,
  );
  const donateClass = cn(!unstyled && DEFAULT_DONATE, classNames?.donate);

  /** Keeps a click on an action from also triggering an enclosing card link. */
  const isolate = (handler?: () => void) => (event: React.MouseEvent) => {
    event.stopPropagation();
    handler?.();
  };

  return (
    <div
      className={cn(
        layout === "inline" ? "flex gap-1" : "space-y-3",
        classNames?.root,
        className,
      )}
    >
      {(onShare || onSave) && (
        <div className={layout === "inline" ? "contents" : "flex gap-1"}>
          {onShare && (
            <button
              type="button"
              onClick={isolate(onShare)}
              disabled={isLoading}
              aria-label={shareAriaLabel}
              className={iconButtonClass}
            >
              <Share2 size={15} className={classNames?.icon} />
            </button>
          )}
          {onSave && (
            <button
              type="button"
              onClick={isolate(onSave)}
              disabled={isLoading}
              aria-label={saved ? unsaveAriaLabel : saveAriaLabel}
              aria-pressed={saved}
              className={iconButtonClass}
            >
              <Bookmark
                size={15}
                className={saved ? classNames?.savedIcon : classNames?.icon}
              />
            </button>
          )}
        </div>
      )}

      {children}

      {onDonate && (
        <button
          type="button"
          onClick={isolate(onDonate)}
          disabled={donateDisabled || isLoading}
          aria-label={donateAriaLabel}
          aria-busy={isLoading || undefined}
          className={donateClass}
        >
          {donateLabel}
        </button>
      )}
    </div>
  );
}
