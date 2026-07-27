import { create } from "zustand";

export type NotificationType =
  | "contribution"
  | "goal_reached"
  | "deadline"
  | "campaign_update"
  | "info";

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  campaignId?: string;
  timestamp: number;
  read: boolean;
}

export interface NotificationStoreState {
  notifications: Notification[];
  unreadCount: number;
  hydrate: () => void;
  addNotification: (n: Omit<Notification, "id" | "timestamp" | "read">) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearAll: () => void;
}

const STORAGE_KEY = "fmc:notifications";

function load(): Notification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(notifications: Notification[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
  } catch {}
}

function loadPrefs(): Record<NotificationType, boolean> {
  const defaults: Record<NotificationType, boolean> = {
    contribution: true,
    goal_reached: true,
    deadline: true,
    campaign_update: true,
    info: true,
  };
  try {
    const raw = localStorage.getItem("fmc:notif-prefs");
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return parsed?.categories ?? defaults;
  } catch {
    return defaults;
  }
}

function unreadCountOf(notifications: Notification[]): number {
  return notifications.filter((n) => !n.read).length;
}

export const useNotificationStore = create<NotificationStoreState>(
  (set, get) => ({
    notifications: [],
    unreadCount: 0,

    hydrate: () => {
      const notifications = load();
      set({ notifications, unreadCount: unreadCountOf(notifications) });
    },

    addNotification: (n) => {
      // Respect in-app category preferences
      const cats = loadPrefs();
      if (cats[n.type] === false) return;

      const entry: Notification = {
        ...n,
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        timestamp: Date.now(),
        read: false,
      };
      const next = [entry, ...get().notifications].slice(0, 50);
      save(next);
      set({ notifications: next, unreadCount: unreadCountOf(next) });
    },

    markAsRead: (id) => {
      const next = get().notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      );
      save(next);
      set({ notifications: next, unreadCount: unreadCountOf(next) });
    },

    markAllAsRead: () => {
      const next = get().notifications.map((n) => ({ ...n, read: true }));
      save(next);
      set({ notifications: next, unreadCount: 0 });
    },

    clearAll: () => {
      save([]);
      set({ notifications: [], unreadCount: 0 });
    },
  }),
);
