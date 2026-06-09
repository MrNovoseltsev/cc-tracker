import * as vscode from "vscode";
import { ActiveSession } from "./types";

export interface PanelPayload {
  hasBlock: boolean;
  percent: number;
  apiState: "live" | "stale" | "unavailable";
  totalTokens: number;
  input: number;
  output: number;
  cacheCreation: number;
  cacheRead: number;
  blockStart: number | null;
  resetAt: number | null;
  weeklyPercent: number | null;
  weeklyResetAt: number | null;
}

/** Sidebar webview: precise 10-square scale (1%-granular fill) + token breakdown. */
export class PanelViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "ccTracker.panel";

  private view?: vscode.WebviewView;
  private last?: PanelPayload;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly onRefreshRequest: () => void,
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    webviewView.webview.options = { enableScripts: true, localResourceRoots: [this.extensionUri] };
    webviewView.webview.html = this.html();

    webviewView.webview.onDidReceiveMessage((msg) => {
      if (msg?.type === "refresh") {
        this.onRefreshRequest();
      } else if (msg?.type === "ready" && this.last) {
        this.post(this.last);
      }
    });

    if (this.last) {
      this.post(this.last);
    }
  }

  update(session: ActiveSession): void {
    const payload: PanelPayload = {
      hasBlock: !!session.block,
      percent: session.percentUsed,
      apiState: session.apiState,
      totalTokens: session.block?.totals.total ?? 0,
      input: session.block?.totals.input ?? 0,
      output: session.block?.totals.output ?? 0,
      cacheCreation: session.block?.totals.cacheCreation ?? 0,
      cacheRead: session.block?.totals.cacheRead ?? 0,
      blockStart: session.block?.start ?? null,
      resetAt: session.resetAt,
      weeklyPercent: session.weeklyPercent,
      weeklyResetAt: session.weeklyResetAt,
    };
    this.last = payload;
    this.post(payload);
  }

  private post(payload: PanelPayload): void {
    this.view?.webview.postMessage({ type: "update", payload });
  }

  private html(): string {
    const nonce = getNonce();
    const csp = `default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="${csp}" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  body { font-family: var(--vscode-font-family); color: var(--vscode-foreground); padding: 12px; }
  .pct { font-size: 28px; font-weight: 600; }
  .approx { font-size: 13px; opacity: 0.7; }
  .scale { display: flex; gap: 3px; margin: 12px 0; }
  .cell {
    flex: 1; height: 22px; position: relative;
    border: 1px solid var(--vscode-panel-border, rgba(128,128,128,0.4));
    border-radius: 2px; overflow: hidden;
    background: var(--vscode-editorWidget-background, rgba(128,128,128,0.1));
  }
  .cell .fill {
    position: absolute; left: 0; top: 0; bottom: 0; width: 0%;
    background: var(--vscode-progressBar-background, var(--vscode-button-background));
    transition: width 0.3s ease;
  }
  .cell.warn .fill { background: var(--vscode-editorWarning-foreground, #cca700); }
  .cell.crit .fill { background: var(--vscode-editorError-foreground, #f14c4c); }
  table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 13px; }
  td { padding: 3px 0; }
  td.v { text-align: right; font-variant-numeric: tabular-nums; }
  .muted { opacity: 0.7; }
  .sub { margin: 6px 0 2px; font-size: 13px; opacity: 0.85; }
  .total { font-size: 18px; font-weight: 600; }
  .empty { opacity: 0.7; font-style: italic; margin-top: 16px; }
  button {
    margin-top: 14px; width: 100%; padding: 5px;
    color: var(--vscode-button-foreground); background: var(--vscode-button-background);
    border: none; border-radius: 2px; cursor: pointer;
  }
  button:hover { background: var(--vscode-button-hoverBackground); }
</style>
</head>
<body>
  <div id="content">
    <div class="empty">Loading…</div>
  </div>
  <button id="refresh">Refresh</button>
<script nonce="${nonce}">
  const vscode = acquireVsCodeApi();
  const content = document.getElementById('content');

  function fmt(n) {
    if (n >= 1e6) return (n/1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
    return String(n);
  }
  function clock(ms) {
    if (ms == null) return '—';
    const d = new Date(ms);
    return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  }
  function full(n) { return (n || 0).toLocaleString('en-US'); }

  function scale(percent) {
    const cls = percent >= 90 ? 'crit' : percent >= 75 ? 'warn' : '';
    let cells = '';
    for (let i = 0; i < 10; i++) {
      const fillPct = Math.max(0, Math.min(100, (percent - i * 10) / 10 * 100));
      cells += '<div class="cell ' + cls + '"><div class="fill" style="width:' + fillPct + '%"></div></div>';
    }
    return '<div class="scale">' + cells + '</div>';
  }

  function render(p) {
    if (!p || !p.hasBlock || p.apiState === 'unavailable') {
      content.innerHTML = '<div class="empty">No API data yet.<br/>Make sure you are logged in to Claude Code.</div>';
      return;
    }
    const pct = Math.round(p.percent);
    const stale = p.apiState === 'stale';
    const weekly = (p.weeklyPercent != null)
      ? '<div class="sub">Weekly (7d): <b>' + Math.round(p.weeklyPercent) + '%</b>' +
        (p.weeklyResetAt != null ? ' · resets ' + clock(p.weeklyResetAt) : '') + '</div>'
      : '';
    const footer = stale
      ? '<div class="muted" style="margin-top:8px;font-size:11px">Last known value — stale, refreshing…</div>'
      : '<div class="muted" style="margin-top:8px;font-size:11px">Source: Anthropic API — official values, same as “Account &amp; usage”.</div>';
    content.innerHTML =
      '<div class="pct">' + pct + '%' + (stale ? ' <span class="approx">(stale)</span>' : '') + '</div>' +
      scale(p.percent) +
      weekly +
      '<div class="total">' + fmt(p.totalTokens) + ' tokens this session</div>' +
      '<table>' +
        row('Input', full(p.input)) +
        row('Output', full(p.output)) +
        row('Cache (create)', full(p.cacheCreation)) +
        row('Cache (read)', full(p.cacheRead)) +
        row('Window start', clock(p.blockStart)) +
        row('Resets at', clock(p.resetAt)) +
      '</table>' +
      footer;
  }
  function row(k, v) {
    return '<tr><td class="muted">' + k + '</td><td class="v">' + v + '</td></tr>';
  }

  window.addEventListener('message', (e) => {
    if (e.data && e.data.type === 'update') render(e.data.payload);
  });
  document.getElementById('refresh').addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));
  vscode.postMessage({ type: 'ready' });
</script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = "";
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
