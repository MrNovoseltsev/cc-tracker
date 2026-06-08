import * as assert from "node:assert/strict";
import { test } from "node:test";
import { parseUsageLine } from "../usageReader";

// Mirrors the real Claude Code transcript shape (assistant line with usage).
const ASSISTANT_LINE = JSON.stringify({
  type: "assistant",
  requestId: "req_ABC",
  uuid: "u-1",
  timestamp: "2026-06-07T19:50:57.784Z",
  message: {
    id: "msg_XYZ",
    model: "claude-opus-4-8",
    usage: {
      input_tokens: 3420,
      cache_creation_input_tokens: 2292,
      cache_read_input_tokens: 8618,
      output_tokens: 1110,
    },
  },
});

test("parses an assistant usage line and sums all token kinds", () => {
  const e = parseUsageLine(ASSISTANT_LINE);
  assert.ok(e);
  assert.equal(e!.inputTokens, 3420);
  assert.equal(e!.outputTokens, 1110);
  assert.equal(e!.cacheCreationTokens, 2292);
  assert.equal(e!.cacheReadTokens, 8618);
  assert.equal(e!.totalTokens, 3420 + 1110 + 2292 + 8618);
  assert.equal(e!.dedupKey, "msg_XYZ:req_ABC");
  assert.equal(e!.timestamp, Date.parse("2026-06-07T19:50:57.784Z"));
});

test("returns null for non-assistant lines", () => {
  assert.equal(parseUsageLine(JSON.stringify({ type: "user", message: {} })), null);
});

test("returns null for blank and corrupt lines", () => {
  assert.equal(parseUsageLine(""), null);
  assert.equal(parseUsageLine("   "), null);
  assert.equal(parseUsageLine("{not json"), null);
});

test("returns null when there are no tokens", () => {
  const line = JSON.stringify({
    type: "assistant",
    timestamp: "2026-06-07T19:50:57.784Z",
    message: { usage: { input_tokens: 0, output_tokens: 0 } },
  });
  assert.equal(parseUsageLine(line), null);
});

test("falls back to uuid for dedup when ids are missing", () => {
  const line = JSON.stringify({
    type: "assistant",
    uuid: "only-uuid",
    timestamp: "2026-06-07T19:50:57.784Z",
    message: { usage: { output_tokens: 5 } },
  });
  const e = parseUsageLine(line);
  assert.ok(e);
  assert.equal(e!.dedupKey, "only-uuid");
});
