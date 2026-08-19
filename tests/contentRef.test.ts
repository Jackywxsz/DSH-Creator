import { describe, expect, it } from "vitest";

import { formatContentRef } from "../src/contentRef.ts";
import { emptyBurn, emptyPublish } from "../src/publishStatus.ts";
import type { ContentDetail } from "../src/types.ts";

function detail(patch: Partial<ContentDetail> = {}): ContentDetail {
  return {
    id: "2026-08-13_demo",
    folderPath: "/tmp/demo",
    title: "Demo",
    recordedAt: 1,
    covers: {},
    subtitles: {},
    hasPublishPackage: false,
    hasArticle: false,
    waitingForExport: false,
    tags: [],
    pipeline: "raw",
    workflow: "publish",
    publish: emptyPublish(),
    burn: emptyBurn(),
    subtitleJob: emptyBurn(),
    coverJob: emptyBurn(),
    publishCopy: "",
    topicNote: "",
    script: "",
    article: "",
    secrets: {
      subtitle: { kind: "subtitle", ref: "x", configured: false, writable: true },
      cover: { kind: "cover", ref: "y", configured: false, writable: true },
    },
    ...patch,
  };
}

describe("formatContentRef", () => {
  it("is the episode folder path", () => {
    expect(formatContentRef(detail({
      folderPath: "/Users/example/Movies/视频项目/2026-08-10_示例标题",
      topicNote: "不该出现",
      script: "不该出现",
      tags: ["AI工具"],
      article: "# 不该出现",
    }))).toBe("/Users/example/Movies/视频项目/2026-08-10_示例标题");
  });
});
