"use client";

import React, { useEffect, useRef, useState } from "react";

export interface VirtualizedGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  getKey: (item: T) => string;
  /** Estimated rendered height of a single row (card height + row gap), in pixels. */
  rowHeight: number;
  /** Minimum width a column needs before another column is added. */
  minColumnWidth?: number;
  /** Gap between grid cells, in pixels — must match the row gap used for `rowHeight`. */
  gap?: number;
  /** Extra rows to render above/below the visible window, to smooth fast scrolling. */
  overscanRows?: number;
  className?: string;
  "aria-label"?: string;
}

/**
 * Windowed grid: only mounts the rows currently in (or near) the viewport,
 * tracking the page's natural scroll position rather than owning its own
 * scroll container — so browser/back-forward scroll restoration and normal
 * Tab-order keyboard navigation keep working unchanged.
 */
export function VirtualizedGrid<T>({
  items,
  renderItem,
  getKey,
  rowHeight,
  minColumnWidth = 300,
  gap = 24,
  overscanRows = 2,
  className,
  ...ariaProps
}: VirtualizedGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(1);
  const [range, setRange] = useState({ start: 0, end: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const rowStride = rowHeight + gap;

    const recompute = () => {
      const width = el.clientWidth;
      const nextColumns = Math.max(
        1,
        Math.floor((width + gap) / (minColumnWidth + gap)),
      );
      const totalRows = Math.ceil(items.length / nextColumns);

      const containerTop = el.getBoundingClientRect().top + window.scrollY;
      const viewTop = window.scrollY;
      const viewBottom = window.scrollY + window.innerHeight;

      const firstRow = Math.max(
        0,
        Math.floor((viewTop - containerTop) / rowStride) - overscanRows,
      );
      const lastRow = Math.min(
        Math.max(totalRows - 1, 0),
        Math.ceil((viewBottom - containerTop) / rowStride) + overscanRows,
      );

      setColumns(nextColumns);
      setRange({
        start: Math.min(items.length, firstRow * nextColumns),
        end: Math.min(items.length, (lastRow + 1) * nextColumns),
      });
    };

    recompute();

    window.addEventListener("scroll", recompute, { passive: true });
    window.addEventListener("resize", recompute);

    // ResizeObserver isn't available in every test/SSR environment — degrade
    // to a single measurement rather than throwing.
    const hasResizeObserver = typeof ResizeObserver !== "undefined";
    const observer = hasResizeObserver ? new ResizeObserver(recompute) : null;
    observer?.observe(el);

    return () => {
      window.removeEventListener("scroll", recompute);
      window.removeEventListener("resize", recompute);
      observer?.disconnect();
    };
  }, [items.length, rowHeight, gap, minColumnWidth, overscanRows]);

  const rowStride = rowHeight + gap;
  const totalRows = Math.ceil(items.length / columns);
  const totalHeight = totalRows > 0 ? totalRows * rowStride - gap : 0;
  const firstRow = columns > 0 ? Math.floor(range.start / columns) : 0;
  const offsetTop = firstRow * rowStride;
  const visibleItems = items.slice(range.start, range.end);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: "relative", minHeight: totalHeight }}
      role="list"
      {...ariaProps}
    >
      <div
        style={{
          position: "absolute",
          top: offsetTop,
          left: 0,
          right: 0,
          display: "grid",
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gap,
        }}
      >
        {visibleItems.map((item, i) => (
          <div role="listitem" key={getKey(item)}>
            {renderItem(item, i)}
          </div>
        ))}
      </div>
    </div>
  );
}
