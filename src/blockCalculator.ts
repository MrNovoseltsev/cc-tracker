import { Block, FIVE_HOURS_MS, TokenTotals, UsageEntry } from "./types";
import { weightedTokens } from "./weights";

/** Floor an epoch-ms timestamp to the start of its hour (UTC). */
export function floorToHour(ts: number): number {
  return ts - (ts % (60 * 60 * 1000));
}

function emptyTotals(): TokenTotals {
  return { input: 0, output: 0, cacheCreation: 0, cacheRead: 0, total: 0, weighted: 0 };
}

function addEntry(totals: TokenTotals, e: UsageEntry): void {
  totals.input += e.inputTokens;
  totals.output += e.outputTokens;
  totals.cacheCreation += e.cacheCreationTokens;
  totals.cacheRead += e.cacheReadTokens;
  totals.total += e.totalTokens;
  totals.weighted += weightedTokens(e);
}

/** Sum a flat list of entries into one TokenTotals (used for an API-defined window). */
export function sumTotals(entries: UsageEntry[]): TokenTotals {
  const totals = emptyTotals();
  for (const e of entries) {
    addEntry(totals, e);
  }
  return totals;
}

/**
 * Group sorted usage entries into 5-hour billing blocks (ccusage semantics):
 * a block starts at the first entry's timestamp floored to the hour and spans 5h.
 * A new block starts when an entry falls past the current block's end, OR when the
 * gap since the previous entry exceeds 5h.
 *
 * `entries` MUST be sorted ascending by timestamp.
 */
export function computeBlocks(entries: UsageEntry[]): Block[] {
  const blocks: Block[] = [];
  let current: Block | null = null;
  let lastTs = 0;

  for (const e of entries) {
    const startsNewBlock =
      current === null || e.timestamp >= current.end || e.timestamp - lastTs >= FIVE_HOURS_MS;

    if (startsNewBlock) {
      const start = floorToHour(e.timestamp);
      current = { start, end: start + FIVE_HOURS_MS, entries: [], totals: emptyTotals() };
      blocks.push(current);
    }

    current!.entries.push(e);
    addEntry(current!.totals, e);
    lastTs = e.timestamp;
  }

  return blocks;
}

/**
 * The active block is the most recent block whose window still covers `now`
 * (i.e. now < end) and which has had activity within the last 5h.
 * Returns null if there is no current activity.
 */
export function findActiveBlock(blocks: Block[], now: number): Block | null {
  if (blocks.length === 0) {
    return null;
  }
  const last = blocks[blocks.length - 1];
  if (now < last.end && now - lastEntryTs(last) < FIVE_HOURS_MS) {
    return last;
  }
  return null;
}

function lastEntryTs(block: Block): number {
  return block.entries.length > 0 ? block.entries[block.entries.length - 1].timestamp : block.start;
}
