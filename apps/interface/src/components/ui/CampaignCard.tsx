"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { Bookmark, GitCompare, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import { formatXlm } from "@/lib/price";
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

function Highlight({ text, query }: { text: string; query?: string }) {
  if (!query) return <>{text}</>;
  const regex = new RegExp(
    `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
    "gi",
  );
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? (
          <mark
            key={i}
            className="bg-yellow-200 dark:bg-yellow-700 text-inherit rounded px-0.5"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function StatusBadge({
  status,
  label,
}: {
  status: "funded" | "ended";
  label: string;
}) {
  const icon = status === "funded" ? "✓" : "⏰";
  return (
    <span
      className={cn(
        "absolute top-3 left-3 px-2 py-0.5 rounded-full text-xs font-semibold",
        status === "funded"
          ? "bg-[var(--color-success)]/90 text-white"
          : "bg-[var(--color-surface-elevated)]/90 text-[var(--color-text-secondary)]",
      )}
    >
      <span aria-hidden="true" className="mr-1">
        {icon}
      </span>
      {label}
    </span>
  );
}

function CategoryBadge({ slug }: { slug?: string }) {
  const cat = getCategoryBySlug(slug);
  if (!cat) return null;
  return (
    <span className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-black/60 text-white backdrop-blur-sm">
      {cat.emoji} {cat.label}
    </span>
  );
}

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

  // Resolve image: use campaign.image if valid, otherwise deterministic fallback
  const fallbackSrc = getFallbackImage(campaign.id);
  const [imgSrc, setImgSrc] = React.useState<string>(
    isValidImageUri(campaign.image) ? campaign.image : fallbackSrc,
  );

  const { toggle: toggleCompare, isSelected, selected } = useComparison();
  const { toggle: toggleBookmark, isBookmarked } = useBookmarks();
  const compared = isSelected(campaign.id);
  const bookmarked = isBookmarked(campaign.id);
  const compareDisabled = !compared && selected.length >= 4;

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
      <div className="relative">
        <div className="relative w-full h-48 sm:h-48">
          <Image
            src={imgSrc}
            alt={`${campaign.title} - campaign header image`}
            fill
            className="object-cover"
            sizes={SIZES_CARD_THUMB}
            onError={() => setImgSrc(fallbackSrc)}
          />
        </div>
        {isFunded && <StatusBadge status="funded" label={t("funded")} />}
        {isEnded && <StatusBadge status="ended" label={t("ended")} />}
        {campaign.videoUrl && (
          <span className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/70 text-white text-xs px-2 py-0.5 rounded-full">
            ▶ {t("video")}
          </span>
        )}
        <CategoryBadge slug={campaign.category} />
        <div className="absolute top-10 right-3 flex gap-1">
          {onShare && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onShare(campaign.id, campaign.title);
              }}
              aria-label={t("shareCampaign")}
              className="p-2 rounded-full bg-[var(--color-surface)]/80 hover:bg-[var(--color-surface-elevated)] transition touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              <Share2 size={15} className="text-[var(--color-text-muted)]" />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleBookmark(campaign.id);
            }}
            aria-label={
              bookmarked ? t("removeBookmark") : t("bookmarkCampaign")
            }
            className="p-2 rounded-full bg-[var(--color-surface)]/80 hover:bg-[var(--color-surface-elevated)] transition touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
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
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-3">
        <h2 className="text-base sm:text-lg font-semibold text-[var(--color-text-primary)]">
          <Highlight text={campaign.title} query={query} />
        </h2>
        <p className="text-[var(--color-text-secondary)] text-sm line-clamp-2">
          <Highlight text={campaign.description} query={query} />
        </p>
        <ProgressBar progress={progress} />
        <div className="flex justify-between text-sm text-[var(--color-text-secondary)]">
          <span>
            {formatXlm(campaign.raised, xlmPrice)} {t("raised")}
          </span>
          <span>
            {formatXlm(campaign.goal, xlmPrice)} {t("goal")}
          </span>
        </div>
        <CountdownTimer deadline={campaign.deadline} />
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
          <span className="text-[var(--color-text-muted)]">{t("compare")}</span>
        </label>
        <button
          className="ds-btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
          onClick={() => onPledge?.(campaign.id)}
          disabled={isDisabled}
          aria-label={
            isFunded
              ? t("fundedAriaLabel", { title: campaign.title })
              : isEnded
                ? t("endedAriaLabel", { title: campaign.title })
                : t("pledgeAriaLabel", { title: campaign.title })
          }
        >
          {isFunded
            ? t("successfullyFunded")
            : isEnded
              ? t("campaignEnded")
              : t("pledgeNow")}
        </button>
      </div>
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
