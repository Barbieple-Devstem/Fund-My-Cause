"use client";

import React from "react";
import { CampaignData } from "@/types/soroban";
import { useTheme } from "@/hooks/useTheme";

interface LineChartProps {
  campaigns: CampaignData[];
}

/** Theme-aware colour palette for LineChart. */
export function getLineChartPalette(theme: "dark" | "light") {
  return theme === "dark"
    ? {
        background: "bg-gray-900",
        border: "border-gray-800",
        title: "text-gray-300",
        legend: "text-gray-400",
        gridStroke: "#374151",
        lineStart: "#6366f1",
        lineEnd: "#8b5cf6",
        dotFill: "#6366f1",
        axisLabel: "#9ca3af",
      }
    : {
        background: "bg-white",
        border: "border-gray-200",
        title: "text-gray-700",
        legend: "text-gray-600",
        gridStroke: "#e5e7eb",
        lineStart: "#4f46e5",
        lineEnd: "#7c3aed",
        dotFill: "#4f46e5",
        axisLabel: "#6b7280",
      };
}

export function LineChart({ campaigns }: LineChartProps) {
  const { theme } = useTheme();
  const palette = getLineChartPalette(theme);

  if (campaigns.length === 0) return null;

  const dataPoints = campaigns.map((campaign) => ({
    label: campaign.title.substring(0, 15),
    value: campaign.raised,
    goal: campaign.goal,
    progress: campaign.goal > 0 ? (campaign.raised / campaign.goal) * 100 : 0,
  }));

  const gradientId = `line-gradient-${theme}`;

  return (
    <div
      className={`${palette.background} border ${palette.border} rounded-2xl p-5`}
    >
      <h3 className={`text-sm font-semibold ${palette.title} mb-4`}>
        Funding Progress Over Time
      </h3>

      <div className="relative h-48 w-full">
        <svg
          viewBox="0 0 400 150"
          className="w-full h-full"
          role="img"
          aria-label="Funding progress line chart"
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={palette.lineStart} />
              <stop offset="100%" stopColor={palette.lineEnd} />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((pct) => (
            <line
              key={pct}
              x1="0"
              y1={150 - (pct / 100) * 150}
              x2="400"
              y2={150 - (pct / 100) * 150}
              stroke={palette.gridStroke}
              strokeWidth="1"
              strokeDasharray="4"
            />
          ))}

          {/* Y-axis labels */}
          {[0, 50, 100].map((pct) => (
            <text
              key={pct}
              x="4"
              y={150 - (pct / 100) * 150 - 3}
              fontSize="10"
              fill={palette.axisLabel}
              aria-hidden="true"
            >
              {pct}%
            </text>
          ))}

          {/* Progress line */}
          <polyline
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="2"
            points={dataPoints
              .map((d, i) => {
                const x = (i / (dataPoints.length - 1 || 1)) * 400;
                const y = 150 - (d.progress / 100) * 150;
                return `${x},${y}`;
              })
              .join(" ")}
          />

          {/* Data points */}
          {dataPoints.map((d, i) => {
            const x = (i / (dataPoints.length - 1 || 1)) * 400;
            const y = 150 - (d.progress / 100) * 150;
            return (
              <circle
                key={i}
                cx={x}
                cy={y}
                r="4"
                fill={palette.dotFill}
                className="cursor-pointer"
              >
                <title>{`${d.label}: ${d.progress.toFixed(1)}%`}</title>
              </circle>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4">
        {dataPoints.slice(0, 5).map((d, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: palette.dotFill }}
            />
            <span className={`text-xs ${palette.legend}`}>{d.label}</span>
          </div>
        ))}
        {dataPoints.length > 5 && (
          <span className={`text-xs ${palette.legend} opacity-60`}>
            +{dataPoints.length - 5} more
          </span>
        )}
      </div>
    </div>
  );
}
