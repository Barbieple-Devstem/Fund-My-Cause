"use client";

import React from "react";
import { Download, ExternalLink, X, CheckCircle } from "lucide-react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useFocusTrap } from "@/hooks/useFocusTrap";

export interface ContributionReceipt {
  campaignTitle: string;
  amount: number;
  txHash: string;
  timestamp: Date;
  contractId: string;
  contributorAddress: string;
}

interface ReceiptModalProps {
  receipt: ContributionReceipt;
  onClose: () => void;
  explorerUrl?: (txHash: string) => string;
}

export function ReceiptModal({
  receipt,
  onClose,
  explorerUrl = (hash) => `https://testnet.stellarexpert.com/tx/${hash}`,
}: ReceiptModalProps) {
  const receiptRef = React.useRef<HTMLDivElement>(null);
  const dialogRef = useFocusTrap(true, {
    onEscape: onClose,
  }) as React.RefObject<HTMLDivElement>;

  const downloadPDF = async () => {
    if (!receiptRef.current) return;

    try {
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });

      const pdf = new jsPDF("p", "mm", "a4");
      const imgData = canvas.toDataURL("image/png");
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
      pdf.save(`contribution-receipt-${receipt.txHash.slice(0, 8)}.pdf`);
    } catch (error) {
      console.error("Failed to generate PDF:", error);
    }
  };

  const downloadPNG = async () => {
    if (!receiptRef.current) return;

    try {
      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
      });

      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `contribution-receipt-${receipt.txHash.slice(0, 8)}.png`;
      link.click();
    } catch (error) {
      console.error("Failed to generate PNG:", error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="receipt-modal-title"
        className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg dark:bg-gray-900"
      >
        {/* Header */}
        <div className="mb-6 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <h2
              id="receipt-modal-title"
              className="text-xl font-bold text-gray-900 dark:text-white"
            >
              Contribution Receipt
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close receipt"
            className="rounded-lg p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X
              className="h-5 w-5 text-gray-600 dark:text-gray-400"
              aria-hidden="true"
            />
          </button>
        </div>

        {/* Printable Receipt Content */}
        <div
          ref={receiptRef}
          className="mb-6 space-y-4 rounded-lg border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800"
        >
          <div className="space-y-1">
            <p className="text-sm text-gray-600 dark:text-gray-400">Campaign</p>
            <p className="font-medium text-gray-900 dark:text-white">
              {receipt.campaignTitle}
            </p>
          </div>

          <div className="h-px bg-gray-200 dark:bg-gray-700" />

          <div className="space-y-1">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Amount Contributed
            </p>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {receipt.amount.toFixed(2)} XLM
            </p>
          </div>

          <div className="h-px bg-gray-200 dark:bg-gray-700" />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-gray-600 dark:text-gray-400">Date</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {receipt.timestamp.toLocaleDateString(undefined, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-gray-600 dark:text-gray-400">Time</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {receipt.timestamp.toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>

          <div className="h-px bg-gray-200 dark:bg-gray-700" />

          <div className="space-y-1">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Transaction Hash
            </p>
            <p className="break-all font-mono text-xs text-gray-900 dark:text-white">
              {receipt.txHash}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mb-4 flex flex-col gap-3">
          {/* Explorer Link */}
          <a
            href={explorerUrl(receipt.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View on Block Explorer (opens in new tab)"
            className="flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 font-medium text-indigo-600 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 dark:hover:bg-indigo-900"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            View on Block Explorer
          </a>

          {/* Download Options */}
          <div className="flex gap-2">
            <button
              onClick={downloadPDF}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
            >
              <Download className="h-4 w-4" />
              PDF
            </button>
            <button
              onClick={downloadPNG}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2 font-medium text-gray-900 hover:bg-gray-200 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-700"
            >
              <Download className="h-4 w-4" />
              PNG
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600"
        >
          Close
        </button>
      </div>
    </div>
  );
}
