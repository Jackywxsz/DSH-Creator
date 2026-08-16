import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

import { parseCollectOutput, type CollectResult } from "./collectPublish.ts";

export const COLLECT_CACHE_TTL_MS = 90_000;
export type CollectCacheScope = "library" | "partial";

export interface CollectCacheRecord {
  fetchedAt: number;
  result: CollectResult;
  scope: CollectCacheScope;
}

export function collectCachePath(dataDir: string): string {
  return join(dataDir, "collect-cache.json");
}

export function decodeCollectCacheScope(value: unknown): CollectCacheScope {
  return value === "library" ? "library" : "partial";
}

export function nextCollectCacheScope(
  previous: CollectCacheScope | undefined,
  scoped: boolean,
): CollectCacheScope {
  if (!scoped) return "library";
  return previous === "library" ? "library" : "partial";
}

export async function loadCollectCache(dataDir: string): Promise<CollectCacheRecord | undefined> {
  try {
    const raw = JSON.parse(await readFile(collectCachePath(dataDir), "utf8")) as unknown;
    if (typeof raw !== "object" || raw === null) return undefined;
    const record = raw as Record<string, unknown>;
    if (typeof record.fetchedAt !== "number" || !Number.isFinite(record.fetchedAt)) return undefined;
    const result = parseCollectOutput(JSON.stringify({ collected: record.collected }));
    return {
      fetchedAt: record.fetchedAt,
      result,
      scope: decodeCollectCacheScope(record.scope),
    };
  } catch {
    return undefined;
  }
}

export function cacheIsFresh(fetchedAt: number, now = Date.now(), ttlMs = COLLECT_CACHE_TTL_MS): boolean {
  return now - fetchedAt >= 0 && now - fetchedAt < ttlMs;
}

export async function saveCollectCache(
  dataDir: string,
  result: CollectResult,
  options: { now?: number; scope?: CollectCacheScope } = {},
): Promise<void> {
  const path = collectCachePath(dataDir);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({
    schemaVersion: 2,
    fetchedAt: options.now ?? Date.now(),
    scope: options.scope ?? "partial",
    collected: result.collected,
  }, null, 2)}\n`, "utf8");
}
