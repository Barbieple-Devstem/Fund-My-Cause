"use client";

import React from "react";
import { CampaignData } from "@/types/soroban";
import { useTheme } from "@/hooks/useTheme";

interface PieChartProps {
  campaigns: CampaignData[];
}

/** Theme-aware colour palette for PieChart. */
export function getPieChartPalette(theme: "dark" | "light") {
  return theme === "dark"
    ? {
        background: "bg-gray-900",
        border: "border-gray-800",
        title: "text-gray-300",
        label: "text-gray-300",
        count: "text-white",
        centerTotal: "text-white",
        centerLabel: "text-gray-400",
      }
    : {
        background: "bg-white",
        border: "border-gray-200",
        title: "text-gray-700",
        label: "text-gray-700",
        count: "text-gray-900",
        centerTotal: "text-gray-900",
        centerLabel: "text-gray-500",
      };
}

/** Status colours meet AA contrast against both dark and light backgrounds. */
const STATUS_COLORS: Record<string, string> = {
  Active: "#6366f1",
  Successful: "#10b981",
  Cancelled: "#ef4444",
  Refunded: "#f59e0b",
  Paused: "#6b7280",
};

export function PieChart({ campaigns }: PieChartProps) {
  const { theme } = useTheme();
  const palette = getPieChartPalette(theme);

  if (campaigns.length === 0) return null;

  const statusGroups = campaigns.reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  const total = campaigns.length;
  const data = Object.entries(statusGroups).map(([status, count]) => ({
    status,
    count,
    percentage: (count / total) * 100,
  }));

  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;

  return (
    <div
      className={`${palette.background} border ${palette.border} rounded-2xl p-5`}
    >
      <h3 className={`text-sm font-semibold ${palette.title} mb-4`}>
        Campaign Status Distribution
      </h3>

      <div className="flex items-center gap-8">
        {/* Pie Chart */}
        <div
          className="relative"
          role="img"
          aria-label={`Pie chart: ${data.map((d) => `${d.status} ${d.count}`).join(", ")}`}
        >
          <svg width="140" height="140" viewBox="0 0 140 140">
            {data.map((item) => {
              const strokeDasharray = (item.percentage / 100) * circumference;
              const strokeDashoffset = -currentOffset;
              currentOffset += strokeDasharray;
              return (
                <circle
                  key={item.status}
                  cx="70"
                  cy="70"
                  r={radius}
                  fill="none"
                  stroke={STATUS_COLORS[item.status] ?? "#6b7280"}
                  strokeWidth="20"
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  transform="rotate(-90 70 70)"
                />
              );
            })}
          </svg>

          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className={`text-2xl font-bold ${palette.centerTotal}`}>
                {total}
              </p>
              <p className={`text-xs ${palette.centerLabel}`}>Total</p>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex-1 space-y-2">
          {data.map((item) => (
            <div
              key={item.status}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{
                    backgroundColor: STATUS_COLORS[item.status] ?? "#6b7280",
                  }}
                  aria-hidden="true"
                />
                <span className={`text-sm ${palette.label}`}>
                  {item.status}
                </span>
              </div>
              <span className={`text-sm font-medium ${palette.count}`}>
                {item.count} ({item.percentage.toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
