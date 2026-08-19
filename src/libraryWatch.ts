import { watch, type FSWatcher } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

export const WATCH_DEBOUNCE_MS = 500;
export const WATCH_FALLBACK_MS = 4000;

const NOISE_FILE = /^(?:\.DS_Store|Thumbs\.db)$/i;
const NOISE_EXT = /\.(?:tmp|temp|part|crdownload|download)$/i;

export function shouldIgnoreWatchName(name: string | null): boolean {
  if (name === null || name === "") return false;
  for (const part of name.split(/[\\/]/)) {
    if (part === "" || part === ".") continue;
    if (NOISE_FILE.test(part) || part.startsWith("._")) return true;
    if (part === ".screenstudio" || part.endsWith(".screenstudio")) return true;
    if (part === "node_modules" || part === ".git") return true;
    if (NOISE_EXT.test(part) || part.startsWith("~")) return true;
  }
  return false;
}

export function createDebounced(run: () => void, waitMs: number): {
  trigger: () => void;
  cancel: () => void;
} {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    trigger() {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        run();
      }, waitMs);
    },
    cancel() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
  };
}

export function startLibraryWatch(options: {
  libraryRoot: string;
  overlayPath: string;
  onChange: () => void;
  debounceMs?: number;
  fallbackMs?: number;
  watchFileSystem?: typeof watch;
  fingerprint?: (libraryRoot: string, overlayPath: string) => Promise<string>;
}): { ready: Promise<void>; close: () => void } {
  const debounce = createDebounced(options.onChange, options.debounceMs ?? WATCH_DEBOUNCE_MS);
  const watchers: FSWatcher[] = [];
  const watchFileSystem = options.watchFileSystem ?? watch;
  const fingerprintOf = options.fingerprint ?? libraryFingerprint;

  let closed = false;
  let polling = false;
  let fingerprint: string | undefined;
  let fallback: ReturnType<typeof setInterval> | undefined;
  let startupCheck: ReturnType<typeof setTimeout> | undefined;
  let ready = Promise.resolve();
  const poll = async (): Promise<void> => {
    if (closed || polling) return;
    polling = true;
    try {
      const next = await fingerprintOf(options.libraryRoot, options.overlayPath);
      if (fingerprint !== undefined && next !== fingerprint) debounce.trigger();
      fingerprint = next;
    } finally {
      polling = false;
    }
  };
  const startFallback = (): void => {
    if (closed || fallback !== undefined) return;
    if (startupCheck !== undefined) clearTimeout(startupCheck);
    ready = poll();
    fallback = setInterval(() => { void poll(); }, options.fallbackMs ?? WATCH_FALLBACK_MS);
    fallback.unref?.();
  };

  const attach = (
    path: string,
    recursive: boolean,
    accept?: (filename: string | null) => boolean,
    onError?: () => void,
  ): boolean => {
    try {
      const watcher = watchFileSystem(path, { persistent: false, recursive }, (_event, filename) => {
        const name = typeof filename === "string" ? filename : null;
        if (accept !== undefined && !accept(name)) return;
        if (shouldIgnoreWatchName(name)) return;
        debounce.trigger();
      });
      watcher.on("error", () => { onError?.(); });
      watchers.push(watcher);
      return true;
    } catch {
      // Some volumes do not support fs.watch.
      return false;
    }
  };

  const recursiveLibraryWatch = attach(options.libraryRoot, true, undefined, startFallback);
  // macOS FSEvents can occasionally miss a file created in the watched root
  // immediately after a recursive subscription. A second non-recursive watch
  // closes that root-level gap; duplicate events are collapsed by debounce.
  attach(options.libraryRoot, false);
  const overlayName = basename(options.overlayPath);
  const overlayWatch = attach(
    dirname(options.overlayPath),
    false,
    (filename) => filename === null || filename === overlayName,
    startFallback,
  );
  if (!recursiveLibraryWatch || !overlayWatch) {
    startFallback();
  } else {
    // Keep one delayed fingerprint check for the subscription startup race.
    // Continuous full-library polling is reserved for unsupported watchers.
    ready = poll();
    void ready.then(() => {
      if (closed || fallback !== undefined) return;
      startupCheck = setTimeout(() => {
        startupCheck = undefined;
        void poll();
      }, options.fallbackMs ?? WATCH_FALLBACK_MS);
      startupCheck.unref?.();
    });
  }

  return {
    ready,
    close() {
      closed = true;
      debounce.cancel();
      if (fallback !== undefined) clearInterval(fallback);
      if (startupCheck !== undefined) clearTimeout(startupCheck);
      for (const watcher of watchers) watcher.close();
    },
  };
}

async function libraryFingerprint(libraryRoot: string, overlayPath: string): Promise<string> {
  const rows: string[] = [];
  const visit = async (directory: string, prefix: string): Promise<void> => {
    const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const relative = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (shouldIgnoreWatchName(relative)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path, relative);
        continue;
      }
      const info = await stat(path).catch(() => undefined);
      if (info !== undefined) rows.push(`${relative}:${info.size}:${info.mtimeMs}`);
    }
  };
  await visit(libraryRoot, "");
  const overlay = await stat(overlayPath).catch(() => undefined);
  rows.push(`overlay:${overlay?.size ?? -1}:${overlay?.mtimeMs ?? -1}`);
  return rows.join("|");
}
