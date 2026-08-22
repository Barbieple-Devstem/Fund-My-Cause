"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ProgressBar } from "@/components/ui/ProgressBar";
import type { Campaign } from "@/types/campaign";
import { SIZES_SMALL_THUMB } from "@/lib/imageOptimization";

interface CampaignRowProps {
  campaign: Campaign;
}

export function CampaignRow({ campaign }: CampaignRowProps) {
  const progress = campaign.goal > 0 ? (campaign.raised / campaign.goal) * 100 : 0;
  return (
    <Link
      href={`/campaigns/${campaign.id}`}
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-800/60 transition group"
    >
      <div className="relative w-14 h-14 rounded-lg overflow-hidden flex-shrink-0">
        <Image src={campaign.image ?? ""} alt={campaign.title} fill className="object-cover" sizes={SIZES_SMALL_THUMB} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white truncate group-hover:text-indigo-300 transition">
          {campaign.title}
        </p>
        <ProgressBar progress={progress} />
        <p className="text-xs text-gray-500 mt-0.5">{progress.toFixed(0)}% funded</p>
      </div>
    </Link>
  );
}
