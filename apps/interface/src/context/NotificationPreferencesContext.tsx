"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import type { NotificationType } from "@/store/useNotificationStore";

export interface NotificationPreferences {
  categories: Record<NotificationType, boolean>;
  channels: {
    inApp: boolean;
    browserPush: boolean;
  };
}

const DEFAULTS: NotificationPreferences = {
  categories: {
    contribution: true,
    goal_reached: true,
    deadline: true,
    info: true,
  },
  channels: {
    inApp: true,
    browserPush: false,
  },
};

interface PrefsContextType {
  prefs: NotificationPreferences;
  setCategoryEnabled: (type: NotificationType, enabled: boolean) => void;
  setChannelEnabled: (
    channel: keyof NotificationPreferences["channels"],
    enabled: boolean,
  ) => void;
  isCategoryEnabled: (type: NotificationType) => boolean;
}

const PrefsContext = createContext<PrefsContextType | null>(null);

export function NotificationPreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [prefs, setPrefs] = useLocalStorage<NotificationPreferences>(
    "fmc:notif-prefs",
    DEFAULTS,
  );

  const setCategoryEnabled = (type: NotificationType, enabled: boolean) => {
    setPrefs((p) => ({
      ...p,
      categories: { ...p.categories, [type]: enabled },
    }));
  };

  const setChannelEnabled = (
    channel: keyof NotificationPreferences["channels"],
    enabled: boolean,
  ) => {
    setPrefs((p) => ({
      ...p,
      channels: { ...p.channels, [channel]: enabled },
    }));
  };

  const isCategoryEnabled = (type: NotificationType) =>
    prefs.categories[type] ?? true;

  return (
    <PrefsContext.Provider
      value={{
        prefs,
        setCategoryEnabled,
        setChannelEnabled,
        isCategoryEnabled,
      }}
    >
      {children}
    </PrefsContext.Provider>
  );
}

export function useNotificationPreferences() {
  const ctx = useContext(PrefsContext);
  if (!ctx)
    throw new Error(
      "useNotificationPreferences must be used within NotificationPreferencesProvider",
    );
  return ctx;
}
