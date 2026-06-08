import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

/**
 * Live usage from Anthropic's `/api/oauth/usage` — the same source as Claude
 * Code's "Account & usage" panel. Returns official utilization percentages, so
 * the bar matches what Claude Code shows instead of a local estimate.
 *
 * We reuse Claude Code's own OAuth token (read from the OS credential store);
 * no separate login. The token is sent only to api.anthropic.com.
 */

const BASE_API_URL = "https://api.anthropic.com";
const USAGE_PATH = "/api/oauth/usage";
const TIMEOUT_MS = 5000;

export interface UsageWindow {
  /** 0..100 percent of the limit used. */
  utilization: number;
  /** Epoch ms when this window resets, or null. */
  resetsAt: number | null;
}

export interface ApiUsage {
  fiveHour: UsageWindow;
  sevenDay: UsageWindow;
}

interface OAuthToken {
  accessToken: string;
  expiresAt?: number;
}

/**
 * Read Claude Code's OAuth access token. Order:
 *  1. `<claudeDir>/.credentials.json` (Linux/Windows, and some macOS setups)
 *  2. macOS Keychain item "Claude Code-credentials"
 * Returns null if absent or already expired.
 */
export function readOAuthToken(claudeDir: string): OAuthToken | null {
  const fromFile = tokenFromFile(claudeDir);
  const token = fromFile ?? (process.platform === "darwin" ? tokenFromKeychain() : null);
  if (!token) {
    return null;
  }
  if (token.expiresAt && Date.now() >= token.expiresAt) {
    return null; // stale; Claude Code refreshes it on next use
  }
  return token;
}

function tokenFromFile(claudeDir: string): OAuthToken | null {
  try {
    const raw = fs.readFileSync(path.join(claudeDir, ".credentials.json"), "utf8");
    return pickToken(JSON.parse(raw));
  } catch {
    return null;
  }
}

function tokenFromKeychain(): OAuthToken | null {
  try {
    const out = execFileSync(
      "security",
      ["find-generic-password", "-s", "Claude Code-credentials", "-w"],
      { encoding: "utf8", timeout: TIMEOUT_MS },
    );
    return pickToken(JSON.parse(out));
  } catch {
    return null;
  }
}

function pickToken(obj: any): OAuthToken | null {
  const o = obj?.claudeAiOauth;
  if (o && typeof o.accessToken === "string" && o.accessToken.length > 0) {
    return { accessToken: o.accessToken, expiresAt: typeof o.expiresAt === "number" ? o.expiresAt : undefined };
  }
  return null;
}

/** Parse the `/api/oauth/usage` JSON body. Exported for tests. */
export function parseUsageResponse(json: any): ApiUsage | null {
  const fh = json?.five_hour;
  if (!fh || typeof fh.utilization !== "number") {
    return null;
  }
  return {
    fiveHour: { utilization: fh.utilization, resetsAt: parseTs(fh.resets_at) },
    sevenDay: window7(json?.seven_day),
  };
}

function window7(sd: any): UsageWindow {
  if (sd && typeof sd.utilization === "number") {
    return { utilization: sd.utilization, resetsAt: parseTs(sd.resets_at) };
  }
  return { utilization: 0, resetsAt: null };
}

function parseTs(s: unknown): number | null {
  if (typeof s !== "string") {
    return null;
  }
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

/** Fetch live usage, or null on any failure (missing creds, offline, 401, …). */
export async function fetchApiUsage(claudeDir: string): Promise<ApiUsage | null> {
  const token = readOAuthToken(claudeDir);
  if (!token) {
    return null;
  }
  try {
    const res = await fetch(`${BASE_API_URL}${USAGE_PATH}`, {
      headers: {
        Authorization: `Bearer ${token.accessToken}`,
        "Content-Type": "application/json",
        "User-Agent": "cc-tracker-vscode",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      return null;
    }
    return parseUsageResponse(await res.json());
  } catch {
    return null;
  }
}
