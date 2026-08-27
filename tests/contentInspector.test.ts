import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import {
  isPublishSyncDisabled,
  selectEnabledPublishPlatforms,
} from "../src/client/publishPlatforms.ts";

describe("content inspector enabled platform contract", () => {
  it("filters platform definitions through enabledPlatforms", () => {
    expect(selectEnabledPublishPlatforms(["wechat", "douyin"]).map((platform) => platform.key))
      .toEqual(["douyin", "wechat"]);
    expect(selectEnabledPublishPlatforms([])).toEqual([]);
  });

  it("disables sync while settings load, while busy, or with no enabled platform", () => {
    expect(isPublishSyncDisabled(undefined, true, ["wechat"])).toBe(true);
    expect(isPublishSyncDisabled("sync", false, ["wechat"])).toBe(true);
    expect(isPublishSyncDisabled(undefined, false, [])).toBe(true);
    expect(isPublishSyncDisabled(undefined, false, ["wechat"])).toBe(false);
  });
});

describe("content inspector creative asset contract", () => {
  it("keeps presentation and cover as first-class tabs and writes article tasks as Markdown", async () => {
    const root = fileURLToPath(new URL("..", import.meta.url));
    const source = await readFile(`${root}/src/client/ContentInspector.tsx`, "utf8");
    const presentationInstruction = await readFile(`${root}/src/client/presentationInstruction.ts`, "utf8");
    expect(source).toContain('["overview", "script", "presentation", "video", "subtitle", "cover", "article"]');
    expect(presentationInstruction).toContain("$jacky-motion2-0");
    expect(source).toContain("输出必须是纯 Markdown");
    expect(source).toContain("/公众号文章/");
  });

  it("keeps the overview focused on the brief and stores assets in their own tabs", async () => {
    const root = fileURLToPath(new URL("..", import.meta.url));
    const source = await readFile(`${root}/src/client/ContentInspector.tsx`, "utf8");
    expect(source).toContain("function OverviewContentBrief");
    expect(source).toContain("function AssetShelf");
    expect(source).not.toContain("function WorkRow");
    expect(source).not.toContain('title={t("inspector.make" as CreatorKey)}');
    expect(source.match(/<AssetShelf/g)?.length).toBe(6);
    expect(source).toContain("detail.videoRaw");
    expect(source).toContain('detail.script.trim() === "" ? {} : { path: `${detail.folderPath}/script.md` }');
    expect(source).toContain("detail.subtitles.srt");
    expect(source).toContain("detail.covers[aspect]");
    expect(source).toContain("detail.articlePath");
  });

  it("keeps cover previews inside the workbench and feedback beside the generate action", async () => {
    const root = fileURLToPath(new URL("..", import.meta.url));
    const source = await readFile(`${root}/src/client/ContentInspector.tsx`, "utf8");
    expect(source).toContain("setCoverPreview(aspect)");
    expect(source).toContain('role="dialog"');
    expect(source).toContain("coverActionState");
    expect(source.indexOf("coverActionState")).toBeLessThan(source.indexOf('className="coverGallery"'));
  });

  it("routes the overview into asset tabs and exposes the external editor path", async () => {
    const root = fileURLToPath(new URL("..", import.meta.url));
    const source = await readFile(`${root}/src/client/ContentInspector.tsx`, "utf8");
    expect(source).toContain("publishProgress(detail.publish");
    expect(source).toContain("contentProgress(detail, publication.completed)");
    expect(source.indexOf('title={t("inspector.publish.statusTitle"')).toBeLessThan(
      source.indexOf('{(currentStep === "publish"'),
    );
    expect(source).toContain("onUseExternalEditor");
    expect(source).toContain("openFolder(detail.folderPath)");
    expect(source).toContain("inspector.step.waitingExportHint");
    expect(source).toContain("waitForExport(detail.id)");
    expect(source).toContain("setContentSkip(detail.id");
  });
});
