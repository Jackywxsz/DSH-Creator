import type { ContentDetail, ContentOptionalStep } from "../types.ts";

export const CONTENT_PROGRESS_STEPS = [
  "topic",
  "script",
  "presentation",
  "video",
  "subtitle",
  "cover",
  "article",
  "publish",
] as const;

export type ContentProgressStep = (typeof CONTENT_PROGRESS_STEPS)[number];
export type ContentProgressStatus = "done" | "skipped" | "current" | "pending";

export interface ContentProgressItem {
  id: ContentProgressStep;
  status: ContentProgressStatus;
}

function plainLine(line: string): string {
  return line
    .replace(/^\s{0,3}(?:#{1,6}\s+|[-*+]\s+|>\s*)/, "")
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, "$1")
    .replace(/[*_`~]/g, "")
    .trim();
}

interface ParsedTopic {
  core: string;
  coreIndex: number;
  coreHeadingIndex: number;
  firstSectionIndex: number;
  note: string;
}

function parseTopic(markdown: string, title: string): ParsedTopic {
  const normalizedTitle = title.trim().toLocaleLowerCase();
  const labels = new Set(["一句话核心", "一句话核心内容", "核心内容"]);
  const lines = markdown.split("\n");
  const preferredCoreHeadingIndex = lines.findIndex((line) => {
    if (!/^\s{0,3}#{1,6}\s+/.test(line)) return false;
    return labels.has(plainLine(line));
  });
  const note: string[] = [];
  let section: "root" | "core" | "other" = "root";
  let core = "";
  let coreIndex = -1;
  let coreHeadingIndex = -1;
  let firstSectionIndex = -1;
  lines.forEach((line, index) => {
    const plain = plainLine(line);
    if (plain === "") return;
    const heading = /^\s{0,3}#{1,6}\s+/.test(line);
    if (heading) {
      if (plain.toLocaleLowerCase() === normalizedTitle) return;
      if (labels.has(plain)) {
        section = index === preferredCoreHeadingIndex ? "core" : "other";
        if (coreHeadingIndex < 0) coreHeadingIndex = index;
        return;
      }
      section = "other";
      if (firstSectionIndex < 0) firstSectionIndex = index;
      note.push(plain);
      return;
    }
    const eligibleCore = preferredCoreHeadingIndex >= 0 ? section === "core" : section === "root" || section === "core";
    if (coreIndex < 0 && eligibleCore) {
      core = plain;
      coreIndex = index;
      return;
    }
    note.push(plain);
  });
  return { core, coreIndex, coreHeadingIndex, firstSectionIndex, note: note.join(" ") };
}

export function readTopicSummary(markdown: string, title: string): { core: string; note: string } {
  const parsed = parseTopic(markdown, title);
  return { core: parsed.core, note: parsed.note };
}

export function replaceTopicCore(markdown: string, title: string, core: string): string {
  const value = core.trim();
  if (value === "") return markdown.endsWith("\n") || markdown === "" ? markdown : `${markdown}\n`;
  if (markdown === "") return `${value}\n`;
  const lines = markdown.split("\n");
  const parsed = parseTopic(markdown, title);
  if (parsed.coreIndex >= 0) {
    const prefix = lines[parsed.coreIndex]?.match(/^(\s{0,3}(?:[-*+]\s+|>\s*))/)?.[1] ?? "";
    lines[parsed.coreIndex] = `${prefix}${value}`;
  } else if (parsed.coreHeadingIndex >= 0) {
    lines.splice(parsed.coreHeadingIndex + 1, 0, value);
  } else if (parsed.firstSectionIndex >= 0) {
    const insertion = lines[parsed.firstSectionIndex - 1] === "" ? [value, ""] : ["", value, ""];
    lines.splice(parsed.firstSectionIndex, 0, ...insertion);
  } else {
    while (lines.at(-1) === "") lines.pop();
    lines.push("", value);
  }
  return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

function hasPresentation(detail: ContentDetail): boolean {
  return detail.presentations["16x9"] !== undefined || detail.presentations["3x4"] !== undefined;
}

function hasSubtitle(detail: ContentDetail): boolean {
  return detail.videoSubtitled !== undefined
    || detail.subtitles.srt !== undefined
    || detail.subtitles.ass !== undefined
    || detail.subtitles.transcript !== undefined;
}

function hasCover(detail: ContentDetail): boolean {
  return detail.covers["3x4"] !== undefined
    || detail.covers["4x3"] !== undefined
    || detail.covers["16x9"] !== undefined;
}

export function contentStepHasAsset(detail: ContentDetail, step: ContentOptionalStep): boolean {
  if (step === "presentation") return hasPresentation(detail);
  if (step === "subtitle") return hasSubtitle(detail);
  return detail.hasArticle || detail.article.trim() !== "";
}

export function contentStepIsSkipped(detail: ContentDetail, step: ContentOptionalStep): boolean {
  return !contentStepHasAsset(detail, step) && (detail.skippedSteps ?? []).includes(step);
}

export function contentProgress(
  detail: ContentDetail,
  publishDone: boolean,
): { current: ContentProgressStep; steps: ContentProgressItem[] } {
  const actual: Record<ContentProgressStep, boolean> = {
    topic: detail.title.trim() !== "",
    script: detail.script.trim() !== "",
    presentation: hasPresentation(detail),
    video: detail.videoRaw !== undefined || detail.videoSubtitled !== undefined,
    subtitle: hasSubtitle(detail),
    cover: hasCover(detail),
    article: detail.hasArticle || detail.article.trim() !== "",
    publish: publishDone,
  };
  let current: ContentProgressStep = "publish";
  let foundCurrent = false;
  const steps = CONTENT_PROGRESS_STEPS.map((id): ContentProgressItem => {
    if (actual[id]) return { id, status: "done" };
    if (id === "presentation" || id === "subtitle" || id === "article") {
      if (contentStepIsSkipped(detail, id)) return { id, status: "skipped" };
    }
    if (!foundCurrent) {
      foundCurrent = true;
      current = id;
      return { id, status: "current" };
    }
    return { id, status: "pending" };
  });
  if (!foundCurrent) current = "publish";
  return { current, steps };
}
