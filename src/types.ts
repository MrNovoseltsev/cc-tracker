/** Shared data shapes. These modules must not import `vscode` so they stay unit-testable. */

export interface UsageEntry {
  /** Epoch milliseconds (UTC). */
  timestamp: number;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  /** input + output + cacheCreation + cacheRead */
  totalTokens: number;
  /** Dedup key: `${message.id}:${requestId}` when available, else line uuid. */
  dedupKey: string;
}

export interface TokenTotals {
  input: number;
  output: number;
  cacheCreation: number;
  cacheRead: number;
  /** Raw sum of all token kinds (shown to the user as the absolute number). */
  total: number;
  /** Cost-weighted load used for limit/percentage math (see weights.ts). */
  weighted: number;
}

export interface Block {
  /** Block start, epoch ms, floored to the hour of the first entry. */
  start: number;
  /** Block end = start + 5h, epoch ms. */
  end: number;
  entries: UsageEntry[];
  totals: TokenTotals;
}

export interface ActiveSession {
  block: Block | null;
  /** Where percentUsed/resetAt came from: live Anthropic API, or a local estimate. */
  source: "api" | "estimate";
  /** Estimated *weighted* token ceiling for a 5h window (estimate mode only). */
  estimatedLimit: number;
  /** Weighted load of the active block (matches the units of estimatedLimit). */
  weightedUsed: number;
  /** True for API data, or for an estimate backed by enough history. */
  limitIsReliable: boolean;
  /** 0..100 percent of the 5h limit used. */
  percentUsed: number;
  /** Epoch ms when the 5h window resets, or null. */
  resetAt: number | null;
  /** ms remaining until reset, or null. */
  timeLeftMs: number | null;
  /** Weekly (7d) limit percent used, when known from the API; else null. */
  weeklyPercent: number | null;
  /** Epoch ms when the weekly window resets, when known; else null. */
  weeklyResetAt: number | null;
}

export const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
