import * as assert from "node:assert/strict";
import { test } from "node:test";
import { weightedTokens } from "../weights";

test("weightedTokens applies cost ratios per token kind", () => {
  const w = weightedTokens({
    inputTokens: 100,
    outputTokens: 100,
    cacheCreationTokens: 100,
    cacheReadTokens: 100,
  });
  // 100*1 + 100*5 + 100*1.25 + 100*0.1 = 735
  assert.equal(w, 735);
});

test("cache reads contribute little despite large raw counts", () => {
  // 1,000,000 cache-read tokens weigh the same as 100,000 input tokens.
  assert.equal(
    weightedTokens({ inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 1_000_000 }),
    weightedTokens({ inputTokens: 100_000, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 }),
  );
});
