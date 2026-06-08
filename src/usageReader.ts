import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { UsageEntry } from "./types";

/** Resolve the `.claude` directory. `override` wins if non-empty, else `~/.claude`. */
export function resolveClaudeDir(override?: string): string {
  if (override && override.trim().length > 0) {
    return override.trim();
  }
  return path.join(os.homedir(), ".claude");
}

/** Parse a single JSONL line into a UsageEntry, or null if it carries no usage. */
export function parseUsageLine(line: string): UsageEntry | null {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return null;
  }
  let obj: any;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    return null; // skip corrupt lines
  }
  if (obj?.type !== "assistant") {
    return null;
  }
  const usage = obj?.message?.usage;
  if (!usage || typeof usage !== "object") {
    return null;
  }
  const ts = Date.parse(obj.timestamp);
  if (Number.isNaN(ts)) {
    return null;
  }

  const inputTokens = num(usage.input_tokens);
  const outputTokens = num(usage.output_tokens);
  const cacheCreationTokens = num(usage.cache_creation_input_tokens);
  const cacheReadTokens = num(usage.cache_read_input_tokens);
  const totalTokens = inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens;

  if (totalTokens === 0) {
    return null;
  }

  const messageId = obj?.message?.id;
  const requestId = obj?.requestId;
  const dedupKey =
    messageId && requestId ? `${messageId}:${requestId}` : String(obj?.uuid ?? `${ts}:${totalTokens}`);

  return {
    timestamp: ts,
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    totalTokens,
    dedupKey,
  };
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

interface FileCacheEntry {
  /** Byte offset already consumed. */
  size: number;
  /** Entries parsed from this file so far. */
  entries: UsageEntry[];
}

/**
 * Reads usage entries from `~/.claude/projects/*​/*.jsonl`, incrementally.
 * Keeps a per-file cache so growing files are only tail-read on subsequent calls.
 */
export class UsageReader {
  private readonly cache = new Map<string, FileCacheEntry>();

  constructor(private claudeDir: string) {}

  setClaudeDir(dir: string): void {
    if (dir !== this.claudeDir) {
      this.claudeDir = dir;
      this.cache.clear();
    }
  }

  get projectsDir(): string {
    return path.join(this.claudeDir, "projects");
  }

  /**
   * Returns deduped usage entries with `timestamp >= sinceMs`.
   * Only files modified since `sinceMs` are (re)read.
   */
  read(sinceMs: number): UsageEntry[] {
    const files = this.recentJsonlFiles(sinceMs);
    const byKey = new Map<string, UsageEntry>();

    for (const file of files) {
      const entries = this.readFileIncremental(file);
      for (const e of entries) {
        if (e.timestamp >= sinceMs) {
          byKey.set(e.dedupKey, e);
        }
      }
    }

    return [...byKey.values()].sort((a, b) => a.timestamp - b.timestamp);
  }

  /** All `.jsonl` files under projects/ whose mtime is at or after `sinceMs`. */
  private recentJsonlFiles(sinceMs: number): string[] {
    const root = this.projectsDir;
    let projectDirs: string[];
    try {
      projectDirs = fs.readdirSync(root, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => path.join(root, d.name));
    } catch {
      return []; // ~/.claude/projects may not exist yet
    }

    const result: string[] = [];
    for (const dir of projectDirs) {
      let files: fs.Dirent[];
      try {
        files = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const f of files) {
        if (!f.isFile() || !f.name.endsWith(".jsonl")) {
          continue;
        }
        const full = path.join(dir, f.name);
        try {
          if (fs.statSync(full).mtimeMs >= sinceMs) {
            result.push(full);
          }
        } catch {
          // file vanished between readdir and stat — ignore
        }
      }
    }
    return result;
  }

  /** Reads only the new tail of a file since the last read; returns all parsed entries. */
  private readFileIncremental(file: string): UsageEntry[] {
    let size: number;
    try {
      size = fs.statSync(file).size;
    } catch {
      return [];
    }

    const cached = this.cache.get(file);
    if (cached && cached.size === size) {
      return cached.entries;
    }

    // If the file shrank (rotated/truncated), reparse from scratch.
    const startOffset = cached && size > cached.size ? cached.size : 0;
    const baseEntries = startOffset > 0 && cached ? cached.entries : [];

    let buf: Buffer;
    try {
      const fd = fs.openSync(file, "r");
      try {
        const length = size - startOffset;
        buf = Buffer.alloc(length);
        fs.readSync(fd, buf, 0, length, startOffset);
      } finally {
        fs.closeSync(fd);
      }
    } catch {
      return baseEntries;
    }

    // Only consume up to the last complete line (last newline). A partially
    // written trailing line is left for the next read by not advancing past it.
    const lastNl = buf.lastIndexOf(0x0a); // '\n'
    const committedLen = lastNl >= 0 ? lastNl + 1 : 0;
    const committedSize = startOffset + committedLen;
    const text = buf.toString("utf8", 0, committedLen);

    const newEntries: UsageEntry[] = [];
    for (const line of text.split("\n")) {
      const entry = parseUsageLine(line);
      if (entry) {
        newEntries.push(entry);
      }
    }

    const entries = baseEntries.concat(newEntries);
    this.cache.set(file, { size: committedSize, entries });
    return entries;
  }
}
