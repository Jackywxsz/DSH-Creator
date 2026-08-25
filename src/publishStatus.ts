import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import { PUBLISH_PLATFORMS } from "./platforms.ts";
import type {
  BurnJob,
  ContentPublish,
  OverlayItem,
  OverlayPublish,
  PlatformPublish,
  PublishMark,
  PublishPlatform,
} from "./types.ts";

export { PUBLISH_PLATFORMS } from "./platforms.ts";

const FILE_TO_PLATFORM: Record<string, PublishPlatform> = Object.fromEntries([
  ...PUBLISH_PLATFORMS.map((platform) => [platform, platform]),
  ["wechat_channels", "wechat"],
]) as Record<string, PublishPlatform>;

export function anyPlatformPublished(publish: ContentPublish): boolean {
  return PUBLISH_PLATFORMS.some((key) => publish[key].status === "published");
}

export function emptyPublish(): ContentPublish {
  const result = {} as ContentPublish;
  for (const platform of PUBLISH_PLATFORMS) {
    result[platform] = { status: "unpublished", source: "none" };
  }
  return result;
}

export function emptyBurn(): BurnJob {
  return { status: "idle" };
}

export function nextPublishMark(status: PublishMark): PublishMark {
  if (status === "unpublished") return "draft";
  if (status === "draft") return "published";
  return "unpublished";
}

export function isPublishMark(value: unknown): value is PublishMark {
  return value === "unpublished" || value === "draft" || value === "published";
}

export function isPublishPlatform(value: unknown): value is PublishPlatform {
  return PUBLISH_PLATFORMS.includes(value as PublishPlatform);
}

export function mapPublisherStatus(raw: string): PublishMark {
  const value = raw.trim().toLowerCase();
  if (value === "published" || value === "live" || value === "posted") return "published";
  if (value === "ready" || value === "draft" || value === "prepared") return "draft";
  return "unpublished";
}

export function pickAutoPublishName(names: readonly string[]): string | undefined {
  if (names.includes("auto-publish.json")) return "auto-publish.json";
  return names.find((name) => name.endsWith(".auto-publish.json"));
}

function platformFromField(field: unknown, fallback: PublishMark): PlatformPublish {
  if (typeof field === "string") {
    return { status: mapPublisherStatus(field), source: "publisher" };
  }
  if (typeof field !== "object" || field === null) {
    return { status: fallback, source: "publisher" };
  }
  const record = field as Record<string, unknown>;
  const status = typeof record.status === "string"
    ? mapPublisherStatus(record.status)
    : fallback;
  const url = typeof record.url === "string" && record.url.trim() !== ""
    ? record.url.trim()
    : undefined;
  const rawPublishedAt = record.publishedAt ?? record.published_at ?? record.publishTime ?? record.publish_time;
  const numericPublishedAt = typeof rawPublishedAt === "string"
    ? Number.isFinite(Number(rawPublishedAt)) ? Number(rawPublishedAt) : Date.parse(rawPublishedAt)
    : Number(rawPublishedAt);
  const publishedAt = status === "published" && Number.isFinite(numericPublishedAt) && numericPublishedAt > 0
    ? numericPublishedAt < 1_000_000_000_000 ? Math.round(numericPublishedAt * 1000) : Math.round(numericPublishedAt)
    : undefined;
  return {
    status,
    source: "publisher",
    ...(url === undefined ? {} : { url }),
    ...(publishedAt === undefined ? {} : { publishedAt }),
  };
}

export function publishFromAutoPublish(value: unknown): ContentPublish {
  const result = emptyPublish();
  if (typeof value !== "object" || value === null) return result;
  const publisher = (value as Record<string, unknown>).publisher;
  if (typeof publisher !== "object" || publisher === null) return result;
  const record = publisher as Record<string, unknown>;
  const platforms = record.platforms;
  if (typeof platforms !== "object" || platforms === null) return result;
  for (const [rawKey, field] of Object.entries(platforms as Record<string, unknown>)) {
    const key = FILE_TO_PLATFORM[rawKey];
    if (key === undefined) continue;
    result[key] = platformFromField(field, "unpublished");
  }
  return result;
}

export function mergePublish(
  file: ContentPublish,
  overlay?: OverlayItem["publish"],
): ContentPublish {
  if (overlay === undefined) return file;
  const result = {} as ContentPublish;
  for (const key of PUBLISH_PLATFORMS) {
    result[key] = file[key];
    const over = overlay[key];
    if (over === undefined) continue;
    const source = over.syncedAt === undefined ? "overlay" : "sync";
    result[key] = {
      status: over.status,
      source,
      ...copyOverlayFields(over),
    };
  }
  return result;
}

export function decodeOverlayPublish(raw: unknown): OverlayItem["publish"] {
  if (typeof raw !== "object" || raw === null) return undefined;
  const source = raw as Record<string, unknown>;
  const next: NonNullable<OverlayItem["publish"]> = {};
  for (const key of PUBLISH_PLATFORMS) {
    const field = source[key];
    if (typeof field !== "object" || field === null) continue;
    const record = field as Record<string, unknown>;
    if (!isPublishMark(record.status)) continue;
    const entry: OverlayPublish = { status: record.status };
    if (typeof record.url === "string" && record.url.trim() !== "") {
      entry.url = record.url.trim();
    }
    if (typeof record.remoteId === "string" && record.remoteId.trim() !== "") {
      entry.remoteId = record.remoteId.trim();
    }
    if (typeof record.views === "number" && Number.isFinite(record.views)) entry.views = record.views;
    if (typeof record.likes === "number" && Number.isFinite(record.likes)) entry.likes = record.likes;
    if (typeof record.comments === "number" && Number.isFinite(record.comments)) {
      entry.comments = record.comments;
    }
    if (typeof record.publishedAt === "number" && Number.isFinite(record.publishedAt)) {
      entry.publishedAt = record.publishedAt;
    }
    if (typeof record.syncedAt === "number" && Number.isFinite(record.syncedAt)) {
      entry.syncedAt = record.syncedAt;
    }
    next[key] = entry;
  }
  return Object.keys(next).length === 0 ? undefined : next;
}

export function decodeBurnJob(raw: unknown): BurnJob | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const record = raw as Record<string, unknown>;
  if (record.status !== "running" && record.status !== "done" && record.status !== "error") {
    return undefined;
  }
  const next: BurnJob = { status: record.status };
  if (typeof record.startedAt === "number" && Number.isFinite(record.startedAt)) {
    next.startedAt = record.startedAt;
  }
  if (typeof record.output === "string" && record.output !== "") next.output = record.output;
  if (typeof record.error === "string" && record.error !== "") next.error = record.error;
  if (typeof record.pid === "number" && Number.isInteger(record.pid) && record.pid > 0) {
    next.pid = record.pid;
  }
  return next;
}

export function patchOverlayPublish(
  current: OverlayItem["publish"],
  platform: PublishPlatform,
  status: PublishMark,
  url?: string,
  now = Date.now(),
): NonNullable<OverlayItem["publish"]> {
  const next: NonNullable<OverlayItem["publish"]> = { ...current };
  const previous = current?.[platform];
  const entry: OverlayPublish = {
    status,
    ...(previous === undefined ? {} : copyOverlayMetrics(previous)),
  };
  if (status === "published") entry.publishedAt = previous?.publishedAt ?? now;
  if (status === "published" && url !== undefined && url.trim() !== "") {
    entry.url = url.trim();
  } else if (previous?.url !== undefined && status === "published") {
    entry.url = previous.url;
  }
  next[platform] = entry;
  return next;
}

function copyOverlayMetrics(over: OverlayPublish): Pick<
  OverlayPublish,
  "remoteId" | "views" | "likes" | "comments" | "publishedAt" | "syncedAt"
> {
  const next: Pick<OverlayPublish, "remoteId" | "views" | "likes" | "comments" | "publishedAt" | "syncedAt"> = {};
  if (over.remoteId !== undefined) next.remoteId = over.remoteId;
  if (over.views !== undefined) next.views = over.views;
  if (over.likes !== undefined) next.likes = over.likes;
  if (over.comments !== undefined) next.comments = over.comments;
  if (over.publishedAt !== undefined) next.publishedAt = over.publishedAt;
  if (over.syncedAt !== undefined) next.syncedAt = over.syncedAt;
  return next;
}

function copyOverlayFields(over: OverlayPublish): Pick<
  OverlayPublish,
  "url" | "remoteId" | "views" | "likes" | "comments" | "publishedAt" | "syncedAt"
> {
  const next: Pick<OverlayPublish, "url" | "remoteId" | "views" | "likes" | "comments" | "publishedAt" | "syncedAt"> = {};
  if (over.url !== undefined) next.url = over.url;
  if (over.remoteId !== undefined) next.remoteId = over.remoteId;
  if (over.views !== undefined) next.views = over.views;
  if (over.likes !== undefined) next.likes = over.likes;
  if (over.comments !== undefined) next.comments = over.comments;
  if (over.publishedAt !== undefined) next.publishedAt = over.publishedAt;
  if (over.syncedAt !== undefined) next.syncedAt = over.syncedAt;
  return next;
}

export async function readFolderPublish(
  folderPath: string,
  names?: readonly string[],
): Promise<ContentPublish> {
  const list = names ?? await readdir(folderPath).catch(() => []);
  const name = pickAutoPublishName(list);
  if (name === undefined) return emptyPublish();
  try {
    const value = JSON.parse(await readFile(join(folderPath, name), "utf8")) as unknown;
    return publishFromAutoPublish(value);
  } catch {
    return emptyPublish();
  }
}
