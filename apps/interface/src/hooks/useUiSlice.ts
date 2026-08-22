/**
 * useUiSlice — scoped selector hooks for transient UI state.
 *
 * Covers three sub-domains:
 *   useUiSlice()        — all UI state (notifications + modals + theme)
 *   useNotifSlice()     — notification list and actions only
 *   useModalSlice()     — modal stack and actions only
 *   useThemeSlice()     — theme value and toggle only
 *
 * Usage:
 *   const { notifications, markAsRead } = useNotifSlice();
 *   const { openModal, closeModal }     = useModalSlice();
 *   const { theme, toggleTheme }        = useThemeSlice();
 */

"use client";

import { useShallow } from "zustand/react/shallow";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useModalStore } from "@/store/useModalStore";
import { useThemeStore } from "@/store/useThemeStore";
import type { NotificationStoreState } from "@/store/useNotificationStore";
import type { ModalStoreState } from "@/store/useModalStore";
import type { ThemeStoreState } from "@/store/useThemeStore";

// ── Notification sub-slice ────────────────────────────────────────────────────

/** Full notification state + actions. */
export function useNotifSlice(): NotificationStoreState {
  return useNotificationStore(
    useShallow((s) => ({
      notifications: s.notifications,
      unreadCount: s.unreadCount,
      hydrate: s.hydrate,
      addNotification: s.addNotification,
      markAsRead: s.markAsRead,
      markAllAsRead: s.markAllAsRead,
      clearAll: s.clearAll,
    })),
  );
}

// ── Modal sub-slice ───────────────────────────────────────────────────────────

/** Full modal state + actions. */
export function useModalSlice(): ModalStoreState {
  return useModalStore(
    useShallow((s) => ({
      stack: s.stack,
      counter: s.counter,
      openModal: s.openModal,
      closeModal: s.closeModal,
      closeAll: s.closeAll,
    })),
  );
}

// ── Theme sub-slice ───────────────────────────────────────────────────────────

/** Full theme state + actions. */
export function useThemeSlice(): ThemeStoreState {
  return useThemeStore(
    useShallow((s) => ({
      theme: s.theme,
      setTheme: s.setTheme,
      toggleTheme: s.toggleTheme,
    })),
  );
}

// ── Composite hook ────────────────────────────────────────────────────────────

/**
 * Returns a combined view of all UI sub-slices.
 * Prefer the narrower hooks above when a component only needs one sub-domain.
 */
export function useUiSlice() {
  const notif = useNotifSlice();
  const modal = useModalSlice();
  const themeState = useThemeSlice();
  return { ...notif, ...modal, ...themeState };
}
