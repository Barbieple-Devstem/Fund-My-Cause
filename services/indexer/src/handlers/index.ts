/**
 * Domain event handlers for the indexer service (#896).
 *
 * Re-exports all handler classes, the dispatcher, and the shared interface
 * so the indexer entry point (`src/index.ts`) can import everything from a
 * single path.
 */
export { CampaignHandler } from "./campaign.handler.js";
export { DonationHandler } from "./donation.handler.js";
export { AchievementHandler } from "./achievement.handler.js";
export { EventDispatcher } from "./dispatcher.js";
export type { EventHandler } from "./types.js";
