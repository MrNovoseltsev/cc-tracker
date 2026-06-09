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
  /**
   * Freshness of the API-sourced percentage:
   *  - "live": fresh value from the Anthropic API
   *  - "stale": last known API value, kept while a fresh poll is pending
   *  - "unavailable": no API value obtained yet (no token / offline / opted nothing)
   */
  apiState: "live" | "stale" | "unavailable";
  /** 0..100 percent of the 5h limit used (0 when unavailable). */
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
