/** Pure formatting helpers shared by the status bar and the webview panel. */

/** 1234567 -> "1.2M", 12345 -> "12.3K", 950 -> "950". */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1)}M`;
  }
  if (n >= 1_000) {
    return `${(n / 1_000).toFixed(1)}K`;
  }
  return String(n);
}

/** ms -> "2h14m" / "47m" / "0m". */
export function formatDuration(ms: number): string {
  if (ms <= 0) {
    return "0m";
  }
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** Epoch ms -> local "HH:MM". */
export function formatClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const FULL = String.fromCharCode(0x25cf); // ● used
// Track and fill are the geometric circles ○/● (U+25CB / U+25CF): equal width in
// the proportional status-bar font, so the filled run matches the percentage. Both
// render reliably (no tofu like shade glyphs ░▒▓).
const TRACK = String.fromCharCode(0x25cb); // ○ remaining

/**
 * Render a fixed-width bar: filled circles ● for the used portion on the left,
 * then empty circles ○ for the remaining portion. Equal-width glyphs keep the
 * filled run proportional to the percentage. Total length is always `width`.
 *
 * cells = round(percent/100 * width). One cell ≈ 100/width percent.
 */
export function renderBar(percent: number, width: number): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const cells = Math.round((clamped / 100) * width);
  return FULL.repeat(cells) + TRACK.repeat(width - cells);
}
