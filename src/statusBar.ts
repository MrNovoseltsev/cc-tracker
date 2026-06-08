import * as vscode from "vscode";
import { formatClock, formatDuration, formatTokens, renderBar } from "./format";
import { ActiveSession } from "./types";

/** Owns the status-bar item: one solid fill bar + % + tokens + countdown. */
export class StatusBar {
  private readonly item: vscode.StatusBarItem;
  private session: ActiveSession | null = null;

  constructor() {
    this.item = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    this.item.command = "cc-tracker.openPanel";
    this.item.show();
  }

  dispose(): void {
    this.item.dispose();
  }

  /** Push a fresh session snapshot and re-render. */
  update(session: ActiveSession): void {
    this.session = session;
    this.render();
  }

  /** Re-render only the countdown (called once per second). */
  tick(): void {
    this.render();
  }

  private barWidth(): number {
    return vscode.workspace.getConfiguration("ccTracker").get<number>("statusBarWidth", 10);
  }

  private render(): void {
    const s = this.session;
    if (!s || !s.block) {
      this.item.text = "$(circle-slash) CC: no active session";
      this.item.tooltip = "Claude Code: no active 5-hour window found.";
      this.item.backgroundColor = undefined;
      return;
    }

    const width = this.barWidth();
    const bar = renderBar(s.percentUsed, width);
    const pct = Math.round(s.percentUsed);
    const tokens = formatTokens(s.block.totals.total);
    const left = s.timeLeftMs !== null ? formatDuration(Math.max(0, s.resetAt! - Date.now())) : "—";
    const approx = s.limitIsReliable ? "" : "~";

    // `bar` is fixed-width: filled circles ● for the used %, empty circles ○ for
    // the remaining %. Equal-width glyphs keep the proportions honest.
    this.item.text = `$(pulse) ${bar} ${approx}${pct}% · ${tokens} · $(history) ${left}`;
    this.item.tooltip = this.buildTooltip(s);

    // Tint when close to the estimated limit.
    this.item.backgroundColor =
      s.percentUsed >= 90
        ? new vscode.ThemeColor("statusBarItem.errorBackground")
        : s.percentUsed >= 75
          ? new vscode.ThemeColor("statusBarItem.warningBackground")
          : undefined;
  }

  private buildTooltip(s: ActiveSession): vscode.MarkdownString {
    const t = s.block!.totals;
    const md = new vscode.MarkdownString();
    md.appendMarkdown(`**Claude Code — current 5-hour window**\n\n`);
    md.appendMarkdown(`- Total tokens: **${t.total.toLocaleString("en-US")}**\n`);
    md.appendMarkdown(`- Input: ${t.input.toLocaleString("en-US")}\n`);
    md.appendMarkdown(`- Output: ${t.output.toLocaleString("en-US")}\n`);
    md.appendMarkdown(`- Cache (create): ${t.cacheCreation.toLocaleString("en-US")}\n`);
    md.appendMarkdown(`- Cache (read): ${t.cacheRead.toLocaleString("en-US")}\n\n`);
    md.appendMarkdown(`- Window start: ${formatClock(s.block!.start)}\n`);
    if (s.resetAt !== null) {
      md.appendMarkdown(`- Resets at: **${formatClock(s.resetAt)}**\n`);
    }

    if (s.source === "api") {
      if (s.weeklyPercent !== null) {
        const wk = `${Math.round(s.weeklyPercent)}%`;
        const wkReset = s.weeklyResetAt !== null ? ` (resets ${formatClock(s.weeklyResetAt)})` : "";
        md.appendMarkdown(`- Weekly (7d): **${wk}**${wkReset}\n`);
      }
      md.appendMarkdown(`\n_Source: Anthropic API — official values._\n`);
    } else {
      md.appendMarkdown(
        `\n_Estimate: percentage by weighted load relative to your peak window (cache-read ×0.1, output ×5). Exact values need network access._\n`,
      );
      md.appendMarkdown(
        `- Weighted load: ${Math.round(s.weightedUsed).toLocaleString("en-US")} / ${Math.round(s.estimatedLimit).toLocaleString("en-US")}${s.limitIsReliable ? "" : " (approximate)"}\n`,
      );
    }
    return md;
  }
}
