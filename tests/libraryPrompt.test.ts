import { describe, expect, it } from "vitest";

import {
  libraryConventionText,
  registerLibraryPrompt,
  resolvePromptLibraryRoot,
} from "../src/libraryPrompt.ts";

describe("libraryConventionText", () => {
  it("names the library and tells the model to use file tools", () => {
    const text = libraryConventionText("/Movies/视频项目", "/.dsh-oil-creator");
    expect(text).toContain("/Movies/视频项目");
    expect(text).toContain("YYYY-MM-DD_可读标题");
    expect(text).toContain("script.md");
    expect(text).toContain("公众号文章/");
    expect(text).toContain("系统自带的列文件、读文件、写文件工具");
    expect(text).toContain("/.dsh-oil-creator/overlay.json");
    expect(text).not.toContain("oil_get_content");
    expect(text).not.toContain("oil_list_contents");
  });
});

describe("resolvePromptLibraryRoot", () => {
  it("prefers the scanned library root", () => {
    expect(resolvePromptLibraryRoot({
      libraryRoot: "/default",
      dataDir: "/data",
      cache: { libraryRoot: "/chosen" },
    })).toBe("/chosen");
  });
});

describe("registerLibraryPrompt", () => {
  it("registers a stable oil:library section", () => {
    const seen: Array<{ name: string; order: number; text: string }> = [];
    registerLibraryPrompt({
      systemPrompt: {
        section(section) {
          const text = typeof section.text === "function" ? section.text() : section.text;
          seen.push({ name: section.name, order: section.order, text });
          return () => undefined;
        },
      },
    }, { libraryRoot: "/lib", dataDir: "/data" });
    expect(seen).toEqual([{
      name: "oil:library",
      order: 120,
      text: libraryConventionText("/lib", "/data"),
    }]);
  });
});
