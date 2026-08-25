import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { pickCoverLaunch, pickSubtitleWorkflow, pickTranscribeLaunch } from "../src/generate.ts";
import { emptyBurn, emptyPublish } from "../src/publishStatus.ts";
import type { ContentSummary } from "../src/types.ts";

function item(folderPath: string, patch: Partial<ContentSummary> = {}): ContentSummary {
  return {
    id: "2026-08-13_demo",
    folderPath,
    title: "Demo title",
    recordedAt: 1,
    createdMs: 1,
    covers: {},
    subtitles: {},
    presentations: {},
    hasPublishPackage: false,
    hasArticle: false,
    waitingForExport: false,
    tags: [],
    pipeline: "raw",
    workflow: "finish",
    publish: emptyPublish(),
    burn: emptyBurn(),
    subtitleJob: emptyBurn(),
    coverJob: emptyBurn(),
    ...patch,
  };
}

describe("pickTranscribeLaunch", () => {
  it("writes into the subtitle work directory", async () => {
    const folder = await mkdtemp(join(tmpdir(), "oil-asr-"));
    const video = join(folder, "demo.mp4");
    await writeFile(video, "v");
    const launch = await pickTranscribeLaunch(item(folder, { videoRaw: video }));
    expect(launch.args[0]).toBe(video);
    expect(launch.output.endsWith("transcript.json")).toBe(true);
  });
});

describe("pickSubtitleWorkflow", () => {
  it("chains transcribe, review, and prepare without burning", async () => {
    const folder = await mkdtemp(join(tmpdir(), "oil-sub-"));
    const video = join(folder, "demo.mp4");
    await writeFile(video, "v");
    const skill = "/tmp/oil-subtitle";
    const workflow = await pickSubtitleWorkflow(item(folder, { videoRaw: video }), skill);
    expect(workflow.steps).toHaveLength(3);
    expect(workflow.steps[0]?.script.endsWith("bailian_transcribe.py")).toBe(true);
    expect(workflow.steps[1]?.script.endsWith("review_subtitles.py")).toBe(true);
    expect(workflow.steps[2]?.script.endsWith("prepare_subtitles.py")).toBe(true);
    expect(workflow.steps.map((step) => step.env)).toEqual(["subtitle", "subtitle", "none"]);
    expect(workflow.steps[1]?.args).toContain("--frames-dir");
    expect(workflow.steps[2]?.args).toContain("--chapters-output");
    expect(workflow.output.endsWith("subtitle-transcript.json")).toBe(true);
    expect(workflow.steps.some((step) => step.script.endsWith("burn_subtitles.py"))).toBe(false);
  });
});

describe("pickCoverLaunch", () => {
  it("passes title, output root, and optional subtitle", async () => {
    const folder = await mkdtemp(join(tmpdir(), "oil-cover-"));
    const video = join(folder, "demo.mp4");
    const srt = join(folder, "demo.srt");
    await writeFile(video, "v");
    await writeFile(srt, "hi");
    const launch = await pickCoverLaunch(item(folder, {
      videoRaw: video,
      subtitles: { srt },
    }));
    expect(launch.args).toEqual([
      "--video",
      video,
      "--title",
      "Demo title",
      "--output-root",
      folder,
      "--subtitle",
      srt,
    ]);
    expect(launch.output.endsWith("demo_3x4.png")).toBe(true);
  });

  it("uses an extracted cover title when provided", async () => {
    const folder = await mkdtemp(join(tmpdir(), "oil-cover-"));
    const video = join(folder, "demo.mp4");
    await writeFile(video, "v");
    const launch = await pickCoverLaunch(item(folder, { videoRaw: video }), "目前最强的本地工作台");
    expect(launch.args).toContain("目前最强的本地工作台");
    expect(launch.args).not.toContain("Demo title");
    expect(launch.output.endsWith("demo_3x4.png")).toBe(true);
  });
});
