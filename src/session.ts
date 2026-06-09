import { sumTotals } from "./blockCalculator";
import { ActiveSession, FIVE_HOURS_MS, UsageEntry } from "./types";
import { ApiUsage } from "./usageApi";

/**
 * Build the session from live Anthropic API usage, so the percentage and reset
 * time match Claude Code's "Account & usage" exactly. Token counts/breakdown are
 * still summed locally over the same 5h window (window start = reset − 5h).
 *
 * `stale` is true when the cached API value is older than the freshness window;
 * we keep showing the last known number rather than dropping the percentage.
 */
export function buildSessionFromApi(
  api: ApiUsage,
  entries: UsageEntry[],
  now: number,
  stale: boolean,
): ActiveSession {
  const resetAt = api.fiveHour.resetsAt;
  const start = resetAt !== null ? resetAt - FIVE_HOURS_MS : now - FIVE_HOURS_MS;
  const windowEntries = entries.filter((e) => e.timestamp >= start);
  const totals = sumTotals(windowEntries);

  return {
    block: { start, end: resetAt ?? start + FIVE_HOURS_MS, entries: windowEntries, totals },
    apiState: stale ? "stale" : "live",
    percentUsed: Math.max(0, Math.min(100, api.fiveHour.utilization)),
    resetAt,
    timeLeftMs: resetAt !== null ? Math.max(0, resetAt - now) : null,
    weeklyPercent: Math.max(0, Math.min(100, api.sevenDay.utilization)),
    weeklyResetAt: api.sevenDay.resetsAt,
  };
}

/**
 * No API value has been obtained yet (missing token, offline, …). We do not fall
 * back to a local estimate, so there is no percentage to show.
 */
export function unavailableSession(): ActiveSession {
  return {
    block: null,
    apiState: "unavailable",
    percentUsed: 0,
    resetAt: null,
    timeLeftMs: null,
    weeklyPercent: null,
    weeklyResetAt: null,
  };
}
