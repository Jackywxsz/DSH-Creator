import { mkdir, readFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { emptyOverlay, loadOverlay, overlayPath, saveOverlay, withOverlayLock } from "../src/overlay.ts";

describe("overlay lock", () => {
  it("serializes overlapping writes", async () => {
    const dir = await mkdtemp(join(tmpdir(), "oil-overlay-"));
    await mkdir(dir, { recursive: true });
    const order: number[] = [];
    await Promise.all([0, 1, 2].map((index) => withOverlayLock(dir, async () => {
      const store = await loadOverlay(dir);
      store.items[String(index)] = { title: String(index) };
      await saveOverlay(dir, store);
      order.push(index);
    })));
    const raw = JSON.parse(await readFile(overlayPath(dir), "utf8")) as { items: Record<string, { title: string }> };
    expect(Object.keys(raw.items).sort()).toEqual(["0", "1", "2"]);
    expect(order.sort()).toEqual([0, 1, 2]);
  });
});
