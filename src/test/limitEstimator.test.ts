import * as assert from "node:assert/strict";
import { test } from "node:test";
import { computeBlocks } from "../blockCalculator";
import { estimateLimit, percentOf } from "../limitEstimator";
import { entryAt, HOUR } from "./helpers";

const T0 = Date.UTC(2026, 5, 1, 0, 0, 0);

function blockAtDay(day: number, total: number) {
  // One entry per day -> guaranteed separate blocks (gap > 5h).
  return entryAt(T0 + day * 24 * HOUR, total);
}

test("estimate is the max total across completed blocks", () => {
  const entries = [blockAtDay(0, 500), blockAtDay(1, 1200), blockAtDay(2, 900)];
  const blocks = computeBlocks(entries);
  const { limit, reliable } = estimateLimit(blocks, null);
  assert.equal(limit, 1200);
  assert.equal(reliable, true); // >= 3 completed blocks
});

test("estimate is not reliable with too little history", () => {
  const entries = [blockAtDay(0, 500)];
  const blocks = computeBlocks(entries);
  const { reliable } = estimateLimit(blocks, null);
  assert.equal(reliable, false);
});

test("active block can raise the estimate but is excluded from the reliable count", () => {
  const entries = [blockAtDay(0, 500), blockAtDay(1, 600)];
  const blocks = computeBlocks(entries);
  const active = blocks[blocks.length - 1];
  active.totals.weighted = 5000;
  const { limit } = estimateLimit(blocks, active);
  assert.equal(limit, 5000);
});

test("fallback limit is 1 with no history (no divide-by-zero)", () => {
  const { limit } = estimateLimit([], null);
  assert.equal(limit, 1);
});

test("percentOf clamps to 0..100", () => {
  assert.equal(percentOf(50, 100), 50);
  assert.equal(percentOf(200, 100), 100);
  assert.equal(percentOf(-5, 100), 0);
  assert.equal(percentOf(10, 0), 0);
});
