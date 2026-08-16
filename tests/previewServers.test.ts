import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  livePreviewRecord,
  loadPreviewRegistry,
  parsePreviewRegistry,
  upsertPreviewRecord,
} from "../src/previewServers.ts";

describe("previewServers", () => {
  it("keeps a live preview and drops a dead pid", () => {
    const file = join(mkdtempSync(join(tmpdir(), "oil-preview-")), "preview-servers.json");
    upsertPreviewRecord(file, {
      id: "alive",
      url: "http://127.0.0.1:9",
      port: 9,
      pid: process.pid,
      startedAt: 1,
    });
    upsertPreviewRecord(file, {
      id: "dead",
      url: "http://127.0.0.1:8",
      port: 8,
      pid: 99999999,
      startedAt: 1,
    });
    const rows = loadPreviewRegistry(file);
    expect(rows.some((row) => row.id === "alive")).toBe(true);
    expect(livePreviewRecord(rows, "dead")).toBeUndefined();
    expect(parsePreviewRegistry("nope")).toEqual([]);
  });
});
