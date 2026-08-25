import { createHash } from "node:crypto";

import type { ContentSummary } from "../types.ts";

export function publishedAtOf(item: ContentSummary): number | undefined {
  const timestamps = Object.values(item.publish)
    .filter((entry) => entry.status === "published")
    .map((entry) => entry.publishedAt)
    .filter((value): value is number => typeof value === "number");
  return timestamps.length === 0 ? undefined : Math.min(...timestamps);
}

export function reviewDueAt(publishedAt: number | undefined, delayDays: number): number | undefined {
  return publishedAt === undefined ? undefined : publishedAt + delayDays * 24 * 60 * 60 * 1_000;
}

export function reviewFingerprint(input: unknown): string {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}
