import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  LEGACY_COLLECT_SPACE,
  collectCleanupNames,
  collectRegistryPathForDataDir,
  defaultCollectSpaceName,
  parseCollectRegistry,
  pidIsAlive,
  registerCollectSpace,
  unregisterCollectSpace,
} from "../src/collectSpaces.ts";

describe("collectSpaces", () => {
  it("keeps the collect registry inside the configured data directory", () => {
    expect(collectRegistryPathForDataDir("/tmp/oil-data")).toBe(
      "/tmp/oil-data/collect-spaces.json",
    );
  });

  it("builds a unique collect space name", () => {
    expect(defaultCollectSpaceName()).toMatch(/^oil-collect-[a-z0-9]+-[a-z0-9]+$/);
    expect(defaultCollectSpaceName()).not.toBe(defaultCollectSpaceName());
  });

  it("treats the current process as alive", () => {
    expect(pidIsAlive(process.pid)).toBe(true);
    expect(pidIsAlive(-1)).toBe(false);
  });

  it("registers live spaces and reports dead leftovers", () => {
    const file = join(mkdtempSync(join(tmpdir(), "oil-collect-spaces-")), "collect-spaces.json");
    writeFileSync(file, JSON.stringify([
      { name: "oil-collect-dead", pid: 99999999, startedAt: 1 },
      { name: "oil-collect-live", pid: process.pid, startedAt: 2 },
    ]));
    const stale = registerCollectSpace(file, { name: "oil-collect-now", pid: process.pid, startedAt: 3 });
    expect(stale).toEqual(["oil-collect-dead"]);
    unregisterCollectSpace(file, "oil-collect-now");
    const left = parseCollectRegistry(
      JSON.stringify([{ name: "oil-collect-live", pid: process.pid, startedAt: 2 }]),
    );
    expect(left).toHaveLength(1);
  });

  it("always includes the legacy shared collect name unless disabled", () => {
    expect(collectCleanupNames({ stale: ["oil-collect-dead"] })).toEqual([
      LEGACY_COLLECT_SPACE,
      "oil-collect-dead",
    ]);
    expect(collectCleanupNames({ extra: ["custom"], includeLegacy: false })).toEqual(["custom"]);
  });

  it("keeps every live row across sequential register calls", () => {
    const file = join(mkdtempSync(join(tmpdir(), "oil-collect-lock-")), "collect-spaces.json");
    const names = Array.from({ length: 8 }, (_, index) => `oil-collect-${index}`);
    for (const name of names) {
      registerCollectSpace(file, { name, pid: process.pid, startedAt: Date.now() });
    }
    const stored = JSON.parse(readFileSync(file, "utf8")) as Array<{ name: string }>;
    expect(stored.map((row) => row.name).sort()).toEqual([...names].sort());
    unregisterCollectSpace(file, "oil-collect-0");
    expect(JSON.parse(readFileSync(file, "utf8"))).toHaveLength(7);
  });
});
