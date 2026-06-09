import * as assert from "node:assert/strict";
import { test } from "node:test";
import { sumTotals } from "../blockCalculator";
import { entryAt, HOUR } from "./helpers";

const T0 = Date.UTC(2026, 5, 1, 10, 0, 0); // 2026-06-01 10:00 UTC

test("sumTotals of an empty list is all zeros", () => {
  const t = sumTotals([]);
  assert.deepEqual(t, { input: 0, output: 0, cacheCreation: 0, cacheRead: 0, total: 0 });
});

test("sumTotals adds up token kinds across entries", () => {
  const entries = [entryAt(T0, 100), entryAt(T0 + HOUR, 200), entryAt(T0 + 2 * HOUR, 300)];
  const t = sumTotals(entries);
  assert.equal(t.total, 600);
  assert.equal(t.input, 600); // helper puts everything in inputTokens
  assert.equal(t.output, 0);
});
