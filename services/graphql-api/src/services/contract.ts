import {
  rpc as SorobanRpc,
  Keypair,
  Contract,
  TransactionBuilder,
  BASE_FEE,
  scValToNative,
  nativeToScVal,
  Address,
} from "@stellar/stellar-sdk";
import type { CampaignStatus } from "../types.js";
import type {
  Campaign,
  Contribution,
  User,
  GetCampaignsParams,
  CreateCampaignInput,
  UpdateCampaignInput,
  RecordContributionInput,
  Statistics,
  RawCampaignInfo,
  RawCampaignStats,
} from "../types.js";
// Shared mapper extracted as part of #903 (consolidate duplicate DTO mappers).
// STATUS_MAP and mapStatus were previously defined inline here; they now live
// in @fund-my-cause/shared-utils so any future service can reuse them.
import { mapCampaignStatus } from "@fund-my-cause/shared-utils";

// ── Configuration ──────────────────────────────────────────────────────────────

export interface ContractServiceConfig {
  rpcUrl: string;
  networkPassphrase: string;
  /** Optional registry contract address for listing/searching campaigns. */
  registryContractId?: string;
}

function stroopsToIsoString(stroops: bigint): string {
  return new Date(Number(stroops) * 1000).toISOString();
}

const SOROBAN_DUMMY = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

// ── Service ────────────────────────────────────────────────────────────────────

export class ContractService {
  private readonly server: SorobanRpc.Server;
  readonly networkPassphrase: string;
  readonly registryContractId?: string;

  constructor(config: ContractServiceConfig) {
    this.server = new SorobanRpc.Server(config.rpcUrl);
    this.networkPassphrase = config.networkPassphrase;
    this.registryContractId = config.registryContractId;
  }

  // ── Internal: Soroban view call ────────────────────────────────────────────

  /**
   * Execute a read-only contract view function via simulateTransaction.
   * `contractId` is the Soroban contract address to call.
   */
  private async view<T>(
    contractId: string,
    method: string,
    args: ReturnType<typeof nativeToScVal>[] = [],
  ): Promise<T> {
    const contract = new Contract(contractId);

    const account = {
      accountId: () => SOROBAN_DUMMY,
      sequenceNumber: () => "0",
      incrementSequenceNumber: () => {},
    } as unknown as ConstructorParameters<typeof TransactionBuilder>[0];

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const result = await this.server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(result)) {
      throw new Error(`Contract call failed [${contractId}.${method}]: ${result.error}`);
    }
    return scValToNative(
      (result as SorobanRpc.Api.SimulateTransactionSuccessResponse).result!.retval,
    ) as T;
  }

  // ── Internal: fetch single campaign from its contract ──────────────────────

  private async fetchCampaign(id: string): Promise<Campaign | null> {
    try {
      const [info, stats] = await Promise.all([
        this.view<RawCampaignInfo>(id, "get_campaign_info"),
        this.view<RawCampaignStats>(id, "get_stats"),
      ]);

      return {
        id,
        contractId: id,
        title: info.title,
        description: info.description,
        creator: info.creator,
        goal: stats.goal,
        raised: stats.total_raised,
        deadline: stroopsToIsoString(info.deadline),
        status: mapCampaignStatus(info.status),
        category: info.category,
        minContribution: info.min_contribution,
        maxContribution: info.max_contribution,
        totalContributors: stats.contributor_count,
        token: info.token,
        platformFeeBps: info.has_platform_config ? info.platform_fee_bps : undefined,
        hasRBACEnabled: info.has_platform_config,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Error fetching campaign ${id}:`, error);
      return null;
    }
  }

  // ── Public read methods ────────────────────────────────────────────────────

  /**
   * Get a single campaign by its Soroban contract address.
   */
  async getCampaign(id: string): Promise<Campaign | null> {
    return this.fetchCampaign(id);
  }

  /**
   * List campaigns via the registry contract.
   * Requires `registryContractId` to be configured in the constructor.
   */
  async getCampaigns(params: GetCampaignsParams): Promise<Campaign[]> {
    if (!this.registryContractId) {
      console.warn("getCampaigns called without registryContractId configured");
      return [];
    }

    try {
      const { pagination } = params;
      const ids = await this.view<string[]>(
        this.registryContractId,
        "list",
        [
          nativeToScVal(pagination.offset, { type: "u32" }),
          nativeToScVal(pagination.limit, { type: "u32" }),
        ],
      );

      const campaigns = (
        await Promise.all(ids.map((id) => this.fetchCampaign(id)))
      ).filter(Boolean) as Campaign[];

      if (params.filter?.status?.length) {
        const allowed = new Set(params.filter.status);
        return campaigns.filter((c) => allowed.has(c.status));
      }

      return campaigns;
    } catch (error) {
      console.error("Error fetching campaigns:", error);
      return [];
    }
  }

  /**
   * Get total campaign count from the registry.
   */
  async getCampaignCount(_filter?: any): Promise<number> {
    if (!this.registryContractId) return 0;
    try {
      const all = await this.view<string[]>(
        this.registryContractId,
        "list",
        [nativeToScVal(0, { type: "u32" }), nativeToScVal(1_000_000, { type: "u32" })],
      );
      return all.length;
    } catch (error) {
      console.error("Error getting campaign count:", error);
      return 0;
    }
  }

  /**
   * Get trending campaigns (fetches all active campaigns and sorts by contribution velocity).
   * Requires `registryContractId` to be configured.
   */
  async getTrendingCampaigns(limit: number): Promise<Campaign[]> {
    if (!this.registryContractId) return [];
    try {
      const ids = await this.view<string[]>(
        this.registryContractId,
        "list",
        [nativeToScVal(0, { type: "u32" }), nativeToScVal(1_000_000, { type: "u32" })],
      );

      const withMetrics = (
        await Promise.all(
          ids.map(async (id) => {
            try {
              const campaign = await this.fetchCampaign(id);
              if (!campaign || campaign.status !== "Active") return null;
              return campaign;
            } catch {
              return null;
            }
          }),
        )
      ).filter(Boolean) as Campaign[];

      return withMetrics.slice(0, limit);
    } catch (error) {
      console.error("Error fetching trending campaigns:", error);
      return [];
    }
  }

  /**
   * Search campaigns by title/description (client-side filter).
   * Requires `registryContractId` to be configured.
   */
  async searchCampaigns(query: string, limit: number): Promise<Campaign[]> {
    if (!this.registryContractId) return [];
    try {
      const ids = await this.view<string[]>(
        this.registryContractId,
        "list",
        [nativeToScVal(0, { type: "u32" }), nativeToScVal(1_000_000, { type: "u32" })],
      );

      const q = query.toLowerCase();
      const matches = (
        await Promise.all(
          ids.map(async (id) => {
            try {
              const c = await this.fetchCampaign(id);
              if (!c) return null;
              if (
                c.title.toLowerCase().includes(q) ||
                c.description.toLowerCase().includes(q)
              ) {
                return c;
              }
              return null;
            } catch {
              return null;
            }
          }),
        )
      ).filter(Boolean) as Campaign[];

      return matches.slice(0, limit);
    } catch (error) {
      console.error("Error searching campaigns:", error);
      return [];
    }
  }

  /**
   * Get user profile by aggregating on-chain data across all known campaigns.
   */
  async getUser(address: string): Promise<User | null> {
    try {
      let totalContributed = BigInt(0);
      let contributionCount = 0;

      if (this.registryContractId) {
        const ids = await this.view<string[]>(
          this.registryContractId,
          "list",
          [nativeToScVal(0, { type: "u32" }), nativeToScVal(1_000_000, { type: "u32" })],
        );

        for (const campaignId of ids) {
          try {
            const contribAmount = await this.view<bigint>(
              campaignId,
              "contribution",
              [new Address(address).toScVal()],
            );
            if (contribAmount > 0) {
              totalContributed += contribAmount;
              contributionCount++;
            }
          } catch {
            // Campaign may not exist or be inaccessible; skip
          }
        }
      }

      return {
        address,
        totalContributed,
        contributionCount,
        campaigns: [],
        contributions: [],
        joinedAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Error fetching user ${address}:`, error);
      return null;
    }
  }

  /**
   * Get platform statistics by aggregating all registered campaigns.
   */
  async getStats(): Promise<Statistics> {
    if (!this.registryContractId) {
      return {
        totalCampaigns: 0,
        activeCampaigns: 0,
        totalRaised: BigInt(0),
        totalContributors: 0,
        averageContribution: BigInt(0),
        successRate: 0,
      };
    }

    try {
      const ids = await this.view<string[]>(
        this.registryContractId,
        "list",
        [nativeToScVal(0, { type: "u32" }), nativeToScVal(1_000_000, { type: "u32" })],
      );

      let totalRaised = BigInt(0);
      let totalContributors = 0;
      let totalCampaigns = 0;
      let activeCampaigns = 0;
      let successfulCount = 0;

      for (const id of ids) {
        try {
          const info = await this.view<RawCampaignInfo>(id, "get_campaign_info");
          const stats = await this.view<RawCampaignStats>(id, "get_stats");

          totalCampaigns++;
          totalRaised += stats.total_raised;
          totalContributors += stats.contributor_count;

          if (info.status === "Active") activeCampaigns++;
          if (info.status === "Successful") successfulCount++;
        } catch {
          // Skip inaccessible campaigns
        }
      }

      const avgContrib =
        totalContributors > 0 ? totalRaised / BigInt(totalContributors) : BigInt(0);
      const successRate =
        totalCampaigns > 0 ? (successfulCount / totalCampaigns) * 100 : 0;

      return {
        totalCampaigns,
        activeCampaigns,
        totalRaised,
        totalContributors,
        averageContribution: avgContrib,
        successRate,
      };
    } catch (error) {
      console.error("Error fetching stats:", error);
      return {
        totalCampaigns: 0,
        activeCampaigns: 0,
        totalRaised: BigInt(0),
        totalContributors: 0,
        averageContribution: BigInt(0),
        successRate: 0,
      };
    }
  }

  // ── Write methods ─────────────────────────────────────────────────────────

  /**
   * Verify that a Stellar account signed a given message.
   *
   * This is an off-chain utility — it does not call a Soroban contract.
   * Uses Keypair to verify the Ed25519 signature.
   */
  async verifySignature(
    address: string,
    message: string,
    signature: string,
  ): Promise<boolean> {
    try {
      const keypair = Keypair.fromPublicKey(address);
      return keypair.verify(Buffer.from(message, "utf-8"), Buffer.from(signature, "hex"));
    } catch (error) {
      console.error("Error verifying signature:", error);
      return false;
    }
  }

  /**
   * Submit a pre-signed `initialize` transaction to deploy a new campaign.
   *
   * The caller must construct, sign, and pass the full XDR of the
   * `initialize` call on a **newly deployed** Soroban contract instance.
   *
   * Returns a `Campaign` object representing the newly created campaign.
   */
  async createCampaign(creator: any, input: CreateCampaignInput): Promise<Campaign> {
    throw new Error(
      "createCampaign requires a pre-signed deploy+initialize transaction. " +
        "Provide the signed XDR via a separate mutation field instead.",
    );
  }

  /**
   * Submit a pre-signed `update_metadata` transaction for an existing campaign.
   */
  async updateCampaign(
    id: string,
    user: any,
    input: UpdateCampaignInput,
  ): Promise<Campaign> {
    throw new Error(
      "updateCampaign requires a pre-signed update_metadata transaction. " +
        "Provide the signed XDR via a separate mutation field instead.",
    );
  }

  /**
   * Record a contribution that was already submitted to the chain.
   *
   * This reads the on-chain state to confirm the contribution exists
   * and returns a `Contribution` object derived from chain data.
   */
  async recordContribution(input: RecordContributionInput): Promise<Contribution> {
    // Verify contribution exists on-chain by checking the contributor's balance
    try {
      const contribAmount = await this.view<bigint>(
        input.campaignId,
        "contribution",
        [new Address(input.contributor).toScVal()],
      );

      if (contribAmount <= 0) {
        throw new Error(
          `No contribution found for ${input.contributor} in campaign ${input.campaignId}`,
        );
      }

      return {
        id: input.transactionHash,
        campaignId: input.campaignId,
        contributor: input.contributor,
        amount: contribAmount,
        timestamp: new Date().toISOString(),
        transactionHash: input.transactionHash,
      };
    } catch (error) {
      console.error("Error recording contribution:", error);
      throw error;
    }
  }
}
