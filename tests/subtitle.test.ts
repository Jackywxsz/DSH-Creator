import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { mkdtemp } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { emptyBurn, emptyPublish } from "../src/publishStatus.ts";
import {
  parseSrtClock,
  pickBurnLaunch,
  pickPreviewLaunch,
  srtToSegments,
  uniqueSubtitledPath,
} from "../src/subtitle.ts";
import type { ContentSummary } from "../src/types.ts";

function item(folderPath: string, patch: Partial<ContentSummary> = {}): ContentSummary {
  return {
    id: "2026-08-13_demo",
    folderPath,
    title: "demo",
    recordedAt: 1,
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

describe("parseSrtClock", () => {
  it("parses comma millis", () => {
    expect(parseSrtClock("00:01:08,120")).toBe(68.12);
    expect(parseSrtClock("01:00:00.5")).toBe(3600.5);
  });
});

describe("srtToSegments", () => {
  it("keeps start, end, and text", () => {
    expect(srtToSegments("1\n00:00:00,120 --> 00:00:00,560\n哈喽大家好\n")).toEqual([
      { start: 0.12, end: 0.56, text: "哈喽大家好" },
    ]);
  });
});

describe("uniqueSubtitledPath", () => {
  it("does not overwrite an existing burn", async () => {
    const folder = await mkdtemp(join(tmpdir(), "oil-burn-"));
    await writeFile(join(folder, "demo_subtitled.mp4"), "x");
    expect(await uniqueSubtitledPath(folder, "demo")).toBe(join(folder, "demo_subtitled-2.mp4"));
  });
});

describe("pickBurnLaunch", () => {
  it("burns a reviewed srt as-is", async () => {
    const folder = await mkdtemp(join(tmpdir(), "oil-srt-"));
    const video = join(folder, "demo.mp4");
    const srt = join(folder, "demo.srt");
    await writeFile(video, "v");
    await writeFile(srt, "1\n00:00:00,000 --> 00:00:01,000\nhi\n");
    const launch = await pickBurnLaunch(item(folder, {
      videoRaw: video,
      subtitles: { srt },
    }));
    expect(launch.args).toEqual(["--video", video, "--srt-input", srt, "--output", launch.output]);
    expect(launch.output.endsWith("demo_subtitled.mp4")).toBe(true);
  });

  it("uses a newer transcript instead of an older srt", async () => {
    const folder = await mkdtemp(join(tmpdir(), "oil-tr-"));
    const work = join(folder, "demo.subtitle-work");
    await mkdir(work);
    const video = join(folder, "demo.mp4");
    const srt = join(folder, "demo.srt");
    const transcript = join(work, "transcript.json");
    await writeFile(video, "v");
    await writeFile(srt, "old");
    await writeFile(transcript, JSON.stringify({ segments: [] }));
    const { utimes } = await import("node:fs/promises");
    await utimes(srt, 1_700_000_000, 1_700_000_000);
    await utimes(transcript, 1_780_000_000, 1_780_000_000);
    const launch = await pickBurnLaunch(item(folder, {
      videoRaw: video,
      subtitles: { srt, transcript },
    }));
    expect(launch.args.slice(0, 4)).toEqual(["--video", video, "--transcript", transcript]);
  });
});

describe("pickPreviewLaunch", () => {
  it("builds a transcript from srt when the work dir is empty", async () => {
    const folder = await mkdtemp(join(tmpdir(), "oil-prev-"));
    const video = join(folder, "demo.mp4");
    const srt = join(folder, "demo.srt");
    await writeFile(video, "v");
    await writeFile(srt, "1\n00:00:00,120 --> 00:00:00,560\n哈喽大家好\n");
    const launch = await pickPreviewLaunch(item(folder, {
      videoRaw: video,
      subtitles: { srt },
    }));
    expect(launch.args[0]).toBe(video);
    expect(launch.args[1]?.endsWith("preview-transcript.json")).toBe(true);
  });
});
