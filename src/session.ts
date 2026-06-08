import { computeBlocks, findActiveBlock, sumTotals } from "./blockCalculator";
import { estimateLimit, percentOf } from "./limitEstimator";
import { ActiveSession, FIVE_HOURS_MS, UsageEntry } from "./types";
import { ApiUsage } from "./usageApi";

/**
 * Preferred path: build the session from live Anthropic API usage, so the
 * percentage and reset time match Claude Code's "Account & usage" exactly.
 * Token counts/breakdown are still summed locally over the same 5h window
 * (window start = reset − 5h).
 */
export function buildSessionFromApi(api: ApiUsage, entries: UsageEntry[], now: number): ActiveSession {
  const resetAt = api.fiveHour.resetsAt;
  const start = resetAt !== null ? resetAt - FIVE_HOURS_MS : now - FIVE_HOURS_MS;
  const windowEntries = entries.filter((e) => e.timestamp >= start);
  const totals = sumTotals(windowEntries);

  return {
    block: { start, end: resetAt ?? start + FIVE_HOURS_MS, entries: windowEntries, totals },
    source: "api",
    estimatedLimit: 0,
    weightedUsed: totals.weighted,
    limitIsReliable: true,
    percentUsed: Math.max(0, Math.min(100, api.fiveHour.utilization)),
    resetAt,
    timeLeftMs: resetAt !== null ? Math.max(0, resetAt - now) : null,
    weeklyPercent: Math.max(0, Math.min(100, api.sevenDay.utilization)),
    weeklyResetAt: api.sevenDay.resetsAt,
  };
}

/** Fallback path: estimate the limit locally from the history of 5h blocks. */
export function buildSession(entries: UsageEntry[], now: number): ActiveSession {
  const blocks = computeBlocks(entries);
  const active = findActiveBlock(blocks, now);
  const { limit, reliable } = estimateLimit(blocks, active);

  if (!active) {
    return {
      block: null,
      source: "estimate",
      estimatedLimit: limit,
      weightedUsed: 0,
      limitIsReliable: reliable,
      percentUsed: 0,
      resetAt: null,
      timeLeftMs: null,
      weeklyPercent: null,
      weeklyResetAt: null,
    };
  }

  return {
    block: active,
    source: "estimate",
    estimatedLimit: limit,
    weightedUsed: active.totals.weighted,
    limitIsReliable: reliable,
    percentUsed: percentOf(active.totals.weighted, limit),
    resetAt: active.end,
    timeLeftMs: Math.max(0, active.end - now),
    weeklyPercent: null,
    weeklyResetAt: null,
  };
}
