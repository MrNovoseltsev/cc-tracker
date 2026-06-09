import * as vscode from "vscode";
import { PanelViewProvider } from "./panelView";
import { buildSessionFromApi, unavailableSession } from "./session";
import { StatusBar } from "./statusBar";
import { ApiUsage, fetchApiUsage } from "./usageApi";
import { resolveClaudeDir, UsageReader } from "./usageReader";

/** How far back to read transcripts (token breakdown only; the % comes from the API). */
const LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
/**
 * Base interval between live usage polls. Kept deliberately slow: `/api/oauth/usage`
 * rate-limits per OAuth token, and that token is shared with Claude Code's own
 * "Account & usage" panel — polling too often gets *both* of us 429'd. Usage moves
 * on a 5-hour window, so a few minutes of lag is irrelevant.
 */
const API_POLL_MS = 180 * 1000;
/** Random extra delay added to each poll so we don't phase-lock with Claude Code's poller. */
const API_JITTER_MS = 30 * 1000;
/** Extra wait after the first 429, doubled on each repeat up to this cap. */
const API_BACKOFF_MAX_MS = 15 * 60 * 1000;
/** Treat cached API usage as fresh for a bit over two poll intervals. */
const API_TTL_MS = 400 * 1000;

export function activate(context: vscode.ExtensionContext): void {
  const cfg = () => vscode.workspace.getConfiguration("ccTracker");

  let claudeDir = resolveClaudeDir(cfg().get<string>("claudePath"));
  const reader = new UsageReader(claudeDir);
  const statusBar = new StatusBar();
  const panel = new PanelViewProvider(context.extensionUri, () => void pollApiThenRefresh());

  let apiUsage: ApiUsage | null = null;
  let apiFetchedAt = 0;

  function render(): void {
    try {
      const now = Date.now();
      const entries = reader.read(now - LOOKBACK_MS);
      // The API is the only source of the percentage. While no value has been
      // fetched yet we show "no data"; once we have one we keep showing it
      // (marked stale) rather than falling back to a local estimate.
      const session =
        apiUsage === null
          ? unavailableSession()
          : buildSessionFromApi(apiUsage, entries, now, now - apiFetchedAt >= API_TTL_MS);
      statusBar.update(session);
      panel.update(session);
    } catch (err) {
      console.error("[cc-tracker] render failed:", err);
    }
  }

  // Extra delay imposed after a 429, on top of the base interval. Grows while we
  // keep getting rate-limited, resets to 0 on a successful poll.
  let apiBackoffMs = 0;
  // Single-flight guard: never overlap polls (bursts of triggers must coalesce).
  let polling = false;

  async function pollApi(): Promise<void> {
    if (polling) {
      return;
    }
    polling = true;
    try {
      const res = await fetchApiUsage(claudeDir);
      if (res.usage) {
        apiUsage = res.usage;
        apiFetchedAt = Date.now();
        apiBackoffMs = 0;
      } else if (res.rateLimited) {
        apiBackoffMs = Math.min(apiBackoffMs ? apiBackoffMs * 2 : API_POLL_MS, API_BACKOFF_MAX_MS);
      }
    } finally {
      polling = false;
    }
  }

  async function pollApiThenRefresh(): Promise<void> {
    await pollApi();
    render();
  }

  // Debounce bursts of file-watcher events while Claude Code streams output.
  let debounce: NodeJS.Timeout | undefined;
  function renderDebounced(): void {
    if (debounce) {
      clearTimeout(debounce);
    }
    debounce = setTimeout(render, 300);
  }

  // Per-second countdown re-render (no file I/O, no network).
  const tick = setInterval(() => statusBar.tick(), 1000);

  // Local recompute safety net (tokens + fallback), independent of the network.
  let periodic: NodeJS.Timeout | undefined;
  function schedulePeriodic(): void {
    if (periodic) {
      clearInterval(periodic);
    }
    const sec = Math.max(2, cfg().get<number>("refreshIntervalSec", 10));
    periodic = setInterval(render, sec * 1000);
  }
  schedulePeriodic();

  // Live API polling. A self-rescheduling timer (not setInterval) so each gap can
  // carry its own jitter and any 429 back-off.
  let apiTimer: NodeJS.Timeout | undefined;
  function scheduleApiPoll(): void {
    if (apiTimer) {
      clearTimeout(apiTimer);
    }
    const delay = API_POLL_MS + Math.floor(Math.random() * API_JITTER_MS) + apiBackoffMs;
    apiTimer = setTimeout(() => {
      void pollApiThenRefresh().finally(scheduleApiPoll);
    }, delay);
  }
  scheduleApiPoll();

  // Watch ~/.claude/projects/**/*.jsonl (outside the workspace).
  const watcher = vscode.workspace.createFileSystemWatcher(
    new vscode.RelativePattern(vscode.Uri.file(reader.projectsDir), "**/*.jsonl"),
  );
  watcher.onDidChange(renderDebounced);
  watcher.onDidCreate(renderDebounced);

  context.subscriptions.push(
    statusBar,
    watcher,
    vscode.window.registerWebviewViewProvider(PanelViewProvider.viewType, panel),
    vscode.commands.registerCommand("cc-tracker.refresh", () => void pollApiThenRefresh()),
    vscode.commands.registerCommand("cc-tracker.openPanel", () =>
      vscode.commands.executeCommand("ccTracker.panel.focus"),
    ),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("ccTracker")) {
        claudeDir = resolveClaudeDir(cfg().get<string>("claudePath"));
        reader.setClaudeDir(claudeDir);
        schedulePeriodic();
        void pollApiThenRefresh();
      }
    }),
    {
      dispose: () => {
        clearInterval(tick);
        if (apiTimer) {
          clearTimeout(apiTimer);
        }
        if (periodic) {
          clearInterval(periodic);
        }
        if (debounce) {
          clearTimeout(debounce);
        }
      },
    },
  );

  render(); // immediate paint from local data
  void pollApiThenRefresh(); // then upgrade to live API numbers
}

export function deactivate(): void {
  // Disposables are handled via context.subscriptions.
}
