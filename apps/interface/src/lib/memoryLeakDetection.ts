/**
 * Memory leak detection and profiling utilities.
 * Tracks object allocations and detects potential leaks.
 */

import { logger } from "@/lib/logger";

const memLogger = logger.child("memory-profiling");

interface AllocationRecord {
  type: string;
  size: number;
  timestamp: number;
  stack?: string;
}

const allocations = new Map<string, AllocationRecord[]>();
let isMonitoring = false;

/**
 * Start memory profiling.
 */
export function startMemoryProfiling(): void {
  if (isMonitoring) return;
  isMonitoring = true;

  if (performance.memory) {
    memLogger.debug("profiling started");
  }
}

/**
 * Stop memory profiling.
 */
export function stopMemoryProfiling(): void {
  isMonitoring = false;
}

/**
 * Track an object allocation.
 */
export function trackAllocation(
  type: string,
  size: number = 0,
  stack?: string,
): void {
  if (!isMonitoring) return;

  if (!allocations.has(type)) {
    allocations.set(type, []);
  }

  allocations.get(type)!.push({
    type,
    size,
    timestamp: Date.now(),
    stack,
  });
}

/**
 * Get memory stats.
 */
export function getMemoryStats() {
  const stats = {
    totalAllocations: 0,
    allocationsByType: {} as Record<string, number>,
    totalSize: 0,
    timestamp: Date.now(),
  };

  for (const [type, records] of allocations.entries()) {
    stats.allocationsByType[type] = records.length;
    stats.totalAllocations += records.length;
    stats.totalSize += records.reduce((sum, r) => sum + r.size, 0);
  }

  if (performance.memory) {
    stats.jsHeapSizeLimit = performance.memory.jsHeapSizeLimit;
    stats.totalJSHeapSize = performance.memory.totalJSHeapSize;
    stats.usedJSHeapSize = performance.memory.usedJSHeapSize;
  }

  return stats;
}

/**
 * Detect potential memory leaks by analyzing allocation patterns.
 */
export function detectMemoryLeaks(): {
  potentialLeaks: string[];
  analysis: Record<string, unknown>;
} {
  const stats = getMemoryStats();
  const potentialLeaks: string[] = [];

  // Check for types with excessive allocations
  for (const [type, count] of Object.entries(stats.allocationsByType)) {
    if (count > 1000) {
      potentialLeaks.push(`${type}: ${count} allocations`);
    }
  }

  return {
    potentialLeaks,
    analysis: stats,
  };
}

/**
 * Clear allocation tracking.
 */
export function clearAllocationTracking(): void {
  allocations.clear();
}

/**
 * Get detailed allocation report.
 */
export function getAllocationReport() {
  const report: Record<string, unknown> = {};

  for (const [type, records] of allocations.entries()) {
    report[type] = {
      count: records.length,
      totalSize: records.reduce((sum, r) => sum + r.size, 0),
      avgSize: records.reduce((sum, r) => sum + r.size, 0) / records.length,
      firstAllocation: records[0]?.timestamp,
      lastAllocation: records[records.length - 1]?.timestamp,
    };
  }

  return report;
}

/**
 * Monitor component lifecycle for memory leaks.
 */
export function createMemoryLeakDetector(componentName: string) {
  return {
    onMount: () => {
      trackAllocation(`${componentName}:mount`, 0);
    },
    onUnmount: () => {
      trackAllocation(`${componentName}:unmount`, 0);
    },
    onSubscribe: () => {
      trackAllocation(`${componentName}:subscribe`, 0);
    },
    onUnsubscribe: () => {
      trackAllocation(`${componentName}:unsubscribe`, 0);
    },
  };
}
