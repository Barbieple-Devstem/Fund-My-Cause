/**
 * uiSlice — transient UI state: notifications, modals, and theme.
 *
 * Re-exports the three individual UI stores under a single "slice" namespace
 * and adds named selectors for each domain.
 *
 * Sub-domains:
 *   • Notifications  (useNotificationStore)
 *   • Modals         (useModalStore)
 *   • Theme          (useThemeStore)
 */

// ── Notifications ─────────────────────────────────────────────────────────────

export {
  useNotificationStore,
  type Notification,
  type NotificationType,
  type NotificationStoreState,
} from "./useNotificationStore";

import type { NotificationStoreState } from "./useNotificationStore";

/** Returns all notifications, newest first. */
export const selectNotifications = (s: NotificationStoreState) =>
  s.notifications;

/** Returns the count of unread notifications. */
export const selectUnreadCount = (s: NotificationStoreState) => s.unreadCount;

/** Returns true when there is at least one unread notification. */
export const selectHasUnread = (s: NotificationStoreState) => s.unreadCount > 0;

// ── Modals ────────────────────────────────────────────────────────────────────

export {
  useModalStore,
  type ModalConfig,
  type ModalStoreState,
} from "./useModalStore";

import type { ModalStoreState } from "./useModalStore";

/** Returns the ordered modal stack (first = bottom, last = top). */
export const selectModalStack = (s: ModalStoreState) => s.stack;

/** Returns true when at least one modal is open. */
export const selectHasOpenModal = (s: ModalStoreState) => s.stack.length > 0;

/** Returns the top-most modal, or null when the stack is empty. */
export const selectTopModal = (s: ModalStoreState) =>
  s.stack.length > 0 ? s.stack[s.stack.length - 1] : null;

// ── Theme ─────────────────────────────────────────────────────────────────────

export {
  useThemeStore,
  type Theme,
  type ThemeStoreState,
} from "./useThemeStore";

import type { ThemeStoreState } from "./useThemeStore";

/** Returns the current theme. */
export const selectTheme = (s: ThemeStoreState) => s.theme;

/** Returns true when the dark theme is active. */
export const selectIsDarkTheme = (s: ThemeStoreState) => s.theme === "dark";
