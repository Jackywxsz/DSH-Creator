import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { describe, expect, it, vi } from "vitest";

import {
  createDebounced,
  shouldIgnoreWatchName,
  startLibraryWatch,
  WATCH_DEBOUNCE_MS,
} from "../src/libraryWatch.ts";

describe("shouldIgnoreWatchName", () => {
  it("keeps real library files", () => {
    expect(shouldIgnoreWatchName("2026-08-16_demo/cover_3x4.png")).toBe(false);
    expect(shouldIgnoreWatchName("2026-08-16_demo/publish-package.json")).toBe(false);
    expect(shouldIgnoreWatchName(null)).toBe(false);
  });

  it("drops finder and export noise", () => {
    expect(shouldIgnoreWatchName(".DS_Store")).toBe(true);
    expect(shouldIgnoreWatchName("2026-08-16_demo/.DS_Store")).toBe(true);
    expect(shouldIgnoreWatchName("clip.mp4.part")).toBe(true);
    expect(shouldIgnoreWatchName("demo.screenstudio/project.json")).toBe(true);
    expect(shouldIgnoreWatchName("._cover.png")).toBe(true);
    expect(shouldIgnoreWatchName("2026-08-16_demo/script.md")).toBe(true);
    expect(shouldIgnoreWatchName("2026-08-16_demo/topic.md")).toBe(true);
  });
});

describe("createDebounced", () => {
  it("collapses a burst into one call", async () => {
    vi.useFakeTimers();
    const run = vi.fn();
    const debounce = createDebounced(run, 100);
    debounce.trigger();
    debounce.trigger();
    debounce.trigger();
    expect(run).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(100);
    expect(run).toHaveBeenCalledTimes(1);
    debounce.cancel();
    vi.useRealTimers();
  });
});

describe("startLibraryWatch", () => {
  it("notifies after a library file change", async () => {
    const root = join(tmpdir(), `oil-watch-${Date.now()}`);
    const dataDir = join(root, "data");
    const libraryRoot = join(root, "library");
    await mkdir(libraryRoot, { recursive: true });
    await mkdir(dataDir, { recursive: true });
    const overlayPath = join(dataDir, "overlay.json");
    await writeFile(overlayPath, "{}\n");

    const seen: number[] = [];
    const handle = startLibraryWatch({
      libraryRoot,
      overlayPath,
      onChange: () => {
        seen.push(Date.now());
      },
      debounceMs: 80,
    });
    await writeFile(join(libraryRoot, "note.md"), "hello\n");
    await delay(WATCH_DEBOUNCE_MS + 400);
    handle.close();
    expect(seen.length).toBeGreaterThan(0);
  });
});
