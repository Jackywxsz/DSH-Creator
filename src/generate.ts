import { mkdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";

import { defaultCoverSkillDir } from "./config.ts";

import { pathExists } from "./artifacts.ts";
import { workDirOf } from "./subtitle.ts";
import type { ContentSummary } from "./types.ts";

export type GenerateEnvKind = "subtitle" | "cover" | "none";

export interface GenerateStep {
  script: string;
  args: string[];
  output: string;
  env: GenerateEnvKind;
}

export { defaultCoverSkillDir } from "./config.ts";

export async function resolveCoverSkill(
  skillDir = process.env.OIL_COVER_SKILL ?? defaultCoverSkillDir(),
): Promise<{ root: string; python: string; script: string }> {
  const script = join(skillDir, "scripts/generate_oil_cover.py");
  if (!(await pathExists(script))) {
    throw new Error("未安装 oil-cover。执行 git clone https://github.com/oil-oil/oil-cover ~/.agents/skills/oil-cover 后重试。");
  }
  const venv = join(skillDir, ".venv/bin/python3");
  const python = await pathExists(venv) ? venv : "python3";
  return { root: skillDir, python, script };
}

export async function pickTranscribeLaunch(item: ContentSummary): Promise<{
  args: string[];
  output: string;
  script: string;
}> {
  const video = item.videoRaw ?? item.videoSubtitled;
  if (video === undefined) throw new Error("no video to transcribe");
  const work = workDirOf(item);
  await mkdir(work, { recursive: true });
  const output = join(work, "transcript.json");
  const raw = join(work, "bailian_asr.json");
  return {
    script: "scripts/bailian_transcribe.py",
    output,
    args: [video, "--output", output, "--raw-output", raw, "--language", "zh"],
  };
}

export async function pickSubtitleWorkflow(
  item: ContentSummary,
  skillRoot: string,
): Promise<{ steps: GenerateStep[]; output: string }> {
  const video = item.videoRaw ?? item.videoSubtitled;
  if (video === undefined) throw new Error("no video to transcribe");
  const work = workDirOf(item);
  await mkdir(work, { recursive: true });
  const transcript = join(work, "transcript.json");
  const reviewed = join(work, "reviewed-transcript.json");
  const prepared = join(work, "subtitle-transcript.json");
  const chapters = join(work, "subtitle-chapters.json");
  const manifest = join(work, "subtitle-manifest.json");
  const cache = join(work, "cache");
  return {
    output: prepared,
    steps: [
      {
        script: join(skillRoot, "scripts/bailian_transcribe.py"),
        args: [video, "--output", transcript, "--raw-output", join(work, "bailian_asr.json"), "--language", "zh"],
        output: transcript,
        env: "subtitle",
      },
      {
        script: join(skillRoot, "scripts/review_subtitles.py"),
        args: [
          "--video",
          video,
          "--transcript",
          transcript,
          "--output",
          reviewed,
          "--report",
          join(work, "subtitle-review.json"),
          "--frames-dir",
          join(work, "review-frames"),
        ],
        output: reviewed,
        env: "subtitle",
      },
      {
        script: join(skillRoot, "scripts/prepare_subtitles.py"),
        args: [
          "--transcript",
          reviewed,
          "--video",
          video,
          "--output",
          prepared,
          "--chapters-output",
          chapters,
          "--manifest-output",
          manifest,
          "--work-dir",
          cache,
          "--resume",
        ],
        output: prepared,
        env: "none",
      },
    ],
  };
}

export async function pickCoverLaunch(
  item: ContentSummary,
  title?: string,
): Promise<{
  args: string[];
  output: string;
}> {
  const video = item.videoRaw ?? item.videoSubtitled;
  if (video === undefined) throw new Error("no video to cover");
  const coverTitle = title?.trim() === "" ? undefined : title?.trim();
  const args = [
    "--video",
    video,
    "--title",
    coverTitle ?? item.title,
    "--output-root",
    item.folderPath,
  ];
  const subtitle = item.subtitles.srt ?? item.subtitles.transcript;
  if (subtitle !== undefined) args.push("--subtitle", subtitle);
  const stem = basename(video, extname(video));
  return {
    args,
    output: join(item.folderPath, `${stem}_3x4.png`),
  };
}
