export function calculateCampaignProgress(
  raised: number,
  goal: number,
): number {
  return goal > 0 ? (raised / goal) * 100 : 0;
}

export function calculateIsEnded(deadline: string, isFunded: boolean): boolean {
  return !isFunded && new Date(deadline) < new Date();
}
