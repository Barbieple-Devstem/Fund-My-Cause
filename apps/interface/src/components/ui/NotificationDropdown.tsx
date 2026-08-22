"use client";

import React, { useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  Check,
  Trash2,
  Coins,
  Trophy,
  Clock,
  Info,
  Megaphone,
} from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import type {
  Notification,
  NotificationType,
} from "@/store/useNotificationStore";
import { useNotificationPreferences } from "@/context/NotificationPreferencesContext";

function typeIcon(type: NotificationType) {
  switch (type) {
    case "contribution":
      return <Coins size={14} className="text-indigo-400" />;
    case "goal_reached":
      return <Trophy size={14} className="text-green-400" />;
    case "deadline":
      return <Clock size={14} className="text-yellow-400" />;
    case "campaign_update":
      return <Megaphone size={14} className="text-purple-400" />;
    default:
      return <Info size={14} className="text-gray-400" />;
  }
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

interface Props {
  open: boolean;
  onClose: () => void;
}

export function NotificationDropdown({ open, onClose }: Props) {
  const { notifications, markAsRead, markAllAsRead, clearAll } =
    useNotifications();
  const { prefs } = useNotificationPreferences();
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  // All hooks above — safe to early-return now
  if (!prefs.channels.inApp || !open) return null;

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-xl z-50 overflow-hidden"
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
        <span className="font-semibold text-sm">Notifications</span>
        <div className="flex items-center gap-2">
          <button
            onClick={markAllAsRead}
            className="text-xs text-indigo-500 hover:text-indigo-400 transition flex items-center gap-1"
            aria-label="Mark all as read"
          >
            <Check size={12} /> All read
          </button>
          <button
            onClick={clearAll}
            className="text-xs text-gray-400 hover:text-red-400 transition"
            aria-label="Clear all notifications"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div className="max-h-80 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400 gap-2">
            <Bell size={24} />
            <p className="text-sm">No notifications yet</p>
          </div>
        ) : (
          notifications.map((n: Notification) => (
            <button
              key={n.id}
              onClick={() => {
                markAsRead(n.id);
                if (n.campaignId) {
                  router.push(`/campaigns/${n.campaignId}`);
                  onClose();
                }
              }}
              className={`w-full text-left px-4 py-3 flex gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition border-b border-gray-100 dark:border-gray-800 last:border-0 ${
                !n.read ? "bg-indigo-50 dark:bg-indigo-950/30" : ""
              }`}
            >
              <div className="mt-0.5 shrink-0">{typeIcon(n.type)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {n.title}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                  {n.message}
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {timeAgo(n.timestamp)}
                </p>
              </div>
              {!n.read && (
                <div className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
