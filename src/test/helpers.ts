import { UsageEntry } from "../types";

let seq = 0;

/** Build a UsageEntry at an absolute epoch-ms timestamp. */
export function entryAt(timestamp: number, totalTokens: number): UsageEntry {
  seq += 1;
  return {
    timestamp,
    inputTokens: totalTokens,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
    totalTokens,
    dedupKey: `k${seq}`,
  };
}

export const HOUR = 60 * 60 * 1000;
export const MIN = 60 * 1000;
