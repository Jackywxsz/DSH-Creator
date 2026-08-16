import { mkdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";

import { defaultCoverSkillDir } from "./config.ts";

import { pathExists } from "./artifacts.ts";
import { uniqueSubtitledPath, workDirOf } from "./subtitle.ts";
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
  if (!(await pathExists(script))) throw new Error("oil-cover is not installed");
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
  options: { prepare: boolean } = { prepare: true },
): Promise<{ steps: GenerateStep[]; output: string }> {
  const video = item.videoRaw ?? item.videoSubtitled;
  if (video === undefined) throw new Error("no video to transcribe");
  const rawVideo = item.videoRaw;
  if (rawVideo === undefined) throw new Error("no raw video to burn");
  const work = workDirOf(item);
  await mkdir(work, { recursive: true });
  const transcript = join(work, "transcript.json");
  const prepared = join(work, "subtitle-transcript.json");
  const chapters = join(work, "subtitle-chapters.json");
  const manifest = join(work, "subtitle-manifest.json");
  const cache = join(work, "cache");
  const stem = basename(rawVideo, extname(rawVideo));
  const output = await uniqueSubtitledPath(item.folderPath, stem);
  const steps: GenerateStep[] = [
    {
      script: join(skillRoot, "scripts/bailian_transcribe.py"),
      args: [video, "--output", transcript, "--raw-output", join(work, "bailian_asr.json"), "--language", "zh"],
      output: transcript,
      env: "subtitle",
    },
  ];
  if (options.prepare) {
    steps.push({
      script: join(skillRoot, "scripts/prepare_subtitles.py"),
      args: [
        "--transcript",
        transcript,
        "--video",
        rawVideo,
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
      env: "cover",
    });
  }
  const burnTranscript = options.prepare ? prepared : transcript;
  const burnArgs = ["--video", rawVideo, "--transcript", burnTranscript, "--output", output];
  if (options.prepare) burnArgs.push("--chapters", chapters);
  steps.push({
    script: join(skillRoot, "scripts/burn_subtitles.py"),
    args: burnArgs,
    output,
    env: "none",
  });
  return { steps, output };
}

export async function pickCoverLaunch(item: ContentSummary): Promise<{
  args: string[];
  output: string;
}> {
  const video = item.videoRaw ?? item.videoSubtitled;
  if (video === undefined) throw new Error("no video to cover");
  const args = [
    "--video",
    video,
    "--title",
    item.title,
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
