import * as assert from "node:assert/strict";
import { test } from "node:test";
import { parseUsageResponse } from "../usageApi";

// Mirrors the real /api/oauth/usage body.
const BODY = {
  five_hour: { utilization: 12.0, resets_at: "2026-06-08T00:49:59.817000+00:00" },
  seven_day: { utilization: 2.0, resets_at: "2026-06-14T00:59:59.817017+00:00" },
  seven_day_opus: null,
  seven_day_sonnet: { utilization: 0.0, resets_at: null },
};

test("parses five_hour and seven_day utilization and reset timestamps", () => {
  const u = parseUsageResponse(BODY);
  assert.ok(u);
  assert.equal(u!.fiveHour.utilization, 12);
  assert.equal(u!.fiveHour.resetsAt, Date.parse("2026-06-08T00:49:59.817000+00:00"));
  assert.equal(u!.sevenDay.utilization, 2);
  assert.equal(u!.sevenDay.resetsAt, Date.parse("2026-06-14T00:59:59.817017+00:00"));
});

test("seven_day defaults to 0/null when missing", () => {
  const u = parseUsageResponse({ five_hour: { utilization: 5, resets_at: null } });
  assert.ok(u);
  assert.equal(u!.sevenDay.utilization, 0);
  assert.equal(u!.sevenDay.resetsAt, null);
  assert.equal(u!.fiveHour.resetsAt, null);
});

test("returns null when five_hour is absent or malformed", () => {
  assert.equal(parseUsageResponse({}), null);
  assert.equal(parseUsageResponse({ five_hour: {} }), null);
  assert.equal(parseUsageResponse(null), null);
});
