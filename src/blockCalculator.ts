import { TokenTotals, UsageEntry } from "./types";

function emptyTotals(): TokenTotals {
  return { input: 0, output: 0, cacheCreation: 0, cacheRead: 0, total: 0 };
}

function addEntry(totals: TokenTotals, e: UsageEntry): void {
  totals.input += e.inputTokens;
  totals.output += e.outputTokens;
  totals.cacheCreation += e.cacheCreationTokens;
  totals.cacheRead += e.cacheReadTokens;
  totals.total += e.totalTokens;
}

/** Sum a flat list of entries into one TokenTotals (used for an API-defined window). */
export function sumTotals(entries: UsageEntry[]): TokenTotals {
  const totals = emptyTotals();
  for (const e of entries) {
    addEntry(totals, e);
  }
  return totals;
}
