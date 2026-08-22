import { useEffect } from "react";
import { useNotifSlice } from "@/hooks/useUiSlice";
import { useNotificationStore } from "@/store/useNotificationStore";

let hydrated = false;

/**
 * Hydrates the notification store from localStorage exactly once per page
 * load, regardless of how many components call this hook.
 */
export function useNotifications() {
  const state = useNotifSlice();

  useEffect(() => {
    if (!hydrated) {
      hydrated = true;
      useNotificationStore.getState().hydrate();
    }
  }, []);

  return state;
}
