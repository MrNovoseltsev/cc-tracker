/**
 * Token weighting for the "% of limit" estimate.
 *
 * Claude Code's 5-hour limit tracks roughly the *cost-weighted* token load, not a
 * raw token sum. Cache reads are ~10x cheaper than fresh input and dominate raw
 * counts, so a raw sum badly understates real consumption. We weight each token
 * kind by its price ratio relative to base input tokens (consistent across Claude
 * models): output ≈5x, cache-write ≈1.25x, cache-read ≈0.1x.
 *
 * The absolute token number shown to the user stays the raw sum; only the
 * percentage and the limit estimate use these weights.
 */
export const WEIGHTS = {
  input: 1,
  output: 5,
  cacheCreation: 1.25,
  cacheRead: 0.1,
} as const;

export interface TokenParts {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

/** Cost-weighted token load for limit/percentage math. */
export function weightedTokens(p: TokenParts): number {
  return (
    p.inputTokens * WEIGHTS.input +
    p.outputTokens * WEIGHTS.output +
    p.cacheCreationTokens * WEIGHTS.cacheCreation +
    p.cacheReadTokens * WEIGHTS.cacheRead
  );
}
