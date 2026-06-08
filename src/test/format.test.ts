import * as assert from "node:assert/strict";
import { test } from "node:test";
import { formatDuration, formatTokens, renderBar } from "../format";

test("formatTokens scales to K/M", () => {
  assert.equal(formatTokens(950), "950");
  assert.equal(formatTokens(12_345), "12.3K");
  assert.equal(formatTokens(1_234_567), "1.2M");
});

test("formatDuration renders h/m", () => {
  assert.equal(formatDuration(0), "0m");
  assert.equal(formatDuration(47 * 60_000), "47m");
  assert.equal(formatDuration((2 * 60 + 14) * 60_000), "2h14m");
});

const FILLED = String.fromCharCode(0x25cf); // ●
const EMPTY = String.fromCharCode(0x25cb); // ○

test("renderBar is fixed width: filled ● for used, empty ○ for the remainder", () => {
  assert.equal(renderBar(0, 10), EMPTY.repeat(10));
  assert.equal(renderBar(100, 10), FILLED.repeat(10));
  assert.equal(renderBar(50, 10), FILLED.repeat(5) + EMPTY.repeat(5));
  assert.equal(renderBar(20, 10), FILLED.repeat(2) + EMPTY.repeat(8));
});

test("renderBar rounds the used portion to the nearest whole cell", () => {
  // 14% of width 13 -> 1.82 -> 2 filled, 11 empty.
  assert.equal(renderBar(14, 13), FILLED.repeat(2) + EMPTY.repeat(11));
  // 4% of width 13 -> 0.52 -> 1 filled.
  assert.equal(renderBar(4, 13), FILLED.repeat(1) + EMPTY.repeat(12));
});

test("renderBar uses only the equal-width circle glyphs (no shade glyphs)", () => {
  const bar = renderBar(37, 13);
  assert.ok([...bar].every((c) => c === FILLED || c === EMPTY));
  assert.ok(!bar.includes("░"));
});

test("renderBar is always exactly `width` chars", () => {
  assert.equal([...renderBar(100, 13)].length, 13);
  assert.equal([...renderBar(0, 13)].length, 13);
  assert.equal([...renderBar(63.7, 13)].length, 13);
});
