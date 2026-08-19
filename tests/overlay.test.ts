import { mkdir, readFile } from "node:fs/promises";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import {
  decodeOverlay,
  decodeProfile,
  emptyProfile,
  emptyOverlay,
  loadOverlay,
  normalizeEnabledPlatforms,
  overlayPath,
  profileIsEmpty,
  saveOverlay,
  withOverlayLock,
} from "../src/overlay.ts";
import { creatorProfileSchema } from "../src/schemas.ts";

describe("creator profile", () => {
  it("enables all supported platforms by default", () => {
    expect(emptyProfile()).toEqual({
      enabledPlatforms: ["xiaohongshu", "douyin", "bilibili", "wechat"],
    });
    expect(decodeProfile(undefined)).toEqual(emptyProfile());
  });

  it("deduplicates enabled platforms and filters invalid values", () => {
    expect(normalizeEnabledPlatforms([
      "wechat",
      "invalid",
      "douyin",
      "douyin",
      "youtube",
    ])).toEqual(["douyin", "wechat"]);
  });

  it.each([
    ["empty legacy platforms", { platforms: {} }],
    ["partial legacy homepages", {
      name: "Example Creator",
      platforms: {
        xiaohongshu: "https://xiaohongshu.example/creator",
        bilibili: "https://bilibili.example/creator",
      },
    }],
  ])("ignores %s and defaults all platforms", (_label, legacy) => {
    expect(decodeProfile(legacy)).toEqual(emptyProfile());
    expect(decodeOverlay({ profile: legacy, items: {} }).profile).toEqual(emptyProfile());
  });

  it("keeps an explicit empty enabled list", () => {
    const overlay = decodeOverlay({ profile: { name: "ignored", enabledPlatforms: [] }, items: {} });
    expect(overlay.profile).toEqual({ enabledPlatforms: [] });
    expect(profileIsEmpty(overlay.profile!)).toBe(true);
  });

  it("validates only the new profile shape", () => {
    expect(creatorProfileSchema.parse({
      name: "ignored",
      enabledPlatforms: ["xiaohongshu", "wechat"],
    })).toEqual({ enabledPlatforms: ["xiaohongshu", "wechat"] });
    expect(() => creatorProfileSchema.parse({ platforms: {} })).toThrow();
  });
});

describe("script rules", () => {
  it("round-trips through save and load", async () => {
    const dir = await mkdtemp(join(tmpdir(), "oil-overlay-"));
    const store = emptyOverlay();
    store.scriptRules = "口语化，少用术语。";
    await saveOverlay(dir, store);
    expect((await loadOverlay(dir)).scriptRules).toBe("口语化，少用术语。");
  });

  it("trims and drops empty rules when decoding", () => {
    expect(decodeOverlay({ scriptRules: "  开头抛结论。  " }).scriptRules).toBe("开头抛结论。");
    expect(decodeOverlay({ scriptRules: "   " }).scriptRules).toBeUndefined();
    expect(decodeOverlay({}).scriptRules).toBeUndefined();
  });
});

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
