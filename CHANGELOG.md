# Changelog

## [0.2.0] — 2026-06-08

### Changed
- The 5-hour percentage now comes **only** from the Anthropic API — the local estimate is gone,
  so the value no longer jumps when sources switch. When a poll fails the last value is kept and
  marked *stale*; before the first value arrives the gauge reads *waiting for API*.
- Polite polling of `/api/oauth/usage` so we no longer starve Claude Code's own *Account &
  usage* panel (which could get stuck on *Loading usage data…*): interval raised 60s → ~3min
  with jitter, single in-flight request, and exponential back-off on HTTP 429.

### Removed
- `ccTracker.useApi` setting (the API is the only source now).
- The local limit estimate and its cost-weighting machinery.

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
