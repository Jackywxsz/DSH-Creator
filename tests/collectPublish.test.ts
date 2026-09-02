import { describe, expect, it } from "vitest";

import { cacheIsFresh } from "../src/collectCache.ts";
import {
  applyMatchesToOverlay,
  buildSyncPlatformResults,
  collectedHitsTarget,
  dedupeCollectedPosts,
  filterCollected,
  filterMatchItems,
  formatCount,
  knownFromPublish,
  matchCollected,
  mergeCollected,
  normalizeTitle,
  parseCollectOutput,
  rankCollectedCandidates,
  titleScore,
  unionCollected,
  cacheCoversTargets,
  usablePublishUrl,
  WECHAT_LIST_URL,
} from "../src/collectPublish.ts";

describe("normalizeTitle", () => {
  it("drops punctuation and case", () => {
    expect(normalizeTitle("DeepSeek-Harness 上手！")).toBe("deepseekharness上手");
  });
});

describe("titleScore", () => {
  it("scores exact titles as 1", () => {
    expect(titleScore("DeepSeek Harness", "deepseek harness")).toBe(1);
  });

  it("scores a contained title high enough to match", () => {
    expect(titleScore("DeepSeek Harness 安装上手", "DeepSeek Harness")).toBeGreaterThanOrEqual(0.85);
  });
});

describe("matchCollected", () => {
  it("prefers a stored remote id over title", () => {
    const matches = matchCollected(
      [
        {
          id: "local",
          title: "completely different",
          known: { wechat: { remoteId: "export/abc" } },
        },
      ],
      [
        {
          platform: "wechat",
          items: [{ platform: "wechat", title: "线上标题", remoteId: "export/abc", views: 10 }],
        },
      ],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.post.remoteId).toBe("export/abc");
    expect(matches[0]?.score).toBe(1);
  });

  it("pairs each local title to at most one remote post", () => {
    const matches = matchCollected(
      [
        { id: "a", title: "DeepSeek Harness 安装上手" },
        { id: "b", title: "油猴脚本入门" },
      ],
      [
        {
          platform: "wechat",
          items: [
            { platform: "wechat", title: "DeepSeek Harness 安装上手", views: 1200 },
            { platform: "wechat", title: "别的视频", views: 9 },
          ],
        },
      ],
    );
    expect(matches).toHaveLength(1);
    expect(matches[0]?.id).toBe("a");
    expect(matches[0]?.post.views).toBe(1200);
  });
});

describe("rankCollectedCandidates", () => {
  it("returns a small ranked set for manual binding without auto-matching low confidence posts", () => {
    const candidates = rankCollectedCandidates("本地工程名", [
      {
        platform: "douyin",
        items: [
          { platform: "douyin", title: "完全不同但较新的作品", remoteId: "new", url: "https://www.douyin.com/video/new", views: 72, publishedAt: 3_000 },
          { platform: "douyin", title: "本地工程实战", remoteId: "related", url: "https://www.douyin.com/video/related", likes: 9, publishedAt: 2_000 },
          { platform: "douyin", title: "另一条", remoteId: "old", publishedAt: 1_000 },
        ],
      },
    ], 2);

    expect(candidates).toHaveLength(2);
    expect(candidates[0]).toMatchObject({
      platform: "douyin",
      title: "本地工程实战",
      url: "https://www.douyin.com/video/related",
      remoteId: "related",
      likes: 9,
    });
    expect(candidates[1]?.remoteId).toBe("new");
  });
});

describe("buildSyncPlatformResults", () => {
  it("keeps per-platform errors and explains a fetched page with zero matches", () => {
    expect(buildSyncPlatformResults([
      {
        platform: "douyin",
        items: Array.from({ length: 72 }, (_, index) => ({
          platform: "douyin" as const,
          title: `作品 ${index}`,
          remoteId: String(index),
        })),
      },
      { platform: "bilibili", items: [], error: "B站作品接口返回 HTML" },
      { platform: "wechat", items: [], loginRequired: true },
    ], [])).toEqual([
      { platform: "douyin", count: 72, matched: 0, noMatchReason: "titleMismatch" },
      { platform: "bilibili", count: 0, matched: 0, error: "B站作品接口返回 HTML" },
      { platform: "wechat", count: 0, matched: 0, loginRequired: true },
    ]);
  });
});

describe("filterMatchItems", () => {
  it("keeps only the requested episode", () => {
    const items = [
      { id: "a", title: "A" },
      { id: "b", title: "B" },
    ];
    expect(filterMatchItems(items, "b")).toEqual([{ id: "b", title: "B" }]);
    expect(filterMatchItems(items).map((item) => item.id)).toEqual(["a", "b"]);
  });
});

describe("collectedHitsTarget", () => {
  it("stops when the episode title is already on the page", () => {
    expect(collectedHitsTarget(
      [{ platform: "wechat", title: "DeepSeek Harness 安装上手" }],
      [{ title: "DeepSeek Harness 安装上手" }],
    )).toBe(true);
    expect(collectedHitsTarget(
      [{ platform: "wechat", title: "别的视频" }],
      [{ title: "DeepSeek Harness 安装上手" }],
    )).toBe(false);
  });
});

describe("unionCollected", () => {
  it("keeps older posts when a scoped scrape only returns a page", () => {
    const merged = unionCollected(
      {
        collected: [{
          platform: "wechat",
          items: [{ platform: "wechat", title: "旧作", remoteId: "old" }],
        }],
      },
      {
        collected: [{
          platform: "wechat",
          items: [{ platform: "wechat", title: "新作", remoteId: "new" }],
        }],
      },
    );
    expect(merged.collected[0]?.items.map((item) => item.remoteId)).toEqual(["old", "new"]);
  });

  it("lets a scoped scrape replace stale metrics for the same remote post", () => {
    const merged = unionCollected(
      {
        collected: [{
          platform: "wechat",
          items: [
            { platform: "wechat", title: "目标作品", remoteId: "same", views: 10, likes: 2 },
            { platform: "wechat", title: "历史作品", remoteId: "old", views: 5 },
          ],
        }],
      },
      {
        collected: [{
          platform: "wechat",
          items: [{ platform: "wechat", title: "目标作品", remoteId: "same", views: 99, likes: 8 }],
        }],
      },
    );

    expect(merged.collected[0]?.items).toEqual([
      { platform: "wechat", title: "目标作品", remoteId: "same", views: 99, likes: 8 },
      { platform: "wechat", title: "历史作品", remoteId: "old", views: 5 },
    ]);
  });
});

describe("cacheCoversTargets", () => {
  it("rejects a scoped cache that never saw this episode", () => {
    expect(cacheCoversTargets(
      { collected: [{ platform: "wechat", items: [{ platform: "wechat", title: "别的视频" }] }] },
      [{ title: "DeepSeek Harness 安装上手" }],
    )).toBe(false);
  });

  it("does not let a partial scrape satisfy a library-wide request", () => {
    const result = {
      collected: [{ platform: "wechat" as const, items: [{ platform: "wechat" as const, title: "DeepSeek Harness 安装上手" }] }],
    };
    expect(cacheCoversTargets(result, undefined, "partial")).toBe(false);
    expect(cacheCoversTargets(result, undefined, "library")).toBe(true);
    expect(cacheCoversTargets(result, [{ title: "DeepSeek Harness 安装上手" }], "partial")).toBe(true);
  });
});

describe("usablePublishUrl", () => {
  it("does not replace a real URL with the WeChat list page", () => {
    expect(usablePublishUrl(WECHAT_LIST_URL, "https://example.com/post")).toBe("https://example.com/post");
  });
});

describe("parseCollectOutput", () => {
  it("reads the last JSON object with collected pages", () => {
    const raw = [
      "opening tabs",
      JSON.stringify({
        ok: true,
        collected: [
          {
            platform: "xiaohongshu",
            loginRequired: true,
            items: [],
          },
          {
            platform: "wechat",
            items: [{ title: "一期测试", url: "https://channels.weixin.qq.com/x", views: 88, publishedAt: 1_700_000_000_000 }],
          },
        ],
      }),
    ].join("\n");
    const parsed = parseCollectOutput(raw);
    expect(parsed.collected).toHaveLength(2);
    expect(parsed.collected[0]?.loginRequired).toBe(true);
    expect(parsed.collected[1]?.items[0]?.views).toBe(88);
    expect(parsed.collected[1]?.items[0]?.publishedAt).toBe(1_700_000_000_000);
  });

  it("preserves spaceClosed so a failed close stays registered", () => {
    const parsed = parseCollectOutput(JSON.stringify({
      ok: true,
      spaceClosed: false,
      collected: [{ platform: "wechat", items: [] }],
    }));
    expect(parsed.spaceClosed).toBe(false);
  });
});

describe("applyMatchesToOverlay", () => {
  it("marks matched platforms published and copies metrics", () => {
    const next = applyMatchesToOverlay({}, [
      {
        id: "2026-08-15_demo",
        platform: "wechat",
        score: 1,
        post: {
          platform: "wechat",
          title: "demo",
          url: "https://channels.weixin.qq.com/x",
          views: 3200,
          likes: 12,
        },
      },
    ], 1_700_000_000_000);
    expect(next["2026-08-15_demo"]?.publish?.wechat).toEqual({
      status: "published",
      url: "https://channels.weixin.qq.com/x",
      views: 3200,
      likes: 12,
      publishedAt: 1_700_000_000_000,
      syncedAt: 1_700_000_000_000,
    });
  });
});

describe("mergeCollected", () => {
  it("keeps other platforms when only one is refreshed", () => {
    const merged = mergeCollected(
      {
        collected: [
          { platform: "xiaohongshu", items: [{ platform: "xiaohongshu", title: "old-xhs" }] },
          { platform: "wechat", items: [{ platform: "wechat", title: "old-wechat" }] },
        ],
      },
      { collected: [{ platform: "wechat", items: [{ platform: "wechat", title: "new-wechat" }] }] },
      ["wechat"],
    );
    expect(merged.collected.map((page) => page.platform)).toEqual(["xiaohongshu", "wechat"]);
    expect(merged.collected[1]?.items[0]?.title).toBe("new-wechat");
  });
});

describe("knownFromPublish", () => {
  it("ignores platforms that were never written", () => {
    expect(knownFromPublish({
      wechat: { remoteId: "export/abc" },
    } as never)).toEqual({ wechat: { remoteId: "export/abc" } });
  });
});

describe("dedupeCollectedPosts", () => {
  it("keeps the first post for a remote id", () => {
    const items = dedupeCollectedPosts([
      { platform: "wechat", title: "old", remoteId: "a", views: 1 },
      { platform: "wechat", title: "new", remoteId: "a", views: 9 },
      { platform: "wechat", title: "other", remoteId: "b", views: 3 },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]?.views).toBe(1);
    expect(items[1]?.remoteId).toBe("b");
  });
});

describe("filterCollected", () => {
  it("returns only the requested platform", () => {
    const filtered = filterCollected({
      collected: [
        { platform: "douyin", items: [] },
        { platform: "wechat", items: [] },
      ],
    }, ["wechat"]);
    expect(filtered.collected).toEqual([{ platform: "wechat", items: [] }]);
  });
});

describe("cacheIsFresh", () => {
  it("expires after the ttl", () => {
    expect(cacheIsFresh(1000, 1000 + 10_000, 90_000)).toBe(true);
    expect(cacheIsFresh(1000, 1000 + 90_000, 90_000)).toBe(false);
  });
});

describe("formatCount", () => {
  it("uses 万 past ten thousand", () => {
    expect(formatCount(88)).toBe("88");
    expect(formatCount(12_300)).toBe("1.2万");
    expect(formatCount(1_200_000)).toBe("120万");
  });
});
