/**
 * Unit tests for uiSlice — notification, modal, and theme sub-stores
 * plus all named selectors.
 *
 * localStorage is mocked via jest-environment-jsdom's built-in implementation.
 */

import { useNotificationStore } from "../useNotificationStore";
import { useModalStore } from "../useModalStore";
import { useThemeStore } from "../useThemeStore";
import {
  selectNotifications,
  selectUnreadCount,
  selectHasUnread,
  selectModalStack,
  selectHasOpenModal,
  selectTopModal,
  selectTheme,
  selectIsDarkTheme,
} from "../uiSlice";

// ════════════════════════════════════════════════════════════════════════════
// Notification store
// ════════════════════════════════════════════════════════════════════════════

const NOTIF_INITIAL = useNotificationStore.getState();

beforeEach(() => {
  useNotificationStore.setState(NOTIF_INITIAL, true);
  localStorage.clear();
});

describe("useNotificationStore — addNotification", () => {
  it("adds a notification with a unique id and timestamp", () => {
    useNotificationStore.getState().addNotification({
      type: "info",
      title: "Hello",
      message: "World",
    });
    const { notifications } = useNotificationStore.getState();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].id).toBeTruthy();
    expect(notifications[0].read).toBe(false);
    expect(notifications[0].title).toBe("Hello");
  });

  it("caps the list at 50 notifications", () => {
    for (let i = 0; i < 55; i++) {
      useNotificationStore.getState().addNotification({
        type: "info",
        title: `N${i}`,
        message: "",
      });
    }
    expect(useNotificationStore.getState().notifications).toHaveLength(50);
  });

  it("increments unreadCount on each addition", () => {
    useNotificationStore.getState().addNotification({
      type: "info",
      title: "A",
      message: "",
    });
    useNotificationStore.getState().addNotification({
      type: "info",
      title: "B",
      message: "",
    });
    expect(useNotificationStore.getState().unreadCount).toBe(2);
  });

  it("respects notification category preferences stored in localStorage", () => {
    localStorage.setItem(
      "fmc:notif-prefs",
      JSON.stringify({
        categories: {
          info: false,
          contribution: true,
          goal_reached: true,
          deadline: true,
          campaign_update: true,
        },
      }),
    );
    useNotificationStore.getState().addNotification({
      type: "info",
      title: "Should be suppressed",
      message: "",
    });
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
  });
});

describe("useNotificationStore — markAsRead", () => {
  it("marks a single notification as read", () => {
    useNotificationStore.getState().addNotification({
      type: "info",
      title: "T",
      message: "",
    });
    const id = useNotificationStore.getState().notifications[0].id;
    useNotificationStore.getState().markAsRead(id);
    expect(useNotificationStore.getState().notifications[0].read).toBe(true);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });
});

describe("useNotificationStore — markAllAsRead", () => {
  it("marks every notification as read", () => {
    for (let i = 0; i < 3; i++) {
      useNotificationStore.getState().addNotification({
        type: "info",
        title: `T${i}`,
        message: "",
      });
    }
    useNotificationStore.getState().markAllAsRead();
    const { notifications, unreadCount } = useNotificationStore.getState();
    expect(notifications.every((n) => n.read)).toBe(true);
    expect(unreadCount).toBe(0);
  });
});

describe("useNotificationStore — clearAll", () => {
  it("empties the notification list", () => {
    useNotificationStore.getState().addNotification({
      type: "info",
      title: "T",
      message: "",
    });
    useNotificationStore.getState().clearAll();
    expect(useNotificationStore.getState().notifications).toHaveLength(0);
    expect(useNotificationStore.getState().unreadCount).toBe(0);
  });
});

describe("useNotificationStore — hydrate", () => {
  it("loads notifications from localStorage", () => {
    const stored = [
      {
        id: "test-1",
        type: "info" as const,
        title: "Persisted",
        message: "from storage",
        timestamp: Date.now(),
        read: false,
      },
    ];
    localStorage.setItem("fmc:notifications", JSON.stringify(stored));
    useNotificationStore.getState().hydrate();
    expect(useNotificationStore.getState().notifications).toHaveLength(1);
    expect(useNotificationStore.getState().notifications[0].title).toBe(
      "Persisted",
    );
  });
});

// ── Notification selectors ────────────────────────────────────────────────────

describe("notification selectors", () => {
  it("selectNotifications returns the notifications array", () => {
    useNotificationStore.getState().addNotification({
      type: "info",
      title: "S",
      message: "",
    });
    const state = useNotificationStore.getState();
    expect(selectNotifications(state)).toBe(state.notifications);
  });

  it("selectUnreadCount returns unreadCount", () => {
    useNotificationStore.getState().addNotification({
      type: "info",
      title: "S",
      message: "",
    });
    expect(selectUnreadCount(useNotificationStore.getState())).toBe(1);
  });

  it("selectHasUnread returns true when unreadCount > 0", () => {
    useNotificationStore.getState().addNotification({
      type: "info",
      title: "S",
      message: "",
    });
    expect(selectHasUnread(useNotificationStore.getState())).toBe(true);
  });

  it("selectHasUnread returns false when all are read", () => {
    useNotificationStore.getState().addNotification({
      type: "info",
      title: "S",
      message: "",
    });
    useNotificationStore.getState().markAllAsRead();
    expect(selectHasUnread(useNotificationStore.getState())).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Modal store
// ════════════════════════════════════════════════════════════════════════════

const MODAL_INITIAL = useModalStore.getState();

beforeEach(() => {
  useModalStore.setState(MODAL_INITIAL, true);
});

describe("useModalStore — openModal / closeModal", () => {
  it("pushes a modal onto the stack and returns its id", () => {
    const id = useModalStore.getState().openModal({
      title: "Test",
      content: null,
    });
    expect(id).toMatch(/^modal-/);
    expect(useModalStore.getState().stack).toHaveLength(1);
    expect(useModalStore.getState().stack[0].title).toBe("Test");
  });

  it("removes the modal by id", () => {
    const id = useModalStore.getState().openModal({ content: null });
    useModalStore.getState().closeModal(id);
    expect(useModalStore.getState().stack).toHaveLength(0);
  });

  it("calls onClose callback when the modal is closed", () => {
    const onClose = jest.fn();
    const id = useModalStore.getState().openModal({
      content: null,
      onClose,
    });
    useModalStore.getState().closeModal(id);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stacks multiple modals in order", () => {
    useModalStore.getState().openModal({ title: "First", content: null });
    useModalStore.getState().openModal({ title: "Second", content: null });
    const { stack } = useModalStore.getState();
    expect(stack).toHaveLength(2);
    expect(stack[0].title).toBe("First");
    expect(stack[1].title).toBe("Second");
  });
});

describe("useModalStore — closeAll", () => {
  it("clears the entire stack", () => {
    useModalStore.getState().openModal({ content: null });
    useModalStore.getState().openModal({ content: null });
    useModalStore.getState().closeAll();
    expect(useModalStore.getState().stack).toHaveLength(0);
  });

  it("calls onClose for every modal", () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    useModalStore.getState().openModal({ content: null, onClose: cb1 });
    useModalStore.getState().openModal({ content: null, onClose: cb2 });
    useModalStore.getState().closeAll();
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });
});

// ── Modal selectors ───────────────────────────────────────────────────────────

describe("modal selectors", () => {
  it("selectModalStack returns the stack array", () => {
    useModalStore.getState().openModal({ content: null });
    const state = useModalStore.getState();
    expect(selectModalStack(state)).toBe(state.stack);
  });

  it("selectHasOpenModal is false with an empty stack", () => {
    expect(selectHasOpenModal(useModalStore.getState())).toBe(false);
  });

  it("selectHasOpenModal is true when a modal is open", () => {
    useModalStore.getState().openModal({ content: null });
    expect(selectHasOpenModal(useModalStore.getState())).toBe(true);
  });

  it("selectTopModal returns the last-pushed modal", () => {
    useModalStore.getState().openModal({ title: "A", content: null });
    useModalStore.getState().openModal({ title: "B", content: null });
    const top = selectTopModal(useModalStore.getState());
    expect(top?.title).toBe("B");
  });

  it("selectTopModal returns null for an empty stack", () => {
    expect(selectTopModal(useModalStore.getState())).toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Theme store
// ════════════════════════════════════════════════════════════════════════════

const THEME_INITIAL = useThemeStore.getState();

beforeEach(() => {
  useThemeStore.setState(THEME_INITIAL, true);
});

describe("useThemeStore — setTheme / toggleTheme", () => {
  it("has dark as the default theme", () => {
    expect(useThemeStore.getState().theme).toBe("dark");
  });

  it("setTheme sets the theme explicitly", () => {
    useThemeStore.getState().setTheme("light");
    expect(useThemeStore.getState().theme).toBe("light");
  });

  it("toggleTheme flips dark → light", () => {
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe("light");
  });

  it("toggleTheme flips light → dark", () => {
    useThemeStore.getState().setTheme("light");
    useThemeStore.getState().toggleTheme();
    expect(useThemeStore.getState().theme).toBe("dark");
  });
});

// ── Theme selectors ───────────────────────────────────────────────────────────

describe("theme selectors", () => {
  it("selectTheme returns the current theme", () => {
    useThemeStore.getState().setTheme("light");
    expect(selectTheme(useThemeStore.getState())).toBe("light");
  });

  it("selectIsDarkTheme returns true in dark mode", () => {
    useThemeStore.getState().setTheme("dark");
    expect(selectIsDarkTheme(useThemeStore.getState())).toBe(true);
  });

  it("selectIsDarkTheme returns false in light mode", () => {
    useThemeStore.getState().setTheme("light");
    expect(selectIsDarkTheme(useThemeStore.getState())).toBe(false);
  });
});
