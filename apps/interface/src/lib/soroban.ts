import {
  Address,
  BASE_FEE,
  Contract,
  Horizon,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc as SorobanRpc,
  xdr,
} from "@stellar/stellar-sdk";
import { isValidContractId } from "@/lib/validation";
import type { InitializeParams } from "@/types/soroban";

// Re-export types for backward compatibility
export type {
  CampaignStatus,
  CampaignInfo,
  CampaignStats,
  CampaignData,
  InitializeParams,
  PlatformConfig,
  StatusVariant,
  ContributionRecord,
} from "@/types/soroban";

const SOROBAN_RPC_URL =
  process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ??
  "https://soroban-testnet.stellar.org";
const RPC_URL = SOROBAN_RPC_URL;
const HORIZON_URL =
  process.env.NEXT_PUBLIC_HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

const CONTRACT_IDS: string[] = (
  process.env.NEXT_PUBLIC_CAMPAIGN_CONTRACT_IDS ?? ""
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

/**
 * Returns all known campaign contract IDs from environment variables.
 * Used for static site generation fallback.
 */
export function getStaticCampaignIds(): string[] {
  return [...CONTRACT_IDS];
}

// ── Transaction Building Pipeline (Client-Side) ──────────────────────────────

export async function buildInitializeTx(
  params: InitializeParams,
): Promise<string> {
  if (!isValidContractId(params.contractId)) {
    throw new Error(`Invalid contract ID format: ${params.contractId}`);
  }

  const server = new Horizon.Server(HORIZON_URL);
  const account = await server.loadAccount(params.creator);
  const contract = new Contract(params.contractId);

  const socialLinksVal =
    params.socialLinks && params.socialLinks.length > 0
      ? xdr.ScVal.scvVec(
          params.socialLinks.map((value) =>
            nativeToScVal(value, { type: "string" }),
          ),
        )
      : xdr.ScVal.scvVoid();

  const acceptedTokensVal =
    params.acceptedTokens && params.acceptedTokens.length > 0
      ? xdr.ScVal.scvVec(
          params.acceptedTokens.map((value) => new Address(value).toScVal()),
        )
      : xdr.ScVal.scvVoid();

  const platformConfigVal =
    params.platformFeeAddress && params.platformFeeBps !== undefined
      ? xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: nativeToScVal("address", { type: "symbol" }),
            val: new Address(params.platformFeeAddress).toScVal(),
          }),
          new xdr.ScMapEntry({
            key: nativeToScVal("fee_bps", { type: "symbol" }),
            val: nativeToScVal(params.platformFeeBps, { type: "u32" }),
          }),
        ])
      : xdr.ScVal.scvVoid();

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "initialize",
        new Address(params.creator).toScVal(),
        new Address(params.token).toScVal(),
        nativeToScVal(params.goal, { type: "i128" }),
        nativeToScVal(params.deadline, { type: "u64" }),
        nativeToScVal(params.minContribution, { type: "i128" }),
        nativeToScVal(params.title, { type: "string" }),
        nativeToScVal(params.description, { type: "string" }),
        socialLinksVal,
        platformConfigVal,
        acceptedTokensVal,
      ),
    )
    .setTimeout(30)
    .build();

  return tx.toXDR();
}

export const buildInitializeXdr = buildInitializeTx;

async function buildSimpleContractTx(
  caller: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<string> {
  const server = new Horizon.Server(HORIZON_URL);
  const account = await server.loadAccount(caller);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  return tx.toXDR();
}

export const buildWithdrawTx = (caller: string, contractId: string) =>
  buildSimpleContractTx(caller, contractId, "withdraw");
export const buildWithdrawXdr = buildWithdrawTx;

export const buildCancelTx = (
  caller: string,
  contractId: string,
  reason?: string,
) =>
  buildSimpleContractTx(
    caller,
    contractId,
    "cancel_campaign",
    reason ? [nativeToScVal(reason, { type: "string" })] : [],
  );
export const buildCancelCampaignXdr = buildCancelTx;

export const buildPauseTx = (caller: string, contractId: string) =>
  buildSimpleContractTx(caller, contractId, "pause");
export const buildPauseXdr = buildPauseTx;

export const buildUnpauseTx = (caller: string, contractId: string) =>
  buildSimpleContractTx(caller, contractId, "unpause");
export const buildUnpauseXdr = buildUnpauseTx;

export async function buildRefundTx(
  caller: string,
  contractId: string,
): Promise<string> {
  return buildSimpleContractTx(caller, contractId, "refund_single", [
    new Address(caller).toScVal(),
  ]);
}
export const buildRefundSingleXdr = buildRefundTx;

export async function buildUpdateMetadataTx(
  caller: string,
  contractId: string,
  title: string,
  description: string,
): Promise<string> {
  return buildSimpleContractTx(caller, contractId, "update_metadata", [
    nativeToScVal(title, { type: "string" }),
    nativeToScVal(description, { type: "string" }),
    xdr.ScVal.scvVoid(),
  ]);
}
export const buildUpdateMetadataXdr = buildUpdateMetadataTx;

/**
 * Build a contribute (pledge) transaction XDR.
 * @param caller  - contributor's Stellar address
 * @param contractId - campaign contract ID
 * @param amountXlm  - amount in XLM (converted to stroops internally)
 */
export async function buildContributeTx(
  caller: string,
  contractId: string,
  amountXlm: number,
): Promise<string> {
  const amountStroops = BigInt(Math.round(amountXlm * 1e7));
  return buildSimpleContractTx(caller, contractId, "contribute", [
    nativeToScVal(amountStroops, { type: "i128" }),
  ]);
}
export const buildContributeXdr = buildContributeTx;

// ── Simulation & Submission Pipeline ──────────────────────────────────────────

export interface SimulateResult {
  /** Minimum resource fee in stroops */
  minFee: number;
  /** Fee formatted as XLM string for display, e.g. "0.0001234 XLM" */
  minFeeXlm: string;
  /** Transaction XDR with the simulation-populated soroban data attached */
  preparedXdr: string;
}

/**
 * Simulate a transaction against the Soroban RPC before asking the user to sign.
 * - Estimates the resource fee
 * - Detects contract errors early (before the user touches Freighter)
 * - Returns the fee-bumped, simulation-prepared XDR ready for signing
 *
 * Throws a user-friendly Error if simulation fails.
 */
export async function simulateTx(unsignedXdr: string): Promise<SimulateResult> {
  const rpc = new SorobanRpc.Server(RPC_URL);

  const tx = TransactionBuilder.fromXDR(unsignedXdr, NETWORK_PASSPHRASE);
  const result = await rpc.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(result)) {
    const msg = result.error ?? "Simulation failed";
    throw new Error(parseSimulationError(msg));
  }

  if (SorobanRpc.Api.isSimulationRestore(result)) {
    throw new Error(
      "This transaction requires a ledger entry restore. Please try again shortly.",
    );
  }

  const success = result as SorobanRpc.Api.SimulateTransactionSuccessResponse;

  // Attach soroban auth + resource data to the transaction
  const prepared = SorobanRpc.assembleTransaction(tx, success).build();

  const minFee = Number(success.minResourceFee ?? 0);
  const minFeeXlm = (minFee / 1e7).toFixed(7).replace(/\.?0+$/, "") + " XLM";

  return { minFee, minFeeXlm, preparedXdr: prepared.toXDR() };
}
export const simulateTransaction = simulateTx;

/** Extract a readable message from a Soroban diagnostic error string. */
function parseSimulationError(raw: string): string {
  const contractMatch = raw.match(/ContractError\((\d+)\)/);
  if (contractMatch)
    return `Contract error code ${contractMatch[1]}. Please check your inputs.`;
  if (raw.includes("below minimum"))
    return "Amount is below the campaign's minimum contribution.";
  if (raw.includes("deadline")) return "This campaign's deadline has passed.";
  if (raw.includes("Cancelled")) return "This campaign has been cancelled.";
  return raw.split("\n")[0] ?? "Simulation failed. Please try again.";
}

export async function submitSignedTx(signedXdr: string): Promise<string> {
  const server = new Horizon.Server(HORIZON_URL);
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const result = await server.submitTransaction(tx);
  return result.hash;
}
export const submitSignedTransaction = submitSignedTx;
