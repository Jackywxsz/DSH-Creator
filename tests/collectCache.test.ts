import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  decodeCollectCacheScope,
  loadCollectCache,
  nextCollectCacheScope,
  saveCollectCache,
} from "../src/collectCache.ts";

describe("collect cache scope", () => {
  it("treats a missing scope as partial", () => {
    expect(decodeCollectCacheScope(undefined)).toBe("partial");
    expect(nextCollectCacheScope(undefined, true)).toBe("partial");
    expect(nextCollectCacheScope("library", true)).toBe("library");
    expect(nextCollectCacheScope("partial", false)).toBe("library");
  });

  it("round-trips scope", async () => {
    const dir = await mkdtemp(join(tmpdir(), "oil-collect-cache-"));
    await saveCollectCache(dir, {
      collected: [{ platform: "wechat", items: [{ platform: "wechat", title: "一期" }] }],
    }, { scope: "partial" });
    const loaded = await loadCollectCache(dir);
    expect(loaded?.scope).toBe("partial");
    expect(loaded?.result.collected[0]?.items[0]?.title).toBe("一期");
  });
});
