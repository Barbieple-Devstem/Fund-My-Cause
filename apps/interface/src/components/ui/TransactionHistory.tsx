"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, Download, Loader2, Filter } from "lucide-react";
import {
  fetchTransactionHistory,
  type ContributionRecord,
} from "@/lib/graphql/client";
import {
  EmptyState,
  NoTransactionsIllustration,
} from "@/components/ui/EmptyState";
import { TransactionExportModal } from "@/components/ui/TransactionExportModal";
import {
  applyFilters,
  type ExportRecord,
  type DateRange,
} from "@/lib/exportTransactions";

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  contractId: string;
  /** Optional campaign title used in export filenames and PDF header. */
  campaignTitle?: string;
}

const network =
  process.env.NEXT_PUBLIC_NETWORK === "mainnet" ? "mainnet" : "testnet";
const STELLAR_EXPERT = `https://stellar.expert/explorer/${network}`;

function toExportRecord(
  r: ContributionRecord,
  contractId: string,
  campaignTitle: string,
): ExportRecord {
  return {
    txHash: r.txHash,
    contributor: r.contributor,
    amountXlm: r.amountXlm,
    timestamp: r.timestamp,
    campaignId: contractId,
    campaignTitle,
    status: "Confirmed",
  };
}

export function TransactionHistory({
  contractId,
  campaignTitle = "Campaign",
}: Props) {
  const [records, setRecords] = useState<ContributionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showExport, setShowExport] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Filter state
  const [typeFilter, setTypeFilter] = useState("");
  const [dateRange, setDateRange] = useState<DateRange>({ from: "", to: "" });
  const [campaignFilter, setCampaignFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchTransactionHistory(contractId, 0)
      .then((data) => {
        if (!cancelled) setRecords(data);
      })
      .catch(() => {
        if (!cancelled) setRecords([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [contractId]);

  const allExportRecords = useMemo(
    () => records.map((r) => toExportRecord(r, contractId, campaignTitle)),
    [records, contractId, campaignTitle],
  );

  const campaignIds = useMemo(
    () => Array.from(new Set(allExportRecords.map((r) => r.campaignId))),
    [allExportRecords],
  );

  const filteredRecords = useMemo(
    () =>
      applyFilters(allExportRecords, {
        dateRange,
        type: typeFilter,
        campaignId: campaignFilter,
      }),
    [allExportRecords, dateRange, typeFilter, campaignFilter],
  );

  const viewAllUrl = `${STELLAR_EXPERT}/contract/${contractId}`;
  const displayRecords = filteredRecords.slice(0, 10);
  const isFiltered =
    typeFilter !== "" ||
    dateRange.from !== "" ||
    dateRange.to !== "" ||
    campaignFilter !== "";

  if (loading) {
    return (
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          Recent Contributions
        </h2>
        <div className="flex justify-center py-8">
          <Loader2 size={24} className="animate-spin text-indigo-400" />
        </div>
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">
          Recent Contributions
        </h2>
        <EmptyState
          illustration={<NoTransactionsIllustration />}
          title="No contributions yet"
          description="Be the first to pledge and help this campaign reach its goal."
        />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Header row */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">
            Recent Contributions
          </h2>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters((v: boolean) => !v)}
              aria-label="Toggle filters"
              aria-pressed={showFilters}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                isFiltered || showFilters
                  ? "bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              <Filter size={12} />
              Filters{isFiltered ? " ●" : ""}
            </button>

            <button
              onClick={() => setShowExport(true)}
              aria-label="Export transaction history"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                bg-gray-100 dark:bg-gray-800
                text-gray-600 dark:text-gray-400
                hover:bg-gray-200 dark:hover:bg-gray-700
                hover:text-gray-900 dark:hover:text-white
                transition"
            >
              <Download size={13} />
              Export
            </button>

            <a
              href={viewAllUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              View all
              <ExternalLink size={12} />
            </a>
          </div>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-3 p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-200 dark:border-gray-700">
            {/* Type filter */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">
                Type
              </label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className={inputCls}
                aria-label="Filter by type"
              >
                <option value="">All types</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Pending">Pending</option>
                <option value="Failed">Failed</option>
              </select>
            </div>

            {/* Date range */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">
                From
              </label>
              <input
                type="date"
                value={dateRange.from}
                onChange={(e) =>
                  setDateRange((p) => ({ ...p, from: e.target.value }))
                }
                className={inputCls}
                aria-label="Filter from date"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-500 dark:text-gray-400">
                To
              </label>
              <input
                type="date"
                value={dateRange.to}
                min={dateRange.from || undefined}
                onChange={(e) =>
                  setDateRange((p) => ({ ...p, to: e.target.value }))
                }
                className={inputCls}
                aria-label="Filter to date"
              />
            </div>

            {/* Campaign filter (shown when multiple campaigns could appear) */}
            {campaignIds.length > 1 && (
              <div className="flex flex-col gap-1">
                <label className="text-xs text-gray-500 dark:text-gray-400">
                  Campaign
                </label>
                <select
                  value={campaignFilter}
                  onChange={(e) => setCampaignFilter(e.target.value)}
                  className={inputCls}
                  aria-label="Filter by campaign"
                >
                  <option value="">All campaigns</option>
                  {campaignIds.map((id) => (
                    <option key={id} value={id}>
                      {id.slice(0, 8)}…
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Clear */}
            {isFiltered && (
              <button
                onClick={() => {
                  setTypeFilter("");
                  setDateRange({ from: "", to: "" });
                  setCampaignFilter("");
                }}
                className="self-end text-xs text-indigo-500 hover:underline"
              >
                Clear filters
              </button>
            )}
          </div>
        )}

        {isFiltered && (
          <p
            className="text-xs text-gray-400 dark:text-gray-500"
            aria-live="polite"
          >
            Showing {filteredRecords.length} of {records.length} contributions
          </p>
        )}

        {/* Table */}
        {filteredRecords.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
            No contributions match your filters.
          </p>
        ) : (
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wide">
                  <th className="px-4 py-2 text-left font-medium">
                    Contributor
                  </th>
                  <th className="px-4 py-2 text-right font-medium">Amount</th>
                  <th className="px-4 py-2 text-right font-medium">Date</th>
                  <th
                    className="px-4 py-2 text-right font-medium"
                    aria-label="View transaction link"
                  >
                    <span className="sr-only">Link</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {displayRecords.map((r) => (
                  <tr
                    key={r.txHash}
                    className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">
                      <span title={r.contributor}>
                        {truncate(r.contributor)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-white font-medium">
                      {r.amountXlm > 0
                        ? `${r.amountXlm.toLocaleString(undefined, { maximumFractionDigits: 7 })} XLM`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">
                      {formatDate(r.timestamp)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <a
                        href={`${STELLAR_EXPERT}/tx/${r.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="View transaction on Stellar Expert"
                        className="inline-flex items-center text-indigo-500 hover:text-indigo-400"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filteredRecords.length > 10 && (
          <p className="text-xs text-gray-400 dark:text-gray-500 text-right">
            Showing 10 of {filteredRecords.length} contributions.{" "}
            <button
              onClick={() => setShowExport(true)}
              className="text-indigo-500 hover:underline"
            >
              Export all
            </button>
          </p>
        )}
      </div>

      {showExport && (
        <TransactionExportModal
          records={filteredRecords}
          campaignTitle={campaignTitle}
          campaignId={contractId}
          onClose={() => setShowExport(false)}
        />
      )}
    </>
  );
}
