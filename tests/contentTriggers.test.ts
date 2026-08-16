import { describe, expect, it } from "vitest";

import { chipLabel, registerContentTriggers } from "../src/client/contentTriggers.ts";

describe("chipLabel", () => {
  it("keeps short names that fit the composer chip", () => {
    expect(chipLabel("当前详情")).toBe("当前详情");
    expect(chipLabel("当前内容")).toBe("当前内容");
    expect(chipLabel("DeepSeek")).toBe("DeepSeek");
  });

  it("prefixes long titles so the 4em chip is not center-clipped", () => {
    expect(chipLabel("DeepSeek Harness 安装上手和使用心得")).toBe("DeepSee…");
    expect(chipLabel("如何用 AI 视频做有趣的交互动画？")).toBe("如何用…");
  });
});

describe("registerContentTriggers", () => {
  it("registers a /current content slash command", async () => {
    const sources: Array<{ trigger: string; name: string; candidates: Function; codec?: { clipboardText: (ref: string) => string } }> = [];
    registerContentTriggers(
      {
        registerSource(src) {
          sources.push(src);
          return () => undefined;
        },
      },
      async () => {
        throw new Error("unused");
      },
      async () => [],
    );
    const slash = sources.find((src) => src.trigger === "/");
    expect(slash?.name).toBe("oil");
    const items = await slash?.candidates(undefined, { query: "", signal: new AbortController().signal });
    expect(items).toEqual([{
      name: "current content",
      description: "把当前打开的内容交给对话",
    }]);
    expect(slash?.codec?.clipboardText("current")).toBe("/current content");
  });

  it("puts a short chip label on @ picks and keeps the full title on the clipboard", () => {
    const sources: Array<{ trigger: string; onPick: (pick: { candidate: { name: string; description?: string } }) => unknown }> = [];
    registerContentTriggers(
      {
        registerSource(src) {
          sources.push(src);
          return () => undefined;
        },
      },
      async () => {
        throw new Error("unused");
      },
      async () => [],
    );
    const at = sources.find((src) => src.trigger === "@");
    expect(at?.onPick({
      candidate: {
        name: "DeepSeek Harness 安装上手和使用心得",
        description: "2026-08-14_DeepSeek Harness 安装上手和使用心得",
      },
    })).toEqual({
      insert: {
        source: "oil",
        ref: "2026-08-14_DeepSeek Harness 安装上手和使用心得",
        label: "DeepSee…",
        clipboardText: "@DeepSeek Harness 安装上手和使用心得",
      },
    });
  });

  it("serializes a pick to the folder path", async () => {
    const sources: Array<{ codec?: { serialize: (ref: string, signal: AbortSignal) => Promise<string> } }> = [];
    registerContentTriggers(
      {
        registerSource(src) {
          sources.push(src);
          return () => undefined;
        },
      },
      async () => ({
        folderPath: "/tmp/videos/2026-08-10_做海外社媒第一个月经验分享",
      } as never),
      async () => [],
    );
    const path = await sources[0]?.codec?.serialize(
      "2026-08-10_做海外社媒第一个月经验分享",
      new AbortController().signal,
    );
    expect(path).toBe("/tmp/videos/2026-08-10_做海外社媒第一个月经验分享");
  });
});
