import type { ContentPublish, OverlayItem, OverlayPublish, PublishPlatform } from "./types.ts";

const COLLECT_PLATFORMS: readonly PublishPlatform[] = [
  "xiaohongshu",
  "douyin",
  "bilibili",
  "wechat",
];

export interface CollectedPost {
  platform: PublishPlatform;
  title: string;
  url?: string;
  remoteId?: string;
  views?: number;
  likes?: number;
  comments?: number;
}

export interface CollectedPlatform {
  platform: PublishPlatform;
  items: CollectedPost[];
  error?: string;
  loginRequired?: boolean;
}

export interface CollectResult {
  collected: CollectedPlatform[];
  spaceClosed?: boolean;
}

export interface PublishMatch {
  id: string;
  platform: PublishPlatform;
  post: CollectedPost;
  score: number;
}

export function normalizeTitle(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

export function titleScore(local: string, remote: string): number {
  const left = normalizeTitle(local);
  const right = normalizeTitle(remote);
  if (left === "" || right === "") return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.88;
  const shorter = left.length < right.length ? left : right;
  const longer = left.length < right.length ? right : left;
  let hits = 0;
  const size = Math.min(4, shorter.length);
  if (size < 2) return 0;
  for (let index = 0; index <= shorter.length - size; index += 1) {
    if (longer.includes(shorter.slice(index, index + size))) hits += 1;
  }
  const possible = shorter.length - size + 1;
  return possible === 0 ? 0 : hits / possible * 0.7;
}

export function matchCollected(
  items: ReadonlyArray<{
    id: string;
    title: string;
    known?: Partial<Record<PublishPlatform, { remoteId?: string; url?: string }>>;
  }>,
  platforms: readonly CollectedPlatform[],
  minScore = 0.85,
): PublishMatch[] {
  const matches: PublishMatch[] = [];
  for (const page of platforms) {
    const used = new Set<string>();
    const keyOf = (post: CollectedPost): string => post.remoteId ?? post.url ?? post.title;
    for (const item of items) {
      let best: PublishMatch | undefined;
      const known = item.known?.[page.platform];
      for (const post of page.items) {
        const key = keyOf(post);
        if (used.has(key)) continue;
        let score = 0;
        if (known?.remoteId !== undefined && post.remoteId === known.remoteId) score = 1;
        else if (known?.url !== undefined && post.url === known.url) score = 0.99;
        else score = titleScore(item.title, post.title);
        if (score < minScore) continue;
        if (best === undefined || score > best.score) {
          best = { id: item.id, platform: page.platform, post, score };
        }
      }
      if (best === undefined) continue;
      used.add(keyOf(best.post));
      matches.push(best);
    }
  }
  return matches;
}

export function knownFromPublish(
  publish: ContentPublish,
): Partial<Record<PublishPlatform, { remoteId?: string; url?: string }>> {
  const known: Partial<Record<PublishPlatform, { remoteId?: string; url?: string }>> = {};
  for (const platform of COLLECT_PLATFORMS) {
    const row = publish[platform];
    if (row === undefined) continue;
    const next: { remoteId?: string; url?: string } = {};
    if (row.remoteId !== undefined && row.remoteId !== "") next.remoteId = row.remoteId;
    if (row.url !== undefined && row.url !== "") next.url = row.url;
    if (next.remoteId !== undefined || next.url !== undefined) known[platform] = next;
  }
  return known;
}

export function dedupeCollectedPosts(items: readonly CollectedPost[]): CollectedPost[] {
  const seen = new Set<string>();
  const out: CollectedPost[] = [];
  for (const item of items) {
    const key = item.remoteId ?? item.url ?? item.title;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function filterCollected(
  result: CollectResult,
  platforms?: readonly PublishPlatform[],
): CollectResult {
  if (platforms === undefined || platforms.length === 0) return result;
  return { collected: result.collected.filter((page) => platforms.includes(page.platform)) };
}

export function filterMatchItems<T extends { id: string }>(
  items: readonly T[],
  id?: string,
): T[] {
  if (id === undefined || id === "") return [...items];
  return items.filter((item) => item.id === id);
}

export interface CollectTarget {
  title: string;
  remoteIds?: string[];
  urls?: string[];
}

export function hitsCollectTarget(item: CollectedPost, target: CollectTarget): boolean {
  if (target.remoteIds?.includes(item.remoteId ?? "")) return true;
  if (target.urls !== undefined && item.url !== undefined && target.urls.includes(item.url)) return true;
  return titleScore(target.title, item.title) >= 0.85;
}

export function collectedHitsTarget(
  items: readonly CollectedPost[],
  targets: readonly CollectTarget[],
): boolean {
  if (targets.length === 0) return false;
  return items.some((item) => targets.some((target) => hitsCollectTarget(item, target)));
}

export function unionCollected(previous: CollectResult | undefined, next: CollectResult): CollectResult {
  if (previous === undefined) return next;
  const byPlatform = new Map(previous.collected.map((page) => [page.platform, page]));
  for (const page of next.collected) {
    const old = byPlatform.get(page.platform);
    if (old === undefined) {
      byPlatform.set(page.platform, page);
      continue;
    }
    const merged: CollectedPlatform = {
      platform: page.platform,
      items: dedupeCollectedPosts([...old.items, ...page.items]),
    };
    if (page.loginRequired === true || old.loginRequired === true) merged.loginRequired = true;
    if (page.error !== undefined && page.error !== "") merged.error = page.error;
    else if (old.error !== undefined && old.error !== "") merged.error = old.error;
    byPlatform.set(page.platform, merged);
  }
  return { collected: [...byPlatform.values()] };
}

export function mergeCollected(
  previous: CollectResult | undefined,
  next: CollectResult,
  replaced?: readonly PublishPlatform[],
): CollectResult {
  if (previous === undefined) return next;
  const keep = previous.collected.filter((page) => {
    if (replaced === undefined || replaced.length === 0) return false;
    return !replaced.includes(page.platform);
  });
  return { collected: [...keep, ...next.collected] };
}

export function formatCount(value: number): string {
  if (!Number.isFinite(value) || value < 0) return "";
  if (value >= 10_000) {
    const wan = value / 10_000;
    const text = wan >= 100 ? String(Math.round(wan)) : wan.toFixed(1).replace(/\.0$/, "");
    return `${text}万`;
  }
  return String(Math.round(value));
}

export const WECHAT_LIST_URL = "https://channels.weixin.qq.com/platform/post/list";

export function usablePublishUrl(candidate?: string, previous?: string): string | undefined {
  if (candidate !== undefined && candidate !== "" && candidate !== WECHAT_LIST_URL) return candidate;
  if (previous !== undefined && previous !== "" && previous !== WECHAT_LIST_URL) return previous;
  return undefined;
}

export function cacheCoversTargets(
  result: CollectResult,
  targets?: readonly CollectTarget[],
  scope: "library" | "partial" = "partial",
): boolean {
  const libraryRequest = targets === undefined || targets.length === 0;
  if (libraryRequest) return scope === "library";
  return collectedHitsTarget(result.collected.flatMap((page) => page.items), targets);
}

export function applyMatchesToOverlay(
  items: Record<string, OverlayItem>,
  matches: readonly PublishMatch[],
  now = Date.now(),
): Record<string, OverlayItem> {
  const next: Record<string, OverlayItem> = { ...items };
  for (const match of matches) {
    const current = next[match.id] ?? {};
    const publish = { ...current.publish };
    const entry: OverlayPublish = { status: "published", syncedAt: now };
    const nextUrl = usablePublishUrl(match.post.url, current.publish?.[match.platform]?.url);
    if (nextUrl !== undefined) entry.url = nextUrl;
    if (match.post.remoteId !== undefined && match.post.remoteId !== "") entry.remoteId = match.post.remoteId;
    if (match.post.views !== undefined) entry.views = match.post.views;
    if (match.post.likes !== undefined) entry.likes = match.post.likes;
    if (match.post.comments !== undefined) entry.comments = match.post.comments;
    publish[match.platform] = entry;
    next[match.id] = { ...current, publish };
  }
  return next;
}

export function copyMetrics(
  from: OverlayPublish,
): Pick<OverlayPublish, "views" | "likes" | "comments" | "syncedAt"> {
  const next: Pick<OverlayPublish, "views" | "likes" | "comments" | "syncedAt"> = {};
  if (from.views !== undefined) next.views = from.views;
  if (from.likes !== undefined) next.likes = from.likes;
  if (from.comments !== undefined) next.comments = from.comments;
  if (from.syncedAt !== undefined) next.syncedAt = from.syncedAt;
  return next;
}

export const COLLECT_PAGES: ReadonlyArray<{ platform: PublishPlatform; url: string }> = [
  { platform: "xiaohongshu", url: "https://creator.xiaohongshu.com/new/note-manager" },
  { platform: "douyin", url: "https://creator.douyin.com/creator-micro/content/manage" },
  { platform: "bilibili", url: "https://member.bilibili.com/platform/upload-manager/article" },
  { platform: "wechat", url: "https://channels.weixin.qq.com/platform/post/list" },
];

export function parseCollectOutput(raw: string): CollectResult {
  const lines = raw.split(/\n/).map((line) => line.trim()).filter((line) => line.startsWith("{"));
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line === undefined) continue;
    try {
      const value = JSON.parse(line) as unknown;
      if (typeof value !== "object" || value === null) continue;
      const collected = (value as { collected?: unknown }).collected;
      if (!Array.isArray(collected)) continue;
      const parsed: CollectResult = {
        collected: collected.flatMap((row): CollectedPlatform[] => {
          if (typeof row !== "object" || row === null) return [];
          const record = row as Record<string, unknown>;
          const platform = record.platform;
          if (!COLLECT_PLATFORMS.includes(platform as PublishPlatform)) return [];
          const items = Array.isArray(record.items)
            ? record.items.flatMap((item): CollectedPost[] => {
              if (typeof item !== "object" || item === null) return [];
              const post = item as Record<string, unknown>;
              if (typeof post.title !== "string" || post.title.trim() === "") return [];
              const next: CollectedPost = {
                platform: platform as PublishPlatform,
                title: post.title.trim(),
              };
              if (typeof post.url === "string" && post.url !== "") next.url = post.url;
              if (typeof post.remoteId === "string" && post.remoteId !== "") next.remoteId = post.remoteId;
              if (typeof post.views === "number") next.views = post.views;
              if (typeof post.likes === "number") next.likes = post.likes;
              if (typeof post.comments === "number") next.comments = post.comments;
              return [next];
            })
            : [];
          const page: CollectedPlatform = {
            platform: platform as PublishPlatform,
            items: dedupeCollectedPosts(items),
          };
          if (typeof record.error === "string" && record.error !== "") page.error = record.error;
          if (record.loginRequired === true) page.loginRequired = true;
          return [page];
        }),
      };
      const spaceClosed = (value as { spaceClosed?: unknown }).spaceClosed;
      if (spaceClosed === true) parsed.spaceClosed = true;
      if (spaceClosed === false) parsed.spaceClosed = false;
      return parsed;
    } catch {
      continue;
    }
  }
  throw new Error("collect-publish produced no JSON");
}
