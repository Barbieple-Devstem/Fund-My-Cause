"use client";

import React from "react";
import { Navbar } from "@/components/layout/Navbar";
import { useNotificationPreferences } from "@/context/NotificationPreferencesContext";
import { useCurrency, FIAT_CURRENCIES } from "@/context/CurrencyContext";
import type { NotificationType } from "@/store/useNotificationStore";

const CATEGORIES: {
  type: NotificationType;
  label: string;
  description: string;
}[] = [
  {
    type: "contribution",
    label: "Campaign Updates",
    description: "Notify when contributions are made to campaigns you follow.",
  },
  {
    type: "goal_reached",
    label: "Milestones",
    description: "Notify when a campaign reaches its funding goal.",
  },
  {
    type: "deadline",
    label: "Deadline Reminders",
    description: "Notify when campaigns are approaching their deadline.",
  },
  {
    type: "info",
    label: "Comments & Info",
    description: "General notifications and new comments.",
  },
];

function Toggle({
  enabled,
  onChange,
  label,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${enabled ? "bg-indigo-600" : "bg-gray-600"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}

export default function SettingsPage() {
  const { prefs, setCategoryEnabled, setChannelEnabled } =
    useNotificationPreferences();
  const { currency, setCurrency } = useCurrency();

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <Navbar />
      <div className="max-w-2xl mx-auto px-6 py-12 space-y-10">
        <h1 className="text-2xl font-bold">Settings</h1>

        {/* Currency Selector */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            Display Currency
          </h2>
          <div className="rounded-2xl border border-gray-800 bg-gray-900 px-5 py-4">
            <p className="text-sm text-gray-400 mb-3">
              Choose how fiat equivalents are displayed across the app. Hover
              any amount to see the original XLM value.
            </p>
            <div className="flex flex-wrap gap-2">
              {FIAT_CURRENCIES.map(({ code, symbol }) => (
                <button
                  key={code}
                  onClick={() => setCurrency(code)}
                  aria-pressed={currency === code}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition border ${
                    currency === code
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {symbol} {code}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Category toggles */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            Notification Categories
          </h2>
          <div className="rounded-2xl border border-gray-800 bg-gray-900 divide-y divide-gray-800">
            {CATEGORIES.map(({ type, label, description }) => (
              <div
                key={type}
                className="flex items-center justify-between px-5 py-4 gap-4"
              >
                <div>
                  <p className="font-medium text-white">{label}</p>
                  <p className="text-sm text-gray-400 mt-0.5">{description}</p>
                </div>
                <Toggle
                  enabled={prefs.categories[type]}
                  onChange={(v) => setCategoryEnabled(type, v)}
                  label={`Toggle ${label}`}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Channel toggles */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            Notification Channels
          </h2>
          <div className="rounded-2xl border border-gray-800 bg-gray-900 divide-y divide-gray-800">
            <div className="flex items-center justify-between px-5 py-4 gap-4">
              <div>
                <p className="font-medium text-white">In-App</p>
                <p className="text-sm text-gray-400 mt-0.5">
                  Show notifications in the notification dropdown.
                </p>
              </div>
              <Toggle
                enabled={prefs.channels.inApp}
                onChange={(v) => setChannelEnabled("inApp", v)}
                label="Toggle in-app notifications"
              />
            </div>
            <div className="flex items-center justify-between px-5 py-4 gap-4">
              <div>
                <p className="font-medium text-white">Browser Push</p>
                <p className="text-sm text-gray-400 mt-0.5">
                  Receive push notifications in your browser (requires
                  permission).
                </p>
              </div>
              <Toggle
                enabled={prefs.channels.browserPush}
                onChange={(v) => setChannelEnabled("browserPush", v)}
                label="Toggle browser push notifications"
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
