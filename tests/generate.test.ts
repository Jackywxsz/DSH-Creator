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
  it("chains transcribe, prepare, and burn", async () => {
    const folder = await mkdtemp(join(tmpdir(), "oil-sub-"));
    const video = join(folder, "demo.mp4");
    await writeFile(video, "v");
    const skill = "/tmp/oil-subtitle";
    const workflow = await pickSubtitleWorkflow(item(folder, { videoRaw: video }), skill);
    expect(workflow.steps).toHaveLength(3);
    expect(workflow.steps[0]?.script.endsWith("bailian_transcribe.py")).toBe(true);
    expect(workflow.steps[1]?.script.endsWith("prepare_subtitles.py")).toBe(true);
    expect(workflow.steps[2]?.script.endsWith("burn_subtitles.py")).toBe(true);
    expect(workflow.steps[0]?.env).toBe("subtitle");
    expect(workflow.steps[1]?.env).toBe("none");
    expect(workflow.steps[2]?.env).toBe("none");
    expect(workflow.steps[2]?.args).toContain("--chapters");
    expect(workflow.output.endsWith("demo_subtitled.mp4")).toBe(true);
  });

  it("skips prepare when asked", async () => {
    const folder = await mkdtemp(join(tmpdir(), "oil-sub-"));
    const video = join(folder, "demo.mp4");
    await writeFile(video, "v");
    const workflow = await pickSubtitleWorkflow(
      item(folder, { videoRaw: video }),
      "/tmp/oil-subtitle",
      { prepare: false },
    );
    expect(workflow.steps).toHaveLength(2);
    expect(workflow.steps[1]?.script.endsWith("burn_subtitles.py")).toBe(true);
    expect(workflow.steps[1]?.args.includes("--chapters")).toBe(false);
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
});
