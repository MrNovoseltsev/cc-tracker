import * as assert from "node:assert/strict";
import { test } from "node:test";
import { buildSessionFromApi, unavailableSession } from "../session";
import { ApiUsage } from "../usageApi";
import { entryAt, HOUR } from "./helpers";

const NOW = Date.UTC(2026, 5, 7, 20, 0, 0);

test("buildSessionFromApi uses the official percent and reset, apiState=live", () => {
  const resetsAt = NOW + 1 * HOUR; // window started 4h ago
  const api: ApiUsage = {
    fiveHour: { utilization: 12, resetsAt },
    sevenDay: { utilization: 3, resetsAt: NOW + 5 * 24 * HOUR },
  };
  const entries = [
    entryAt(NOW - 6 * HOUR, 1000), // before window -> excluded
    entryAt(NOW - 2 * HOUR, 500), // inside window
    entryAt(NOW - 30 * 60 * 1000, 300), // inside window
  ];
  const s = buildSessionFromApi(api, entries, NOW, false);

  assert.equal(s.apiState, "live");
  assert.equal(s.percentUsed, 12);
  assert.equal(s.resetAt, resetsAt);
  assert.equal(s.timeLeftMs, 1 * HOUR);
  assert.equal(s.weeklyPercent, 3);
  // Only the two in-window entries are summed for the token breakdown.
  assert.equal(s.block!.totals.total, 800);
  assert.equal(s.block!.start, resetsAt - 5 * HOUR);
});

test("buildSessionFromApi marks the session stale when told so", () => {
  const api: ApiUsage = {
    fiveHour: { utilization: 12, resetsAt: NOW + HOUR },
    sevenDay: { utilization: 3, resetsAt: null },
  };
  const s = buildSessionFromApi(api, [], NOW, true);
  assert.equal(s.apiState, "stale");
  assert.equal(s.percentUsed, 12); // value still shown
});

test("buildSessionFromApi clamps utilization to 0..100", () => {
  const api: ApiUsage = {
    fiveHour: { utilization: 130, resetsAt: NOW + HOUR },
    sevenDay: { utilization: -5, resetsAt: null },
  };
  const s = buildSessionFromApi(api, [], NOW, false);
  assert.equal(s.percentUsed, 100);
  assert.equal(s.weeklyPercent, 0);
});

test("unavailableSession has no block, no percent, apiState=unavailable", () => {
  const s = unavailableSession();
  assert.equal(s.apiState, "unavailable");
  assert.equal(s.block, null);
  assert.equal(s.percentUsed, 0);
  assert.equal(s.weeklyPercent, null);
});
