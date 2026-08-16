import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

import { defaultSubtitleSkillDir } from "./config.ts";

import { pathExists } from "./artifacts.ts";
import type { ContentSummary } from "./types.ts";

export { defaultSubtitleSkillDir } from "./config.ts";

export async function resolveSubtitleSkill(
  skillDir = process.env.OIL_SUBTITLE_SKILL ?? defaultSubtitleSkillDir(),
): Promise<{ root: string; python: string }> {
  const python = join(skillDir, ".venv/bin/python3");
  const preview = join(skillDir, "scripts/preview_editor.py");
  const burn = join(skillDir, "scripts/burn_subtitles.py");
  const prepare = join(skillDir, "scripts/prepare_subtitles.py");
  if (
    !(await pathExists(python))
    || !(await pathExists(preview))
    || !(await pathExists(burn))
    || !(await pathExists(prepare))
  ) {
    throw new Error("oil-subtitle is not installed");
  }
  return { root: skillDir, python };
}

export function parseSrtClock(stamp: string): number | undefined {
  const matched = /(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})/.exec(stamp.trim());
  if (matched === null) return undefined;
  const hours = Number(matched[1]);
  const minutes = Number(matched[2]);
  const seconds = Number(matched[3]);
  const millis = Number((matched[4] ?? "0").padEnd(3, "0").slice(0, 3));
  if (![hours, minutes, seconds, millis].every((value) => Number.isFinite(value))) return undefined;
  return hours * 3600 + minutes * 60 + seconds + millis / 1000;
}

export function srtToSegments(raw: string): Array<{ start: number; end: number; text: string }> {
  const blocks = raw.replace(/^\uFEFF/, "").split(/\n{2,}/);
  const segments: Array<{ start: number; end: number; text: string }> = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== "");
    let start: number | undefined;
    let end: number | undefined;
    const texts: string[] = [];
    for (const line of lines) {
      const range = /^(\d{2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,.]\d{1,3})/.exec(line);
      if (range !== null && range[1] !== undefined && range[2] !== undefined) {
        start = parseSrtClock(range[1]);
        end = parseSrtClock(range[2]);
        continue;
      }
      if (/^\d+$/.test(line)) continue;
      texts.push(line.replace(/\{[^}]*\}/g, "").replace(/\\N/g, "\n"));
    }
    const text = texts.join("\n").trim();
    if (text === "" || start === undefined || end === undefined) continue;
    segments.push({ start, end, text });
  }
  return segments;
}

export function workDirOf(item: ContentSummary): string {
  if (item.subtitles.transcript !== undefined) return dirname(item.subtitles.transcript);
  const video = item.videoRaw ?? item.videoSubtitled;
  const stem = video === undefined ? item.id : basename(video, extname(video));
  return join(item.folderPath, `${stem}.subtitle-work`);
}

export async function uniqueSubtitledPath(folderPath: string, stem: string): Promise<string> {
  let name = `${stem}_subtitled.mp4`;
  let suffix = 2;
  while (await pathExists(join(folderPath, name))) {
    name = `${stem}_subtitled-${suffix}.mp4`;
    suffix += 1;
  }
  return join(folderPath, name);
}

export async function ensurePreviewTranscript(item: ContentSummary): Promise<string> {
  const work = workDirOf(item);
  const preview = join(work, "preview-transcript.json");
  const candidates = [
    item.subtitles.transcript,
    join(work, "subtitle-transcript.json"),
    join(work, "transcript.json"),
    preview,
  ];
  for (const path of candidates) {
    if (path !== undefined && await pathExists(path)) return path;
  }
  if (item.subtitles.srt === undefined) throw new Error("no subtitle draft");
  await mkdir(work, { recursive: true });
  const raw = await readFile(item.subtitles.srt, "utf8");
  await writeFile(preview, `${JSON.stringify({ segments: srtToSegments(raw) }, null, 2)}\n`);
  return preview;
}

export async function pickPreviewLaunch(item: ContentSummary): Promise<{
  args: string[];
  video: string;
}> {
  const video = item.videoRaw ?? item.videoSubtitled;
  if (video === undefined) throw new Error("no video to preview");
  const manifest = join(workDirOf(item), "subtitle-manifest.json");
  if (await pathExists(manifest)) return { args: [manifest], video };
  return { args: [video, await ensurePreviewTranscript(item)], video };
}

async function newerOrEqual(left: string, right: string): Promise<boolean> {
  const leftInfo = await stat(left).catch(() => undefined);
  const rightInfo = await stat(right).catch(() => undefined);
  if (leftInfo === undefined) return false;
  if (rightInfo === undefined) return true;
  return leftInfo.mtimeMs >= rightInfo.mtimeMs;
}

export async function pickBurnLaunch(item: ContentSummary): Promise<{
  args: string[];
  output: string;
}> {
  const video = item.videoRaw;
  if (video === undefined) throw new Error("no raw video to burn");
  const stem = basename(video, extname(video));
  const output = await uniqueSubtitledPath(item.folderPath, stem);
  const work = workDirOf(item);
  const preview = join(work, "preview-transcript.json");
  const transcript = item.subtitles.transcript
    ?? (await pathExists(preview) ? preview : undefined);
  const srt = item.subtitles.srt;
  const useSrt = srt !== undefined
    && (transcript === undefined || await newerOrEqual(srt, transcript));
  if (useSrt && srt !== undefined) {
    return {
      args: ["--video", video, "--srt-input", srt, "--output", output],
      output,
    };
  }
  if (transcript !== undefined) {
    const args = ["--video", video, "--transcript", transcript, "--output", output];
    const chapters = join(dirname(transcript), "subtitle-chapters.json");
    if (await pathExists(chapters)) args.push("--chapters", chapters);
    return { args, output };
  }
  throw new Error("no subtitle draft");
}

export { pidAlive } from "./processAlive.ts";

export function spawnPython(
  python: string,
  script: string,
  args: readonly string[],
  extraEnv?: Record<string, string>,
): ChildProcess {
  return spawn(python, [script, ...args], {
    env: extraEnv === undefined ? process.env : { ...process.env, ...extraEnv },
    stdio: ["ignore", "ignore", "pipe"],
    detached: true,
  });
}

export async function findFreePort(start = 8765, end = 8785): Promise<number> {
  for (let port = start; port < end; port += 1) {
    if (await portIsFree(port)) return port;
  }
  throw new Error("no free preview port");
}

function portIsFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once("error", () => { resolve(false); });
    server.listen(port, "127.0.0.1", () => {
      server.close(() => { resolve(true); });
    });
  });
}

export async function waitHttp(
  url: string,
  timeoutMs: number,
  signal: AbortSignal,
): Promise<void> {
  const started = Date.now();
  let last: unknown;
  while (Date.now() - started < timeoutMs) {
    signal.throwIfAborted();
    try {
      const response = await fetch(url, { signal });
      if (response.ok) return;
      last = response.status;
    } catch (cause) {
      last = cause;
    }
    await sleep(200, signal);
  }
  throw new Error(`preview did not start: ${String(last)}`);
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(signal.reason ?? new Error("aborted"));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(signal.reason ?? new Error("aborted"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}
