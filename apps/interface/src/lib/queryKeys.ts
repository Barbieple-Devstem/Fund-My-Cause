export const QUERY_KEYS = {
  campaign: (contractId: string) => ["campaign", contractId] as const,
  campaignInfo: () => ["campaign-info"] as const,
  comments: (campaignId: string) => ["comments", campaignId] as const,
  leaderboard: (contractId: string, page: number, pageSize: number) =>
    ["leaderboard", contractId, page, pageSize] as const,
  achievements: (userAddress: string) => ["achievements", userAddress] as const,
  achievementProgress: (userAddress: string) =>
    ["achievement-progress", userAddress] as const,
  gamificationProfile: (userAddress: string) =>
    ["gamification-profile", userAddress] as const,
} as const;
