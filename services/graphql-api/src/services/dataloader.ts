import DataLoader from "dataloader";
import type { ContractService } from "./contract.js";
import type { Campaign, Contribution, User, Contributor, CampaignUpdate, Milestone, CampaignStatus, DataLoaders } from "../types.js";

/**
 * Create DataLoader instances for batch loading
 */
export function createDataLoaders(contractService: ContractService): DataLoaders {
  return {
    // Load single campaign by ID
    campaigns: new DataLoader<string, Campaign | null>(async (ids) => {
      return Promise.all(ids.map((id) => contractService.getCampaign(id)));
    }),

    // Load single contribution by ID
    contributions: new DataLoader<string, Contribution | null>(async (_ids) => {
      return _ids.map((_id) => null);
    }),

    // Load single user by address
    users: new DataLoader<string, User | null>(async (addresses) => {
      return Promise.all(addresses.map((addr) => contractService.getUser(addr)));
    }),

    // Load all contributors for a campaign
    campaignContributors: new DataLoader<string, Contributor[]>(async (campaignIds) => {
      return campaignIds.map((_id) => []);
    }),

    // Load all contributions for a campaign
    campaignContributions: new DataLoader<string, Contribution[]>(async (campaignIds) => {
      return campaignIds.map((_id) => []);
    }),

    // Load campaign updates
    campaignUpdates: new DataLoader<string, CampaignUpdate[]>(async (campaignIds) => {
      return campaignIds.map((_id) => []);
    }),

    // Load campaign milestones
    campaignMilestones: new DataLoader<string, Milestone[]>(async (campaignIds) => {
      return campaignIds.map((_id) => []);
    }),

    // Load campaigns by status
    campaignsByStatus: new DataLoader<
      { status: CampaignStatus; limit: number },
      Campaign[]
    >(async (keys) => {
      return Promise.all(
        keys.map(async ({ status, limit }) => {
          const all = await contractService.getCampaigns({
            filter: { status: [status] },
            pagination: { offset: 0, limit },
          });
          return all.slice(0, limit);
        }),
      );
    }),

    // Load campaigns created by user
    userCampaigns: new DataLoader<string, Campaign[]>(async (addresses) => {
      if (!contractService.registryContractId) return addresses.map(() => []);
      return Promise.all(
        addresses.map(async (address) => {
          const all = await contractService.getCampaigns({
            pagination: { offset: 0, limit: 1000 },
          });
          return all.filter((c) => c.creator === address);
        }),
      );
    }),

    // Load contributions by user
    userContributions: new DataLoader<string, Contribution[]>(async (addresses) => {
      return addresses.map((_address) => []);
    }),
  };
}
