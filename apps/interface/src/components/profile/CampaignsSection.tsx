"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, ExternalLink } from "lucide-react";
import { fetchAllCampaigns } from "@/lib/graphql/client";
import { formatCampaignDateShort } from "@/lib/campaignDateFormatting";
import type { CampaignData } from "@fund-my-cause/types";

interface CampaignsSectionProps {
  address: string;
  /** Called with the creator's campaigns once fetched, so parents can derive stats. */
  onCampaignsLoaded?: (campaigns: CampaignData[]) => void;
}

function CampaignCardRow({ campaign }: { campaign: CampaignData }) {
  const raisedXlm = campaign.raised;
  const goalXlm = campaign.goal;
  const progress = goalXlm > 0 ? Math.min(100, (raisedXlm / goalXlm) * 100) : 0;
  const deadline = formatCampaignDateShort(campaign.deadline);

  return (
    <Link
      href={`/campaigns/${campaign.contractId}`}
      className="block rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 hover:border-indigo-400 transition space-y-2"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">
          {campaign.title}
        </h3>
        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 shrink-0">
          {campaign.status}
        </span>
      </div>
      {/* Mini progress bar */}
      <div className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700">
        <div
          className="h-full rounded-full bg-indigo-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>
          {raisedXlm.toLocaleString(undefined, { maximumFractionDigits: 2 })} /{" "}
          {goalXlm.toLocaleString(undefined, { maximumFractionDigits: 2 })} XLM
        </span>
        <span className="flex items-center gap-1">
          <ExternalLink size={10} />
          Deadline: {deadline}
        </span>
      </div>
    </Link>
  );
}

/**
 * Fetches all campaigns and filters by creator address.
 */
export function CampaignsSection({
  address,
  onCampaignsLoaded,
}: CampaignsSectionProps) {
  const [campaigns, setCampaigns] = useState<CampaignData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!address) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    fetchAllCampaigns()
      .then((all) => {
        if (!cancelled) {
          const creatorCampaigns = all.filter((c) => c.creator === address);
          setCampaigns(creatorCampaigns);
          onCampaignsLoaded?.(creatorCampaigns);
        }
      })
      .catch(() => {
        // silently handle — show empty state
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    // onCampaignsLoaded omitted intentionally to prevent re-fetching loops on parent component re-renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  return (
    <section aria-labelledby="profile-campaigns-heading" className="space-y-3">
      <h2 id="profile-campaigns-heading" className="text-lg font-semibold">
        Campaigns Created
      </h2>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : campaigns.length === 0 ? (
        <p className="text-sm text-gray-500">No campaigns created yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {campaigns.map((c) => (
            <CampaignCardRow key={c.contractId} campaign={c} />
          ))}
        </div>
      )}
    </section>
  );
}
