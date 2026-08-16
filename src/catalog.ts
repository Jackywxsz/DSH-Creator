import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import {
  ARTICLE_DIR,
  isSubtitledVideoName,
  pickArticleFile,
  pickPublishPackage,
} from "./artifacts.ts";
import { anyPlatformPublished, emptyBurn, mergePublish, readFolderPublish } from "./publishStatus.ts";
import type {
  ContentFilter,
  ContentSummary,
  LibraryCounts,
  OverlayItem,
  OverlayStore,
  PipelineStage,
  SubtitleCue,
  WorkflowStage,
} from "./types.ts";

const DATE_PREFIX = /^(\d{4}-\d{2}-\d{2})_(.+)$/;
const SKIP_DIRS = new Set([
  ".dsh-oil-creator",
  ".oil-cover",
  "公众号文章",
]);

export function formatDay(now: Date): string {
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function readableTitle(title: string): string {
  return title
    .trim()
    .replace(/[\\/:*?"<>|\n\r]/g, "")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function folderNameForTitle(title: string, now: Date): string {
  const safe = readableTitle(title);
  if (safe === "") throw new Error("empty title");
  return `${formatDay(now)}_${safe}`;
}

export async function createContentFolder(
  libraryRoot: string,
  title: string,
  now = new Date(),
): Promise<{ id: string; folderPath: string }> {
  const root = await stat(libraryRoot).catch(() => undefined);
  if (root === undefined || !root.isDirectory()) {
    throw new Error("library root missing");
  }
  const base = folderNameForTitle(title, now);
  let id = base;
  let suffix = 2;
  while (true) {
    const folderPath = join(libraryRoot, id);
    const exists = await stat(folderPath).then(() => true, () => false);
    if (!exists) {
      await mkdir(folderPath);
      return { id, folderPath };
    }
    id = `${base}-${suffix}`;
    suffix += 1;
  }
}

export function folderDateAndTitle(folderName: string): {
  date?: string;
  title: string;
} {
  const matched = DATE_PREFIX.exec(folderName);
  if (matched === null || matched[1] === undefined || matched[2] === undefined) {
    return { title: folderName };
  }
  return { date: matched[1], title: matched[2] };
}

export function folderDateMs(date: string | undefined): number | undefined {
  if (date === undefined) return undefined;
  const matched = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (matched === null) return undefined;
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = Number(matched[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return undefined;
  const value = new Date(year, month - 1, day).getTime();
  return Number.isFinite(value) ? value : undefined;
}

function hasCover(item: ContentSummary): boolean {
  return item.covers["3x4"] !== undefined
    || item.covers["4x3"] !== undefined
    || item.covers["16x9"] !== undefined;
}

function hasSubtitle(item: ContentSummary): boolean {
  return item.subtitles.srt !== undefined
    || item.subtitles.ass !== undefined
    || item.subtitles.transcript !== undefined
    || item.videoSubtitled !== undefined;
}

export function pipelineOf(item: Omit<ContentSummary, "pipeline" | "workflow">): PipelineStage {
  if (item.hasPublishPackage) return "packaged";
  if (hasCover(item as ContentSummary)) return "covered";
  if (hasSubtitle(item as ContentSummary)) return "subtitled";
  return "raw";
}

export function workflowOf(
  item: Omit<ContentSummary, "pipeline" | "workflow">,
  overlay?: OverlayItem,
): WorkflowStage {
  if (anyPlatformPublished(item.publish)) return "live";
  const recorded = item.videoRaw !== undefined || item.videoSubtitled !== undefined;
  if (recorded) {
    if (hasSubtitle(item as ContentSummary) && hasCover(item as ContentSummary)) return "publish";
    return "finish";
  }
  if (item.studioPath !== undefined || overlay?.studioPath !== undefined) return "cut";
  if (overlay?.waitingForExport === true) return "finish";
  if (overlay?.readyToRecord === true) return "record";
  return "idle";
}

export function countsOf(items: readonly ContentSummary[]): LibraryCounts {
  let cover = 0;
  let subtitle = 0;
  let article = 0;
  for (const item of items) {
    if (hasCover(item)) cover += 1;
    if (hasSubtitle(item)) subtitle += 1;
    if (item.hasArticle) article += 1;
  }
  return { total: items.length, cover, subtitle, article };
}

export function matchesFilter(item: ContentSummary, filter: ContentFilter): boolean {
  if (filter === "cover") return hasCover(item);
  if (filter === "subtitle") return hasSubtitle(item);
  if (filter === "article") return item.hasArticle;
  return true;
}

export function matchesQuery(item: ContentSummary, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (needle === "") return true;
  return item.title.toLowerCase().includes(needle)
    || item.id.toLowerCase().includes(needle)
    || item.tags.some((tag) => tag.toLowerCase().includes(needle));
}

async function readJson(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as unknown;
  } catch {
    return undefined;
  }
}

function stringArrayField(value: unknown, key: string): string[] {
  if (typeof value !== "object" || value === null) return [];
  const field = (value as Record<string, unknown>)[key];
  if (!Array.isArray(field)) return [];
  return field.filter((item): item is string => typeof item === "string" && item.length > 0);
}

async function scanFolder(
  libraryRoot: string,
  folderName: string,
  overlay: OverlayStore,
): Promise<ContentSummary | undefined> {
  const folderPath = join(libraryRoot, folderName);
  const info = await stat(folderPath).catch(() => undefined);
  if (info === undefined || !info.isDirectory()) return undefined;
  if (SKIP_DIRS.has(folderName) || folderName.startsWith(".")) return undefined;

  const entries = await readdir(folderPath, { withFileTypes: true });
  const names = entries.map((entry) => entry.name);
  const { date, title: folderTitle } = folderDateAndTitle(folderName);

  const covers: ContentSummary["covers"] = {};
  const cover3x4 = names.find((name) => name.endsWith("_3x4.png"));
  const cover4x3 = names.find((name) => name.endsWith("_4x3.png"));
  const cover16x9 = names.find((name) => name.endsWith("_16x9.png"));
  if (cover3x4 !== undefined) covers["3x4"] = join(folderPath, cover3x4);
  if (cover4x3 !== undefined) covers["4x3"] = join(folderPath, cover4x3);
  if (cover16x9 !== undefined) covers["16x9"] = join(folderPath, cover16x9);

  const subtitles: ContentSummary["subtitles"] = {};
  const srt = names.find((name) => name.endsWith(".srt"));
  const ass = names.find((name) => name.endsWith(".ass"));
  if (srt !== undefined) subtitles.srt = join(folderPath, srt);
  if (ass !== undefined) subtitles.ass = join(folderPath, ass);

  const workDir = names.find((name) => name.endsWith(".subtitle-work"));
  if (workDir !== undefined) {
    const transcript = join(folderPath, workDir, "subtitle-transcript.json");
    const fallback = join(folderPath, workDir, "transcript.json");
    if (await fileExists(transcript)) subtitles.transcript = transcript;
    else if (await fileExists(fallback)) subtitles.transcript = fallback;
  }

  let videoRaw: string | undefined;
  let videoRawMtime = Number.NEGATIVE_INFINITY;
  let videoSubtitled: string | undefined;
  let videoSubtitledMtime = Number.NEGATIVE_INFINITY;
  for (const name of names) {
    if (!name.endsWith(".mp4") && !name.endsWith(".mov")) continue;
    const path = join(folderPath, name);
    const mtime = await fileMtime(path) ?? Number.NEGATIVE_INFINITY;
    if (isSubtitledVideoName(name)) {
      if (mtime >= videoSubtitledMtime) {
        videoSubtitled = path;
        videoSubtitledMtime = mtime;
      }
    } else if (mtime >= videoRawMtime) {
      videoRaw = path;
      videoRawMtime = mtime;
    }
  }

  const packageName = pickPublishPackage(names);
  const packagePath = packageName === undefined ? undefined : join(folderPath, packageName);
  const packageJson = packagePath === undefined ? undefined : await readJson(packagePath);
  const overlayTitle = overlay.items[folderName]?.title;
  const title = overlayTitle ?? folderTitle;

  const tags = [
    ...stringArrayField(packageJson, "xhsTopics"),
    ...stringArrayField(packageJson, "douyinTopics"),
    ...stringArrayField(packageJson, "bilibiliTags"),
    ...stringArrayField(packageJson, "wechatTags"),
  ].filter((tag, index, all) => all.indexOf(tag) === index);

  const videoMtime = await fileMtime(videoSubtitled ?? videoRaw);
  const recordedAt = videoMtime ?? folderDateMs(date) ?? info.mtimeMs;

  const overlayItem = overlay.items[folderName];
  const studioInFolder = names.find((name) => name.endsWith(".screenstudio"));
  const studioPath = overlayItem?.studioPath
    ?? (studioInFolder === undefined ? undefined : join(folderPath, studioInFolder));

  let articlePath: string | undefined;
  if (names.includes(ARTICLE_DIR)) {
    const articleNames = await readdir(join(folderPath, ARTICLE_DIR)).catch(() => []);
    const articleFile = pickArticleFile(articleNames);
    if (articleFile !== undefined) articlePath = join(folderPath, ARTICLE_DIR, articleFile);
  }

  const draft: Omit<ContentSummary, "pipeline" | "workflow"> = {
    id: folderName,
    folderPath,
    title,
    recordedAt,
    covers,
    subtitles,
    hasPublishPackage: packageJson !== undefined,
    hasArticle: articlePath !== undefined,
    waitingForExport: overlayItem?.waitingForExport === true,
    ...(overlayItem?.exportTimedOut === true ? { exportTimedOut: true } : {}),
    tags,
    ...(date === undefined ? {} : { date }),
    ...(videoRaw === undefined ? {} : { videoRaw }),
    ...(videoSubtitled === undefined ? {} : { videoSubtitled }),
    ...(studioPath === undefined ? {} : { studioPath }),
    ...(articlePath === undefined ? {} : { articlePath }),
    publish: mergePublish(await readFolderPublish(folderPath, names), overlayItem?.publish),
    burn: overlayItem?.burn ?? emptyBurn(),
    subtitleJob: overlayItem?.subtitleJob ?? emptyBurn(),
    coverJob: overlayItem?.coverJob ?? emptyBurn(),
  };

  return {
    ...draft,
    pipeline: pipelineOf(draft),
    workflow: workflowOf(draft, overlay.items[folderName]),
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function fileMtime(path: string | undefined): Promise<number | undefined> {
  if (path === undefined) return undefined;
  const info = await stat(path).catch(() => undefined);
  return info?.mtimeMs;
}

export async function scanLibrary(
  libraryRoot: string,
  overlay: OverlayStore,
): Promise<ContentSummary[]> {
  const root = await stat(libraryRoot).catch(() => undefined);
  if (root === undefined || !root.isDirectory()) return [];

  const entries = await readdir(libraryRoot, { withFileTypes: true });
  const items: ContentSummary[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const item = await scanFolder(libraryRoot, entry.name, overlay);
    if (item !== undefined) items.push(item);
  }
  items.sort((left, right) => {
    if (left.recordedAt !== right.recordedAt) return right.recordedAt - left.recordedAt;
    return basename(right.folderPath).localeCompare(basename(left.folderPath), "zh");
  });
  return items;
}

export async function readTopicNote(folderPath: string): Promise<string> {
  try {
    return await readFile(join(folderPath, "topic.md"), "utf8");
  } catch {
    return "";
  }
}

export async function writeTopicNote(folderPath: string, text: string): Promise<void> {
  const path = join(folderPath, "topic.md");
  if (text.trim() === "") {
    await unlink(path).catch(() => undefined);
    return;
  }
  const body = text.endsWith("\n") ? text : `${text}\n`;
  await writeFile(path, body, "utf8");
}

export async function readScript(folderPath: string): Promise<string> {
  try {
    return await readFile(join(folderPath, "script.md"), "utf8");
  } catch {
    return "";
  }
}

export async function writeScript(folderPath: string, text: string): Promise<void> {
  const path = join(folderPath, "script.md");
  if (text.trim() === "") {
    await unlink(path).catch(() => undefined);
    return;
  }
  const body = text.endsWith("\n") ? text : `${text}\n`;
  await writeFile(path, body, "utf8");
}

export async function readArticle(path: string | undefined): Promise<string> {
  if (path === undefined) return "";
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

export async function readPublishCopy(folderPath: string): Promise<string> {
  const names = await readdir(folderPath).catch(() => []);
  const packageName = pickPublishPackage(names);
  if (packageName === undefined) return "";
  const value = await readJson(join(folderPath, packageName));
  if (typeof value !== "object" || value === null) return "";
  const record = value as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of [
    "title",
    "bilibiliDescription",
    "douyinDescription",
    "wechatDescription",
  ]) {
    const field = record[key];
    if (typeof field === "string" && field.length > 0) parts.push(field);
  }
  return parts.join("\n\n");
}

export function formatCueClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "";
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
  }
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function cuesFromSegments(segments: unknown[]): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  for (const segment of segments) {
    if (typeof segment !== "object" || segment === null) continue;
    const row = segment as Record<string, unknown>;
    const text = typeof row.text === "string" ? row.text.trim() : "";
    if (text === "") continue;
    const start = typeof row.start === "number"
      ? row.start
      : typeof row.startTime === "number" ? row.startTime : undefined;
    const at = start === undefined ? undefined : formatCueClock(start);
    cues.push(at === undefined || at === "" ? { text } : { text, at });
  }
  return cues;
}

export function cuesFromTranscript(value: unknown): SubtitleCue[] {
  if (Array.isArray(value)) return cuesFromSegments(value);
  if (typeof value !== "object" || value === null) return [];
  const record = value as Record<string, unknown>;
  if (Array.isArray(record.segments)) return cuesFromSegments(record.segments);
  const text = typeof record.text === "string" ? record.text.trim() : "";
  return text === "" ? [] : [{ text }];
}

export function cuesFromAss(raw: string): SubtitleCue[] {
  const cues: SubtitleCue[] = [];
  for (const line of raw.replace(/^\uFEFF/, "").split(/\r?\n/)) {
    if (!line.startsWith("Dialogue:")) continue;
    const payload = line.slice("Dialogue:".length).trim();
    const parts = payload.split(",");
    if (parts.length < 10) continue;
    const start = parts[1] ?? "";
    const text = parts.slice(9).join(",")
      .replace(/\{[^}]*\}/g, "")
      .replace(/\\N/g, "\n")
      .replace(/\\n/g, "\n")
      .trim();
    if (text === "") continue;
    const at = formatAssClock(start);
    cues.push(at === undefined ? { text } : { text, at });
  }
  return cues;
}

function formatAssClock(stamp: string): string | undefined {
  const matched = /^(\d+):(\d{2}):(\d{2})/.exec(stamp.trim());
  if (matched === null || matched[1] === undefined || matched[2] === undefined || matched[3] === undefined) {
    return undefined;
  }
  const hours = Number(matched[1]);
  const minutes = matched[2];
  const seconds = matched[3];
  if (hours > 0) return `${hours}:${minutes}:${seconds}`;
  return `${Number(minutes)}:${seconds}`;
}

export function cuesFromSrt(raw: string): SubtitleCue[] {
  const blocks = raw.replace(/^\uFEFF/, "").split(/\n{2,}/);
  const cues: SubtitleCue[] = [];
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== "");
    let at: string | undefined;
    const texts: string[] = [];
    for (const line of lines) {
      const stamp = /^(\d{2}):(\d{2}):(\d{2})[,.]/.exec(line);
      if (stamp !== null) {
        const hours = stamp[1];
        const minutes = stamp[2];
        const seconds = stamp[3];
        if (hours !== undefined && minutes !== undefined && seconds !== undefined) {
          at = hours === "00" ? `${Number(minutes)}:${seconds}` : `${Number(hours)}:${minutes}:${seconds}`;
        }
        continue;
      }
      if (/^\d+$/.test(line)) continue;
      if (line.startsWith("Dialogue:") || line.startsWith("Style:") || line.startsWith("Format:")) continue;
      texts.push(line.replace(/\{[^}]*\}/g, "").replace(/\\N/g, "\n"));
    }
    const text = texts.join("\n").trim();
    if (text === "") continue;
    cues.push(at === undefined ? { text } : { text, at });
  }
  return cues;
}

function subtitlePaths(item: ContentSummary): string[] {
  return [
    item.subtitles.srt,
    item.subtitles.ass,
    item.subtitles.transcript,
  ].filter((path): path is string => path !== undefined);
}

export async function cuesFromFile(path: string): Promise<SubtitleCue[]> {
  try {
    const raw = await readFile(path, "utf8");
    if (path.endsWith(".json")) return cuesFromTranscript(JSON.parse(raw) as unknown);
    if (path.endsWith(".ass")) return cuesFromAss(raw);
    return cuesFromSrt(raw);
  } catch {
    return [];
  }
}

export async function readSubtitleCues(item: ContentSummary): Promise<SubtitleCue[]> {
  for (const path of subtitlePaths(item)) {
    const cues = await cuesFromFile(path);
    if (cues.length > 0) return cues;
  }
  return [];
}

export async function readSubtitleText(item: ContentSummary): Promise<string> {
  const cues = await readSubtitleCues(item);
  return cues.map((cue) => cue.text).join("\n");
}

export function transcriptPlainText(value: unknown): string {
  if (Array.isArray(value)) {
    return cuesFromSegments(value).map((cue) => cue.text).join("\n");
  }
  if (typeof value !== "object" || value === null) return "";
  const record = value as Record<string, unknown>;
  const segments = record.segments;
  if (!Array.isArray(segments)) {
    return typeof record.text === "string" ? record.text : "";
  }
  return segments
    .map((segment) => {
      if (typeof segment !== "object" || segment === null) return "";
      const text = (segment as Record<string, unknown>).text;
      return typeof text === "string" ? text.trim() : "";
    })
    .filter((text) => text.length > 0)
    .join("\n");
}

export function stripSubtitleMarkup(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      if (trimmed === "") return false;
      if (/^\d+$/.test(trimmed)) return false;
      if (/^\d{2}:\d{2}:\d{2}/.test(trimmed)) return false;
      if (trimmed.startsWith("[")) return false;
      if (trimmed.startsWith("Dialogue:") || trimmed.startsWith("Style:") || trimmed.startsWith("Format:")) {
        return false;
      }
      return true;
    })
    .map((line) => line.replace(/\{[^}]*\}/g, "").replace(/\\N/g, "\n"))
    .join("\n")
    .trim();
}

export function coverPathOf(item: ContentSummary): string | undefined {
  return item.covers["3x4"] ?? item.covers["4x3"] ?? item.covers["16x9"];
}
