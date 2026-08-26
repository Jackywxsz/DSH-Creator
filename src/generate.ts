import { mkdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { defaultCoverSkillDir, resolveSkillDir } from "./config.ts";

import { pathExists } from "./artifacts.ts";
import { resolveVenvPython, systemPythonCommand } from "./runtimePaths.ts";
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
  platform: NodeJS.Platform = process.platform,
  jackySkillDir = process.env.JACKY_COVER_SKILL_DIR,
): Promise<{ root: string; jackyRoot: string; python: string; script: string }> {
  const oilScript = join(skillDir, "scripts/generate_oil_cover.py");
  if (!(await pathExists(oilScript))) {
    throw new Error("Jacky Cover 的底层生成依赖未安装。请先完成封面能力配置后重试。");
  }
  const jackyRoot = resolveSkillDir("", "jacky-cover", jackySkillDir);
  const jackyFiles = [
    join(jackyRoot, "references", "visual-system.md"),
    join(jackyRoot, "scripts", "validate_run.py"),
    join(jackyRoot, "assets", "jacky-reference-front.jpg"),
    join(jackyRoot, "assets", "jacky-reference-casual.jpg"),
    join(skillDir, "docs", "showcase", "gallery.png"),
  ];
  if (!(await Promise.all(jackyFiles.map(pathExists))).every(Boolean)) {
    throw new Error("未安装 jacky-cover，无法应用 Jacky 品牌规则。");
  }
  const script = fileURLToPath(new URL("../scripts/generate_jacky_cover.py", import.meta.url));
  if (!(await pathExists(script))) throw new Error("Jacky Cover 适配脚本缺失：" + script);
  const python = await resolveVenvPython(skillDir, platform) ?? systemPythonCommand(platform);
  return { root: skillDir, jackyRoot, python, script };
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
