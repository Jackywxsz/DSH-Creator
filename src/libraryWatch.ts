import { watch, type FSWatcher } from "node:fs";
import { basename, dirname } from "node:path";

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
    if (part === "script.md" || part === "topic.md") return true;
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
}): { close: () => void } {
  const debounce = createDebounced(options.onChange, options.debounceMs ?? WATCH_DEBOUNCE_MS);
  const watchers: FSWatcher[] = [];

  const attach = (path: string, recursive: boolean, accept?: (filename: string | null) => boolean): void => {
    try {
      const watcher = watch(path, { persistent: false, recursive }, (_event, filename) => {
        const name = typeof filename === "string" ? filename : null;
        if (accept !== undefined && !accept(name)) return;
        if (shouldIgnoreWatchName(name)) return;
        debounce.trigger();
      });
      watcher.on("error", () => undefined);
      watchers.push(watcher);
    } catch {
      // Some volumes do not support fs.watch.
    }
  };

  attach(options.libraryRoot, true);
  const overlayName = basename(options.overlayPath);
  attach(dirname(options.overlayPath), false, (filename) => (
    filename === null || filename === overlayName
  ));

  let fallback: ReturnType<typeof setInterval> | undefined;
  if (watchers.length === 0) {
    fallback = setInterval(() => {
      options.onChange();
    }, options.fallbackMs ?? WATCH_FALLBACK_MS);
    fallback.unref?.();
  }

  return {
    close() {
      debounce.cancel();
      if (fallback !== undefined) clearInterval(fallback);
      for (const watcher of watchers) watcher.close();
    },
  };
}
