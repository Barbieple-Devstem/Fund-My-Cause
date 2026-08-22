"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Share2,
  Copy,
  CheckCircle,
  Gift,
  TrendingUp,
  Users,
  DollarSign,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  Referral,
  ReferralRewardTier,
  GamificationProfile,
} from "@/types/gamification";

interface ReferralProgramProps {
  userProfile?: GamificationProfile;
  referrals?: Referral[];
  rewardTiers?: ReferralRewardTier[];
  totalRewardsEarned?: number;
  onShare?: (platform: string) => void;
  onCopyCode?: (code: string) => void;
  loading?: boolean;
}

interface ReferralTierDisplayProps {
  tier: ReferralRewardTier;
  currentReferrals: number;
  isCurrentTier: boolean;
  isCompletedTier: boolean;
}

/**
 * Referral code display card with copy functionality
 */
function ReferralCodeCard({
  code,
  onCopy,
}: {
  code: string;
  onCopy?: (code: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    onCopy?.(code);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl p-6 shadow-lg"
    >
      <p className="text-sm opacity-90 mb-3">Your Referral Code</p>
      <div className="flex items-center gap-3">
        <code className="flex-1 font-mono text-2xl font-bold tracking-widest">
          {code}
        </code>
        <button
          onClick={handleCopy}
          className="p-3 bg-white/20 hover:bg-white/30 rounded-lg transition"
          title="Copy referral code"
        >
          {copied ? (
            <CheckCircle size={20} className="text-green-300" />
          ) : (
            <Copy size={20} />
          )}
        </button>
      </div>
    </motion.div>
  );
}

/**
 * Referral reward tier display
 */
function ReferralTierDisplay({
  tier,
  currentReferrals,
  isCurrentTier,
  isCompletedTier,
}: ReferralTierDisplayProps) {
  const progress = Math.min(100, (currentReferrals / tier.requiredReferrals) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "p-4 rounded-lg border-2 transition-all",
        isCurrentTier
          ? "border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20"
          : isCompletedTier
            ? "border-green-400 bg-green-50 dark:bg-green-900/20"
            : "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50",
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white">
            {tier.name}
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Refer {tier.requiredReferrals} people
          </p>
        </div>
        {isCompletedTier && (
          <CheckCircle className="w-5 h-5 text-green-500" />
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-600 dark:text-gray-400">Progress</span>
          <span className="font-semibold text-gray-900 dark:text-white">
            {currentReferrals}/{tier.requiredReferrals}
          </span>
        </div>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.8 }}
            className={cn(
              "h-full rounded-full",
              isCompletedTier
                ? "bg-green-500"
                : isCurrentTier
                  ? "bg-yellow-500"
                  : "bg-blue-500",
            )}
          />
        </div>
      </div>

      {/* Reward */}
      <div className="bg-white dark:bg-gray-900 rounded p-3">
        <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
          Reward per referral
        </p>
        <div className="flex items-center justify-between">
          <span className="font-bold text-lg text-gray-900 dark:text-white">
            {tier.bonus}x Bonus
          </span>
          <span className="text-sm font-semibold text-green-600 dark:text-green-400">
            +{(tier.rewardAmount / 1e7).toFixed(2)} XLM
          </span>
        </div>
      </div>
    </motion.div>
  );
}

/**
 * Referral item display
 */
function ReferralItem({ referral }: { referral: Referral }) {
  const isActive = referral.firstContributionAt !== undefined;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Users size={20} className="text-gray-400 flex-shrink-0" />
        <div className="min-w-0">
          <p className="font-mono text-sm text-gray-900 dark:text-white truncate">
            {referral.refereeAddress.slice(0, 10)}...
            {referral.refereeAddress.slice(-8)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {isActive ? "Active contributor" : "Awaiting contribution"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 ml-2">
        {isActive && (
          <div className="text-right">
            <div className="font-semibold text-green-600 dark:text-green-400">
              +{(referral.rewardAmount / 1e7).toFixed(2)} XLM
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Earned
            </div>
          </div>
        )}
        {referral.rewardClaimed ? (
          <CheckCircle size={20} className="text-green-500" />
        ) : (
          <Zap size={20} className="text-yellow-500" />
        )}
      </div>
    </motion.div>
  );
}

/**
 * Social share buttons
 */
function SocialShareButtons({
  referralCode,
  onShare,
}: {
  referralCode: string;
  onShare?: (platform: string) => void;
}) {
  const socialPlatforms = [
    {
      name: "Twitter",
      icon: "𝕏",
      color: "bg-gray-900 hover:bg-gray-800",
      message: `Check out Fund My Cause! Use my referral code ${referralCode} and earn rewards together. 🚀 #FundMyCause #Web3`,
    },
    {
      name: "Facebook",
      icon: "f",
      color: "bg-blue-600 hover:bg-blue-700",
      message: `Join Fund My Cause using my referral code: ${referralCode}`,
    },
    {
      name: "LinkedIn",
      icon: "in",
      color: "bg-blue-700 hover:bg-blue-800",
      message: `Discover Fund My Cause - supporting innovative projects. Referral code: ${referralCode}`,
    },
    {
      name: "Telegram",
      icon: "✈",
      color: "bg-blue-400 hover:bg-blue-500",
      message: `Fund My Cause - referral code: ${referralCode}`,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {socialPlatforms.map((platform) => (
        <button
          key={platform.name}
          onClick={() => onShare?.(platform.name)}
          className={cn(
            "p-4 rounded-lg text-white font-semibold text-sm transition-all hover:scale-105",
            platform.color,
          )}
          title={`Share on ${platform.name}`}
        >
          <div className="text-xl mb-1">{platform.icon}</div>
          <div>{platform.name}</div>
        </button>
      ))}
    </div>
  );
}

/**
 * Main Referral Program Component
 */
export function ReferralProgram({
  userProfile,
  referrals = [],
  rewardTiers = [],
  totalRewardsEarned = 0,
  onShare,
  onCopyCode,
  loading = false,
}: ReferralProgramProps) {
  const referralCode = userProfile?.referralCode || "";
  const referralsCount = userProfile?.referralsCount || 0;

  const activeReferrals = referrals.filter(
    (r) => r.firstContributionAt !== undefined
  );
  const pendingReferrals = referrals.filter(
    (r) => r.firstContributionAt === undefined
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Gift className="w-8 h-8 mx-auto mb-2 animate-bounce text-blue-500" />
          <p className="text-gray-500 dark:text-gray-400">
            Loading referral program...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Gift size={32} />
          <div>
            <h2 className="text-2xl font-bold">Referral Program</h2>
            <p className="text-sm opacity-90">
              Earn rewards by referring friends
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-white/20 rounded-lg p-3">
            <p className="text-xs opacity-75 mb-1">Referrals</p>
            <p className="text-2xl font-bold">{referralsCount}</p>
          </div>
          <div className="bg-white/20 rounded-lg p-3">
            <p className="text-xs opacity-75 mb-1">Active</p>
            <p className="text-2xl font-bold">{activeReferrals.length}</p>
          </div>
          <div className="bg-white/20 rounded-lg p-3">
            <p className="text-xs opacity-75 mb-1">Earned</p>
            <p className="text-2xl font-bold">
              {(totalRewardsEarned / 1e7).toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Referral code */}
      {referralCode && (
        <ReferralCodeCard code={referralCode} onCopy={onCopyCode} />
      )}

      {/* Social share */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Share with friends
        </h3>
        <SocialShareButtons referralCode={referralCode} onShare={onShare} />
      </div>

      {/* Reward tiers */}
      {rewardTiers.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Reward Tiers
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence mode="popLayout">
              {rewardTiers.map((tier, idx) => (
                <ReferralTierDisplay
                  key={tier.name}
                  tier={tier}
                  currentReferrals={referralsCount}
                  isCurrentTier={
                    referralsCount < tier.requiredReferrals &&
                    (idx === 0 ||
                      referralsCount >=
                        rewardTiers[idx - 1].requiredReferrals)
                  }
                  isCompletedTier={referralsCount >= tier.requiredReferrals}
                />
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Referrals list */}
      {referrals.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Your Referrals
            </h3>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {activeReferrals.length} active, {pendingReferrals.length} pending
            </span>
          </div>

          {/* Active referrals */}
          {activeReferrals.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                ✓ Active Referrals
              </p>
              <div className="space-y-2">
                <AnimatePresence>
                  {activeReferrals.map((referral) => (
                    <ReferralItem
                      key={referral.refereeAddress}
                      referral={referral}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Pending referrals */}
          {pendingReferrals.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-yellow-600 dark:text-yellow-400">
                ⏳ Awaiting Contribution
              </p>
              <div className="space-y-2">
                <AnimatePresence>
                  {pendingReferrals.map((referral) => (
                    <ReferralItem
                      key={referral.refereeAddress}
                      referral={referral}
                    />
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {referrals.length === 0 && (
        <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            No referrals yet
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500">
            Share your referral code to get started earning rewards!
          </p>
        </div>
      )}
    </div>
  );
}

export default ReferralProgram;
