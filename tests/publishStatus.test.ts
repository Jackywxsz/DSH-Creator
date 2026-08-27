import { describe, expect, it } from "vitest";

import { decodeOverlay } from "../src/overlay.ts";
import {
  emptyPublish,
  mapPublisherStatus,
  mergePublish,
  nextPublishMark,
  patchOverlayPublish,
  pickAutoPublishName,
  publishFromAutoPublish,
} from "../src/publishStatus.ts";

describe("mapPublisherStatus", () => {
  it("maps ready to draft and live to published", () => {
    expect(mapPublisherStatus("ready")).toBe("draft");
    expect(mapPublisherStatus("READY")).toBe("draft");
    expect(mapPublisherStatus("published")).toBe("published");
    expect(mapPublisherStatus("blocked")).toBe("unpublished");
    expect(mapPublisherStatus("needs_mutation")).toBe("unpublished");
  });
});

describe("publishFromAutoPublish", () => {
  it("reads wechat_channels as wechat", () => {
    const publish = publishFromAutoPublish({
      publisher: {
        platforms: {
          xiaohongshu: { status: "ready" },
          wechat_channels: { status: "live", url: "https://channels.example/1" },
        },
      },
    });
    expect(publish.xiaohongshu).toEqual({ status: "draft", source: "publisher" });
    expect(publish.wechat).toEqual({
      status: "published",
      source: "publisher",
      url: "https://channels.example/1",
    });
    expect(publish.douyin.status).toBe("unpublished");
  });

  it("returns empty when the sidecar has no publisher block", () => {
    expect(publishFromAutoPublish({ title: "x" })).toEqual(emptyPublish());
  });
});

describe("mergePublish", () => {
  it("keeps overlay over the sidecar", () => {
    const file = publishFromAutoPublish({
      publisher: { platforms: { xiaohongshu: { status: "ready" } } },
    });
    expect(mergePublish(file, { xiaohongshu: { status: "unpublished" } }).xiaohongshu).toEqual({
      status: "unpublished",
      source: "overlay",
    });
  });
});

describe("nextPublishMark", () => {
  it("cycles the three marks", () => {
    expect(nextPublishMark("unpublished")).toBe("draft");
    expect(nextPublishMark("draft")).toBe("published");
    expect(nextPublishMark("published")).toBe("unpublished");
  });
});

describe("patchOverlayPublish", () => {
  it("updates an existing publication date when an explicit date is provided", () => {
    const next = patchOverlayPublish(
      { bilibili: { status: "published", publishedAt: 1_000 } },
      "bilibili",
      "published",
      undefined,
      3_000,
      2_000,
    );
    expect(next.bilibili?.publishedAt).toBe(2_000);
  });

  it("keeps an existing publication date when no explicit date is provided", () => {
    const next = patchOverlayPublish(
      { bilibili: { status: "published", publishedAt: 1_000 } },
      "bilibili",
      "published",
      undefined,
      3_000,
    );
    expect(next.bilibili?.publishedAt).toBe(1_000);
  });
});

describe("pickAutoPublishName", () => {
  it("prefers the canonical name", () => {
    expect(pickAutoPublishName(["foo.auto-publish.json", "auto-publish.json"]))
      .toBe("auto-publish.json");
    expect(pickAutoPublishName(["a.srt", "title.auto-publish.json"]))
      .toBe("title.auto-publish.json");
  });
});

describe("decodeOverlay", () => {
  it("keeps publish and burn fields", () => {
    const store = decodeOverlay({
      schemaVersion: 1,
      items: {
        demo: {
          publish: { douyin: { status: "published", url: "https://v.douyin.com/x" } },
          burn: { status: "running", pid: 12, output: "/tmp/a_subtitled.mp4" },
        },
      },
    });
    expect(store.items.demo?.publish).toEqual({
      douyin: { status: "published", url: "https://v.douyin.com/x" },
    });
    expect(store.items.demo?.burn).toEqual({
      status: "running",
      pid: 12,
      output: "/tmp/a_subtitled.mp4",
    });
  });
});
