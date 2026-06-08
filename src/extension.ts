import * as vscode from "vscode";
import { PanelViewProvider } from "./panelView";
import { buildSession, buildSessionFromApi } from "./session";
import { StatusBar } from "./statusBar";
import { ApiUsage, fetchApiUsage } from "./usageApi";
import { resolveClaudeDir, UsageReader } from "./usageReader";

/** How far back to read transcripts: enough history for a reliable limit estimate. */
const LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
/** How often to poll the live usage API. */
const API_POLL_MS = 60 * 1000;
/** Treat cached API usage as fresh for a little over one poll interval. */
const API_TTL_MS = 90 * 1000;

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
      const apiFresh = apiUsage !== null && now - apiFetchedAt < API_TTL_MS;
      const session = apiFresh
        ? buildSessionFromApi(apiUsage!, entries, now)
        : buildSession(entries, now);
      statusBar.update(session);
      panel.update(session);
    } catch (err) {
      console.error("[cc-tracker] render failed:", err);
    }
  }

  async function pollApi(): Promise<void> {
    if (!cfg().get<boolean>("useApi", true)) {
      apiUsage = null; // user opted out -> local estimate only
      return;
    }
    const usage = await fetchApiUsage(claudeDir);
    if (usage) {
      apiUsage = usage;
      apiFetchedAt = Date.now();
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

  // Live API polling.
  const apiTimer = setInterval(() => void pollApiThenRefresh(), API_POLL_MS);

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
        clearInterval(apiTimer);
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
