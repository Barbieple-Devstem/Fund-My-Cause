"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Bookmark, GitCompare, Share2 } from "lucide-react";
import {
  CampaignActions,
  CampaignHeader,
  CampaignProgress,
} from "@fund-my-cause/components";
import { formatXlmWithUsd } from "@fund-my-cause/shared-utils";
import { cn } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import type { Campaign } from "@/types/campaign";
import { useComparison } from "@/context/ComparisonContext";
import { useBookmarks } from "@/context/BookmarkContext";
import { getCategoryBySlug } from "@/lib/categories";
import { getFallbackImage, isValidImageUri } from "@/lib/imageValidation";
import { SIZES_CARD_THUMB } from "@/lib/imageOptimization";
import {
  calculateCampaignProgress,
  calculateIsEnded,
} from "@/lib/campaignProgress";
import { useTranslations } from "next-intl";
import {
  Highlight,
  StatusBadge,
  CategoryBadge,
} from "./campaign/CampaignCardBadges";

export interface CampaignCardProps {
  campaign: Campaign;
  onPledge?: (id: string) => void;
  onShare?: (id: string, title: string) => void;
  /** Pass null when price fetch failed — USD amounts are hidden */
  xlmPrice?: number | null;
  /** Stagger index for slide-up animation on listing page */
  index?: number;
  /** Search query for highlighting matching text */
  query?: string;
}

const ICON_BUTTON_CLS =
  "p-2 rounded-full bg-[var(--color-surface)]/80 hover:bg-[var(--color-surface-elevated)] transition touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center";

/**
 * Campaign card for listing, search, bookmark and dashboard views.
 *
 * The card is a composition shell: identity comes from `CampaignHeader`,
 * funding from `CampaignProgress` and controls from `CampaignActions`, all
 * from `@fund-my-cause/components`. Progress maths and amount formatting come
 * from `@fund-my-cause/shared-utils` — nothing is computed inline here.
 */
function CampaignCardComponent({
  campaign,
  onPledge,
  onShare,
  xlmPrice = null,
  index = 0,
  query,
}: CampaignCardProps) {
  const t = useTranslations("campaignCard");
  const progress = React.useMemo(
    () => calculateCampaignProgress(campaign.raised, campaign.goal),
    [campaign.raised, campaign.goal],
  );
  const isFunded = progress >= 100;
  const isEnded = React.useMemo(
    () => calculateIsEnded(campaign.deadline, isFunded),
    [campaign.deadline, isFunded],
  );
  const isDisabled = isFunded || isEnded;

  const fallbackSrc = getFallbackImage(campaign.id);
  // Fallback image resolution: track whether the image failed to load so
  // CampaignHeader's renderImage callback can fall back gracefully.
  const [imgError, setImgError] = React.useState(false);
  const resolvedImageUrl =
    !imgError && isValidImageUri(campaign.image) ? campaign.image : undefined;

  const { toggle: toggleCompare, isSelected, selected } = useComparison();
  const { toggle: toggleBookmark, isBookmarked } = useBookmarks();
  const compared = isSelected(campaign.id);
  const bookmarked = isBookmarked(campaign.id);
  const compareDisabled = !compared && selected.length >= 4;

  const pledgeAriaLabel = isFunded
    ? t("fundedAriaLabel", { title: campaign.title })
    : isEnded
      ? t("endedAriaLabel", { title: campaign.title })
      : t("pledgeAriaLabel", { title: campaign.title });

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.07, ease: "easeOut" }}
      whileHover={{
        scale: 1.02,
        boxShadow: "var(--shadow-card, 0 8px 32px rgba(0,0,0,0.25))",
      }}
      className="ds-card"
    >
      <CampaignHeader
        title={campaign.title}
        description={<Highlight text={campaign.description} query={query} />}
        renderTitle={(title) => <Highlight text={title} query={query} />}
        imageUrl={resolvedImageUrl}
        fallbackImageUrl={fallbackSrc}
        imageAlt={`${campaign.title} - campaign header image`}
        renderImage={({ src, alt, onError }) => (
          <Image
            src={src}
            alt={alt}
            fill
            className="object-cover"
            sizes={SIZES_CARD_THUMB}
            onError={() => {
              setImgError(true);
              onError?.();
            }}
          />
        )}
        classNames={{
          media: "relative w-full h-48 sm:h-48",
          body: "p-4 sm:p-5 space-y-3",
          title:
            "text-base sm:text-lg font-semibold text-[var(--color-text-primary)]",
          description:
            "text-[var(--color-text-secondary)] text-sm line-clamp-2",
        }}
        overlay={
          <>
            {isFunded && <StatusBadge status="funded" label={t("funded")} />}
            {isEnded && <StatusBadge status="ended" label={t("ended")} />}
            {campaign.videoUrl && (
              <span className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 text-white text-xs px-2 py-0.5 rounded-full">
                ▶ {t("video")}
              </span>
            )}
            <CategoryBadge slug={campaign.category} />
            <CampaignActions
              unstyled
              layout="inline"
              className="absolute top-10 right-3 flex gap-1"
              onShare={
                onShare ? () => onShare(campaign.id, campaign.title) : undefined
              }
              shareAriaLabel={t("shareCampaign")}
              onSave={() => toggleBookmark(campaign.id)}
              saved={bookmarked}
              saveAriaLabel={t("bookmarkCampaign")}
              unsaveAriaLabel={t("removeBookmark")}
              classNames={{
                iconButton: ICON_BUTTON_CLS,
                icon: "text-[var(--color-text-muted)]",
                savedIcon:
                  "fill-[var(--color-brand)] text-[var(--color-brand)]",
              }}
            >
              <button
                aria-label={t("shareCampaign")}
                className={ICON_BUTTON_CLS}
                onClick={(e) => {
                  e.stopPropagation();
                  onShare?.(campaign.id, campaign.title);
                }}
              >
                <Share2 size={15} className="text-[var(--color-text-muted)]" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleBookmark(campaign.id);
                }}
                aria-label={
                  bookmarked ? t("removeBookmark") : t("bookmarkCampaign")
                }
                className={ICON_BUTTON_CLS}
              >
                <Bookmark
                  size={15}
                  className={cn(
                    bookmarked
                      ? "fill-[var(--color-brand)] text-[var(--color-brand)]"
                      : "text-[var(--color-text-muted)]",
                  )}
                />
              </button>
            </CampaignActions>
          </>
        }
      >
        <CampaignProgress
          percent={progress}
          renderBar={({ percent }) => <ProgressBar progress={percent} />}
          raisedText={`${formatXlmWithUsd(campaign.raised, xlmPrice)} ${t("raised")}`}
          goalText={`${formatXlmWithUsd(campaign.goal, xlmPrice)} ${t("goal")}`}
          timeRemaining={<CountdownTimer deadline={campaign.deadline} />}
          classNames={{
            root: "space-y-3",
            amounts:
              "flex justify-between text-sm text-[var(--color-text-secondary)]",
          }}
        />
        <label
          className={cn(
            "flex items-center gap-2 text-xs cursor-pointer select-none touch-manipulation",
            compareDisabled && "opacity-40 cursor-not-allowed",
          )}
        >
          <input
            type="checkbox"
            checked={compared}
            disabled={compareDisabled}
            onChange={() => toggleCompare(campaign.id)}
            className="accent-[var(--color-brand)] w-4 h-4"
          />
          <GitCompare size={12} className="text-[var(--color-text-muted)]" />
          <span className="text-[var(--color-text-muted)]">
            {t("compare")}
          </span>
        </label>
        <button
          className="ds-btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          onClick={() => onPledge?.(campaign.id)}
          disabled={isDisabled}
          aria-label={pledgeAriaLabel}
        >
          {isFunded
            ? t("successfullyFunded")
            : isEnded
              ? t("campaignEnded")
              : t("pledgeNow")}
        </button>
      </CampaignHeader>
    </motion.div>
  );
}

// `onPledge`/`onShare` are recreated every parent render but are behaviorally
// stable (they just forward to a state setter), so they're excluded here —
// comparing them by reference would defeat the memoization on every list
// update even though nothing this card renders actually changed.
function campaignCardPropsAreEqual(
  prev: CampaignCardProps,
  next: CampaignCardProps,
): boolean {
  return (
    prev.campaign.id === next.campaign.id &&
    prev.campaign.title === next.campaign.title &&
    prev.campaign.description === next.campaign.description &&
    prev.campaign.image === next.campaign.image &&
    prev.campaign.raised === next.campaign.raised &&
    prev.campaign.goal === next.campaign.goal &&
    prev.campaign.deadline === next.campaign.deadline &&
    prev.campaign.category === next.campaign.category &&
    prev.campaign.videoUrl === next.campaign.videoUrl &&
    prev.campaign.contributorCount === next.campaign.contributorCount &&
    prev.xlmPrice === next.xlmPrice &&
    prev.index === next.index &&
    prev.query === next.query
  );
}

export const CampaignCard = React.memo(
  CampaignCardComponent,
  campaignCardPropsAreEqual,
);
