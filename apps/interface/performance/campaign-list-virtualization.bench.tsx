import React from "react";
import { bench, describe, beforeAll, vi } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { CampaignCard } from "@/components/ui/CampaignCard";
import { VirtualizedGrid } from "@/components/ui/VirtualizedGrid";
import { ComparisonProvider } from "@/context/ComparisonContext";
import { BookmarkProvider } from "@/context/BookmarkContext";
import type { Campaign } from "@/types/campaign";

vi.mock("next/image", () => ({
  __esModule: true,
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => (
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

const DATASET_SIZE = 1000;
const ROW_HEIGHT = 480;
const GAP = 24;
const MIN_COLUMN_WIDTH = 340;

function generateCampaigns(count: number): Campaign[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `bench-${i}`,
    contractId: `CBENCH${i}`,
    title: `Benchmark Campaign ${i}`,
    description: "A fixed mock campaign used to profile list rendering.",
    creator: `GCREATOR${i}`,
    raised: i * 10,
    goal: (i + 1) * 100,
    deadline: new Date(Date.now() + 86400000).toISOString(),
    status: "Active",
    token: "XLM",
    contributorCount: i,
  }));
}

function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ComparisonProvider>
      <BookmarkProvider>{children}</BookmarkProvider>
    </ComparisonProvider>
  );
}

const dataset = generateCampaigns(DATASET_SIZE);

/**
 * Run with: `npx vitest bench performance/campaign-list-virtualization.bench.tsx`
 * (from apps/interface). Compares mounting a fixed 1000-campaign dataset as a
 * flat, unvirtualized list against mounting it through VirtualizedGrid, and
 * logs how many CampaignCard instances each approach actually mounts.
 */
describe(`campaign list @ ${DATASET_SIZE} items`, () => {
  beforeAll(() => {
    const unvirtualized = render(
      <Providers>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {dataset.map((campaign, i) => (
            <CampaignCard key={campaign.id} campaign={campaign} index={i} />
          ))}
        </div>
      </Providers>,
    );
    // Each CampaignCard renders exactly one (mocked) <img>.
    const unvirtualizedCount =
      unvirtualized.container.querySelectorAll("img").length;
    cleanup();

    const virtualized = render(
      <Providers>
        <VirtualizedGrid
          items={dataset}
          getKey={(c) => c.id}
          rowHeight={ROW_HEIGHT}
          gap={GAP}
          minColumnWidth={MIN_COLUMN_WIDTH}
          renderItem={(campaign, i) => (
            <CampaignCard campaign={campaign} index={i} />
          )}
        />
      </Providers>,
    );
    const virtualizedCount =
      virtualized.container.querySelectorAll('[role="listitem"]').length;
    cleanup();

    // eslint-disable-next-line no-console
    console.log(
      `[bench] render count — unvirtualized: ${unvirtualizedCount}/${dataset.length} cards mounted, ` +
        `virtualized: ${virtualizedCount}/${dataset.length} cards mounted`,
    );
  });

  bench("unvirtualized: mount all campaign cards", () => {
    const { unmount } = render(
      <Providers>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {dataset.map((campaign, i) => (
            <CampaignCard key={campaign.id} campaign={campaign} index={i} />
          ))}
        </div>
      </Providers>,
    );
    unmount();
  });

  bench("virtualized: mount campaign cards via VirtualizedGrid", () => {
    const { unmount } = render(
      <Providers>
        <VirtualizedGrid
          items={dataset}
          getKey={(c) => c.id}
          rowHeight={ROW_HEIGHT}
          gap={GAP}
          minColumnWidth={MIN_COLUMN_WIDTH}
          renderItem={(campaign, i) => (
            <CampaignCard campaign={campaign} index={i} />
          )}
        />
      </Providers>,
    );
    unmount();
  });
});
