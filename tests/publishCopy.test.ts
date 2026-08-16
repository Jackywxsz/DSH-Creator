import { describe, expect, it } from "vitest";

import { parsePublishCopy } from "../src/client/publishCopy.ts";

describe("parsePublishCopy", () => {
  it("returns empty fields for blank input", () => {
    expect(parsePublishCopy("  \n")).toEqual({ body: "", tags: [] });
  });

  it("lifts a short first paragraph as title and collects hashtag lines", () => {
    const parsed = parsePublishCopy([
      "DeepSeek Harness 安装上手",
      "",
      "从零安装 DeepSeek Harness。",
      "",
      "#DeepSeek #AI工具",
    ].join("\n"));
    expect(parsed.title).toBe("DeepSeek Harness 安装上手");
    expect(parsed.body).toBe("从零安装 DeepSeek Harness。");
    expect(parsed.tags).toEqual(["DeepSeek", "AI工具"]);
  });

  it("keeps a long opening paragraph in the body", () => {
    const line = "这是一段很长的开头，不应该被当成标题来展示，因为已经超过了短标题的长度限制，需要继续留在正文里。";
    const parsed = parsePublishCopy(line);
    expect(parsed.title).toBeUndefined();
    expect(parsed.body).toBe(line);
  });
});
