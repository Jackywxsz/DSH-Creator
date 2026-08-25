import { describe, expect, it } from "vitest";

import {
  contentProgress,
  contentStepIsSkipped,
  readTopicSummary,
  replaceTopicCore,
} from "../src/client/contentWorkflow.ts";
import type { ContentDetail } from "../src/types.ts";

function detail(overrides: Partial<ContentDetail> = {}): ContentDetail {
  return {
    id: "2026-08-25_demo",
    folderPath: "/tmp/2026-08-25_demo",
    title: "测试选题",
    recordedAt: 1,
    createdMs: 1,
    covers: {},
    subtitles: {},
    presentations: {},
    hasPublishPackage: false,
    hasArticle: false,
    waitingForExport: false,
    skippedSteps: [],
    tags: [],
    pipeline: "raw",
    workflow: "idle",
    publish: {
      bilibili: { status: "unpublished", source: "none" },
      douyin: { status: "unpublished", source: "none" },
      wechat: { status: "unpublished", source: "none" },
      xiaohongshu: { status: "unpublished", source: "none" },
    },
    burn: { status: "idle" },
    subtitleJob: { status: "idle" },
    coverJob: { status: "idle" },
    publishCopy: "",
    topicNote: "",
    script: "",
    article: "",
    secrets: {
      subtitle: { kind: "subtitle", ref: "", configured: false, writable: false },
      cover: { kind: "cover", ref: "", configured: false, writable: false },
    },
    ...overrides,
  };
}

describe("topic summary editing", () => {
  it("replaces the first meaningful line without losing the rest of topic.md", () => {
    const source = "# 测试选题\n\n旧的一句话\n\n## 证据\n- 案例 A\n";
    expect(readTopicSummary(source, "测试选题")).toMatchObject({
      core: "旧的一句话",
      note: "证据 案例 A",
    });
    expect(replaceTopicCore(source, "测试选题", "新的一句话")).toBe(
      "# 测试选题\n\n新的一句话\n\n## 证据\n- 案例 A\n",
    );
  });

  it("creates the first core line when topic.md is empty", () => {
    expect(replaceTopicCore("", "测试选题", "一句话核心")).toBe("一句话核心\n");
  });

  it("inserts a missing core before structured sections instead of overwriting a heading", () => {
    const source = "# 测试选题\n\n## 证据\n- 案例 A\n";
    expect(readTopicSummary(source, "测试选题")).toEqual({ core: "", note: "证据 案例 A" });
    expect(replaceTopicCore(source, "测试选题", "补上的核心")).toBe(
      "# 测试选题\n\n补上的核心\n\n## 证据\n- 案例 A\n",
    );
  });

  it("prefers an explicit core section over introductory copy", () => {
    const source = "# 测试选题\n\n这是背景说明。\n\n## 一句话核心\n明确的旧核心\n\n## 证据\n- 案例 A\n";
    expect(readTopicSummary(source, "测试选题")).toEqual({
      core: "明确的旧核心",
      note: "这是背景说明。 证据 案例 A",
    });
    expect(replaceTopicCore(source, "测试选题", "明确的新核心")).toContain(
      "## 一句话核心\n明确的新核心",
    );
  });
});

describe("content asset progress", () => {
  it("starts at script after the topic exists", () => {
    const progress = contentProgress(detail(), false);
    expect(progress.current).toBe("script");
    expect(progress.steps.map((step) => step.id)).toEqual([
      "topic",
      "script",
      "presentation",
      "video",
      "subtitle",
      "cover",
      "article",
      "publish",
    ]);
  });

  it("treats presentation, subtitle, and article skips as completed choices", () => {
    const progress = contentProgress(detail({
      script: "成稿",
      videoRaw: "/tmp/final.mp4",
      covers: { "3x4": "/tmp/cover.png" },
      skippedSteps: ["presentation", "subtitle", "article"],
    }), false);
    expect(progress.current).toBe("publish");
    expect(progress.steps.filter((step) => step.status === "skipped").map((step) => step.id))
      .toEqual(["presentation", "subtitle", "article"]);
  });

  it("lets real assets win over stale skip state", () => {
    const next = detail({
      script: "成稿",
      presentations: { "16x9": "/tmp/presentation.html" },
      skippedSteps: ["presentation"],
    });
    const progress = contentProgress(next, false);
    expect(progress.steps.find((step) => step.id === "presentation")?.status).toBe("done");
    expect(contentStepIsSkipped(next, "presentation")).toBe(false);
  });
});
