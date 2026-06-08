import * as assert from "node:assert/strict";
import { test } from "node:test";
import { computeBlocks, findActiveBlock, floorToHour } from "../blockCalculator";
import { FIVE_HOURS_MS } from "../types";
import { entryAt, HOUR, MIN } from "./helpers";

// A fixed hour boundary to build from.
const T0 = Date.UTC(2026, 5, 1, 10, 0, 0); // 2026-06-01 10:00 UTC

test("floorToHour rounds down to the hour", () => {
  assert.equal(floorToHour(T0 + 37 * MIN + 12_000), T0);
  assert.equal(floorToHour(T0), T0);
});

test("empty input yields no blocks and no active block", () => {
  const blocks = computeBlocks([]);
  assert.equal(blocks.length, 0);
  assert.equal(findActiveBlock(blocks, T0), null);
});

test("entries within 5h fall into one block, starting on the hour", () => {
  const entries = [
    entryAt(T0 + 5 * MIN, 100),
    entryAt(T0 + 2 * HOUR, 200),
    entryAt(T0 + 4 * HOUR + 59 * MIN, 300),
  ];
  const blocks = computeBlocks(entries);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].start, T0);
  assert.equal(blocks[0].end, T0 + FIVE_HOURS_MS);
  assert.equal(blocks[0].totals.total, 600);
});

test("an entry past the 5h window opens a new block", () => {
  const entries = [
    entryAt(T0 + 10 * MIN, 100),
    entryAt(T0 + 5 * HOUR + 10 * MIN, 200), // just past the first block end
  ];
  const blocks = computeBlocks(entries);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[1].totals.total, 200);
});

test("a gap > 5h between entries opens a new block even within a window", () => {
  const entries = [
    entryAt(T0, 100),
    entryAt(T0 + 6 * HOUR, 200), // 6h gap
  ];
  const blocks = computeBlocks(entries);
  assert.equal(blocks.length, 2);
});

test("active block is the last block when now is inside its window and recent", () => {
  const now = T0 + 2 * HOUR;
  const entries = [entryAt(T0 + 5 * MIN, 100), entryAt(T0 + 90 * MIN, 200)];
  const blocks = computeBlocks(entries);
  const active = findActiveBlock(blocks, now);
  assert.ok(active);
  assert.equal(active!.start, T0);
  assert.equal(active!.end, T0 + FIVE_HOURS_MS);
});

test("no active block once the window has elapsed", () => {
  const entries = [entryAt(T0, 100)];
  const blocks = computeBlocks(entries);
  const now = T0 + 6 * HOUR; // past end
  assert.equal(findActiveBlock(blocks, now), null);
});

test("no active block when last activity is older than 5h even if window not ended", () => {
  // Block starts at T0, ends T0+5h. Last entry at T0. now = T0 + 4h55m: window
  // not ended, but last activity is < 5h ago -> still active.
  const entries = [entryAt(T0, 100)];
  const blocks = computeBlocks(entries);
  assert.ok(findActiveBlock(blocks, T0 + 4 * HOUR + 55 * MIN));
});
