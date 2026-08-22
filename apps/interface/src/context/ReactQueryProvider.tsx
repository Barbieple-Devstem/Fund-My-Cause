"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { CACHE_TTLS } from "@/lib/cacheTTLs";
import { logger } from "@/lib/logger";

const rqLogger = logger.child("react-query");

const makeClient = () => {
  const qc = new QueryClient({
    defaultOptions: {
      queries: {
        // Fallback for any query not covered by setQueryDefaults below
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: false,
      },
    },
  });

  // Per-type stale-while-revalidate windows.  Each entry covers all query keys
  // that start with the given prefix — individual hooks must not repeat these.
  qc.setQueryDefaults(["campaign"], CACHE_TTLS.campaign);
  qc.setQueryDefaults(["campaign-info"], CACHE_TTLS.campaignInfo);
  qc.setQueryDefaults(["comments"], CACHE_TTLS.comments);
  qc.setQueryDefaults(["leaderboard"], CACHE_TTLS.leaderboard);
  qc.setQueryDefaults(["achievements"], CACHE_TTLS.achievements);
  qc.setQueryDefaults(["achievement-progress"], CACHE_TTLS.achievementProgress);
  qc.setQueryDefaults(["gamification-profile"], CACHE_TTLS.gamificationProfile);

  // Log network fetches so request reduction can be observed while developing.
  // Each entry is a real RPC/API call; absence = cache hit.  `logger.debug` is
  // a no-op in production, so this never reaches a user's console.
  if (process.env.NODE_ENV !== "production") {
    let fetchCount = 0;
    qc.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "fetch") {
        fetchCount += 1;
        rqLogger.debug("fetch", {
          count: fetchCount,
          queryKey: event.query.queryKey,
        });
      }
    });
  }

  return qc;
};

export function ReactQueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [client] = useState(makeClient);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
