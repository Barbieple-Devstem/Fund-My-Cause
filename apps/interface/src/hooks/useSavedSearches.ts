"use client";

import { useState, useEffect, useCallback } from "react";
import type { SearchFilters } from "@/services/search.service";
import type { Campaign } from "@/types/campaign";
import {
  SavedSearch,
  loadSavedSearches,
  persistSavedSearches,
  createSavedSearch,
  updateSavedSearch,
  deleteSavedSearch,
  checkSavedSearchAlerts,
} from "@/services/savedSearch.service";
import { useNotifications } from "@/hooks/useNotifications";

/** Interval between alert-polling cycles (ms). */
const POLL_INTERVAL_MS = 60_000;

export function useSavedSearches(campaigns: Campaign[], walletAddress: string) {
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const { addNotification } = useNotifications();

  // Load from localStorage on mount
  useEffect(() => {
    setSavedSearches(loadSavedSearches());
  }, []);

  // Persist whenever the list changes
  useEffect(() => {
    persistSavedSearches(savedSearches);
  }, [savedSearches]);

  // Poll for new campaign matches and fire notifications
  useEffect(() => {
    if (!walletAddress || savedSearches.length === 0 || campaigns.length === 0)
      return;

    const check = () => {
      // checkSavedSearchAlerts mutates seenIds in place; we must spread to
      // trigger a React re-render so the updated seenIds are persisted.
      const alerts = checkSavedSearchAlerts(
        savedSearches,
        campaigns,
        walletAddress,
      );
      if (alerts.length > 0) {
        setSavedSearches((prev) => [...prev]); // flush updated seenIds
        for (const alert of alerts) {
          addNotification({
            type: "info",
            title: `New matches for "${alert.savedSearch.name}"`,
            message: `${alert.newCampaigns.length} new campaign${alert.newCampaigns.length > 1 ? "s" : ""} match your saved search.`,
          });
        }
      }
    };

    check(); // run immediately on mount / dependency change
    const id = setInterval(check, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [savedSearches, campaigns, walletAddress, addNotification]);

  const saveSearch = useCallback(
    (name: string, filters: SearchFilters) => {
      const entry = createSavedSearch(
        name,
        filters,
        walletAddress || "anonymous",
        campaigns,
      );
      setSavedSearches((prev) => [entry, ...prev]);
    },
    [campaigns, walletAddress],
  );

  const editSearch = useCallback(
    (id: string, patch: Partial<Pick<SavedSearch, "name" | "filters">>) => {
      setSavedSearches((prev) => updateSavedSearch(prev, id, patch));
    },
    [],
  );

  const removeSearch = useCallback((id: string) => {
    setSavedSearches((prev) => deleteSavedSearch(prev, id));
  }, []);

  return { savedSearches, saveSearch, editSearch, removeSearch };
}
