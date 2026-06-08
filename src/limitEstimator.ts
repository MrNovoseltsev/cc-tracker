import { Block } from "./types";

export interface LimitEstimate {
  limit: number;
  reliable: boolean;
}

/**
 * Claude Code does not publish the exact per-window ceiling, and it varies by
 * plan. We estimate it as the maximum *weighted* token load observed across
 * *completed* blocks (when a user hits their cap, that block's load ≈ the
 * ceiling). Weighting (see weights.ts) makes this track real limits far better
 * than a raw token sum, which cache reads would otherwise dominate.
 *
 * `activeBlock` is excluded so a partially-filled current window never deflates
 * the estimate. The estimate is considered reliable once we have at least a few
 * completed blocks to learn from.
 */
export function estimateLimit(blocks: Block[], activeBlock: Block | null): LimitEstimate {
  const completed = blocks.filter((b) => b !== activeBlock);

  let max = 0;
  for (const b of completed) {
    if (b.totals.weighted > max) {
      max = b.totals.weighted;
    }
  }

  // Also consider the active block — the current window may already be the
  // largest we have ever seen, in which case the ceiling is at least that high.
  if (activeBlock && activeBlock.totals.weighted > max) {
    max = activeBlock.totals.weighted;
  }

  const reliable = completed.length >= 3 && max > 0;

  // Fallback when we have essentially no history: a conservative default so the
  // bar still renders something sensible instead of dividing by zero.
  const limit = max > 0 ? max : 1;

  return { limit, reliable };
}

/** Clamp used/limit to a 0..100 percentage. */
export function percentOf(used: number, limit: number): number {
  if (limit <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (used / limit) * 100));
}
