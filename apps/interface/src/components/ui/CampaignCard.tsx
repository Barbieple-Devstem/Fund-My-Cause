"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { GitCompare } from "lucide-react";
import {
  CampaignActions,
  CampaignHeader,
  CampaignProgress,
} from "@fund-my-cause/components";
import {
  calculateProgress,
  formatXlmWithUsd,
  isCampaignEnded,
  isCampaignFunded,
} from "@fund-my-cause/shared-utils";
import { cn } from "@/lib/utils";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CountdownTimer } from "@/components/ui/CountdownTimer";
import type { Campaign } from "@/types/campaign";
import { useComparison } from "@/context/ComparisonContext";
import { useBookmarks } from "@/context/BookmarkContext";
import { getCategoryBySlug } from "@/lib/categories";
import { getFallbackImage, isValidImageUri } from "@/lib/imageValidation";
import { SIZES_CARD_THUMB } from "@/lib/imageOptimization";
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
export function CampaignCard({
  campaign,
  onPledge,
  onShare,
  xlmPrice = null,
  index = 0,
  query,
}: CampaignCardProps) {
  const t = useTranslations("campaignCard");
  const progress = calculateProgress(campaign.raised, campaign.goal);
  const isFunded = isCampaignFunded(campaign.raised, campaign.goal);
  const isEnded = isCampaignEnded(
    campaign.deadline,
    campaign.raised,
    campaign.goal,
  );
  const isDisabled = isFunded || isEnded;

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
        imageUrl={isValidImageUri(campaign.image) ? campaign.image : undefined}
        fallbackImageUrl={getFallbackImage(campaign.id)}
        imageAlt={`${campaign.title} - campaign header image`}
        renderImage={({ src, alt, onError }) => (
          <Image
            src={src}
            alt={alt}
            fill
            className="object-cover"
            sizes={SIZES_CARD_THUMB}
            onError={onError}
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
            />
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

        <CampaignActions
          unstyled
          className="space-y-3"
          onDonate={onPledge ? () => onPledge(campaign.id) : undefined}
          donateDisabled={isDisabled}
          donateAriaLabel={pledgeAriaLabel}
          donateLabel={
            isFunded
              ? t("successfullyFunded")
              : isEnded
                ? t("campaignEnded")
                : t("pledgeNow")
          }
          classNames={{
            donate:
              "ds-btn-primary w-full py-3 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation",
          }}
        >
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
        </CampaignActions>
      </CampaignHeader>
    </motion.div>
  );
}
