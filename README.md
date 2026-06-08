# CC Tracker — Claude Code Usage

Shows Claude Code token usage for the active **5-hour limit window** and the **time until it
resets** — right inside VS Code.

## Features

- **Status bar**: a solid fill gauge + percentage + absolute token count + reset timer.
  ```
  ◉ ●○○○○○○○○○ 13% · 24.6M · ⏱ 1h25m
  ```
- **Side panel** (CC Tracker icon in the Activity Bar): a precise 10-cell gauge filled by
  percentage, token breakdown (input / output / cache), the weekly (7d) limit, and reset time.
- **Official values**: the percentage and reset time come from the Anthropic API
  (`/api/oauth/usage`) — the same numbers Claude Code shows in *Account & usage*. If the
  network or token is unavailable, the extension falls back to a local estimate.
- **Local estimate (fallback)**: when the API is unavailable, the limit is estimated as the
  peak **weighted load** across past 5-hour windows (cost weights: output ×5, cache-write
  ×1.25, cache-read ×0.1). Shown as an "estimate".
- The absolute token count for the session is computed locally from
  `~/.claude/projects/**/*.jsonl`.

## How it works

Claude Code limits reset on a rolling 5-hour window. The extension queries the official
values from the Anthropic API (`GET https://api.anthropic.com/api/oauth/usage`) — the exact
source behind Claude Code's *Account & usage* panel. The absolute token count for the window
is additionally summed from the local transcripts `~/.claude/projects/**/*.jsonl`.

If the API is unavailable (offline, expired token, or disabled in settings), the extension
falls back to a local estimate: it groups records into 5-hour blocks (the same logic as
`ccusage`) and estimates the limit from history.

## Privacy

- For official values, the extension reads **Claude Code's OAuth token** from the OS
  credential store (macOS Keychain item "Claude Code-credentials") or from
  `~/.claude/.credentials.json` on other platforms. No separate sign-in is required.
- The token is sent **only** to `api.anthropic.com` (the same request Claude Code makes). The
  extension does not send data anywhere else and does not store the token.
- Don't want network requests? Turn off `ccTracker.useApi` — only the local estimate remains.

## Settings

| Setting | Default | Description |
|---|---|---|
| `ccTracker.claudePath` | `""` (auto `~/.claude`) | Path to the `.claude` directory. |
| `ccTracker.refreshIntervalSec` | `10` | Local recompute interval, in seconds. |
| `ccTracker.statusBarWidth` | `10` | Circles in the status bar gauge; 10 = a 10% step. |
| `ccTracker.useApi` | `true` | Use official values from the Anthropic API. Off = local estimate only. |

## Commands

- **CC Tracker: Refresh** — recompute now.
- **CC Tracker: Open Panel** — open the side panel.

## Limitations

- Official values are available while Claude Code's OAuth token is valid. Offline or without a
  token, a local estimate is used (labeled "estimate").
- The status bar gauge is 10 circles (a 10% step); the exact value is always shown as a number,
  and a 1%-granular gauge is in the side panel.

## Development

```bash
npm install
npm run watch      # build in watch mode
# F5 → opens an Extension Development Host with the extension loaded
npm test           # unit tests for the logic
npm run package    # production bundle in dist/
```

## License

MIT
