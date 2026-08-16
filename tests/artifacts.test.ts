import { mkdir, writeFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";

import { describe, expect, it } from "vitest";

import {
  applyArtifactMoves,
  hyphenatedFolderName,
  pickArticleFile,
  pickPublishPackage,
  proposeArtifactMoves,
} from "../src/artifacts.ts";

describe("hyphenatedFolderName", () => {
  it("restores the pre-organize stem", () => {
    expect(hyphenatedFolderName("2025-09-21_去 ai 味儿")).toBe("2025-09-21_去-ai-味儿");
  });
});

describe("proposeArtifactMoves", () => {
  it("renames hyphen-prefixed media to the folder name", () => {
    const moves = proposeArtifactMoves("2025-09-21_去 ai 味儿", [
      "2025-09-21_去-ai-味儿.mp4",
    ]);
    expect(moves).toEqual([
      { from: "2025-09-21_去-ai-味儿.mp4", to: "2025-09-21_去 ai 味儿.mp4" },
    ]);
  });

  it("canonicalizes a publisher sidecar", () => {
    const moves = proposeArtifactMoves("2026-08-10_demo", [
      "demo.video-publisher.json",
    ]);
    expect(moves).toEqual([
      { from: "demo.video-publisher.json", to: "publish-package.json" },
    ]);
  });
});

describe("pickers", () => {
  it("prefers the finished article markdown", () => {
    expect(pickArticleFile([
      "标题.source.md",
      "标题.md",
      "标题.wechat.md",
    ])).toBe("标题.md");
  });

  it("prefers publish-package.json", () => {
    expect(pickPublishPackage([
      "a.video-publisher.json",
      "publish-package.json",
    ])).toBe("publish-package.json");
  });
});

describe("applyArtifactMoves", () => {
  it("renames files on disk", async () => {
    const root = await mkdtemp(join(tmpdir(), "oil-art-"));
    const folder = join(root, "2025-09-21_去 ai 味儿");
    await mkdir(folder);
    await writeFile(join(folder, "2025-09-21_去-ai-味儿.mp4"), "v");
    await applyArtifactMoves(folder, "2025-09-21_去 ai 味儿");
    expect(await readdir(folder)).toEqual(["2025-09-21_去 ai 味儿.mp4"]);
  });
});
