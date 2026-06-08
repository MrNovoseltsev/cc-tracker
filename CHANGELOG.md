# Changelog

## [0.1.1] — 2026-06-08

### Added
- Screenshots (status bar and side panel) on the Marketplace page / README.

## [0.1.0] — 2026-06-07

### Added
- Official values from the Anthropic API (`/api/oauth/usage`): the 5-hour window percentage
  and reset time match Claude Code's *Account & usage* panel. The OAuth token is read from
  Claude Code's credential store; the request goes only to `api.anthropic.com`.
- Weekly (7d) limit shown in the side panel and tooltip.
- `ccTracker.useApi` setting — disable network requests (local estimate only).

### Changed
- Status bar gauge: equal-width circles `●`/`○` (honest proportions), 10 of them = a 10% step.
- The local limit estimate is now a fallback for when the API is unavailable.

## [0.0.1] — 2026-06-07

### Added
- Status bar: solid fill gauge, percentage, absolute tokens, and reset timer for the active
  5-hour window.
- Side webview panel: precise 10-cell gauge (filled by percentage), token breakdown
  (input / output / cache), window start, and reset time.
- Automatic token-limit estimate from the history of 5-hour blocks.
- Reads local transcripts `~/.claude/projects/**/*.jsonl` with incremental tailing and a file
  watcher.
