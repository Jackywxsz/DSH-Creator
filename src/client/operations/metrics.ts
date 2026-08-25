import type { CockpitState, Goal } from "../../cockpit/schemas.ts";
import type { ContentSummary } from "../../types.ts";

export function publishedAtOf(item: ContentSummary): number | undefined {
  const values = Object.values(item.publish)
    .filter((entry) => entry.status === "published")
    .map((entry) => entry.publishedAt)
    .filter((value): value is number => typeof value === "number");
  return values.length === 0 ? undefined : Math.min(...values);
}

export function publishedMetricValue(
  item: ContentSummary,
  key: "views" | "likes" | "comments",
  range?: { startAt: number; endAt: number },
): number | undefined {
  const values = Object.values(item.publish)
    .filter((entry) => entry.status === "published"
      && (range === undefined || (entry.publishedAt !== undefined && entry.publishedAt >= range.startAt && entry.publishedAt <= range.endAt)))
    .map((entry) => entry[key])
    .filter((value): value is number => typeof value === "number");
  return values.length === 0 ? undefined : values.reduce((sum, value) => sum + value, 0);
}

export function goalMetricValue(goal: Goal, items: ContentSummary[], state: CockpitState): number | undefined {
  if (goal.metric === "custom") return goal.manualCurrent;
  if (goal.metric === "followers") {
    return state.followerSnapshots
      .filter((entry) => entry.capturedAt >= goal.startAt && entry.capturedAt <= goal.endAt)
      .reduce((latest, entry) => latest === undefined || entry.capturedAt > latest.capturedAt ? entry : latest, undefined as typeof state.followerSnapshots[number] | undefined)
      ?.followers;
  }
  const selected = goal.contentIds.length === 0 ? items : items.filter((item) => goal.contentIds.includes(item.id));
  if (goal.metric === "published") {
    return selected.filter((item) => Object.values(item.publish).some((entry) => entry.status === "published"
      && entry.publishedAt !== undefined
      && entry.publishedAt >= goal.startAt
      && entry.publishedAt <= goal.endAt)).length;
  }
  const key = goal.metric as "views" | "likes" | "comments";
  const values = selected.map((item) => publishedMetricValue(item, key, goal)).filter((value): value is number => value !== undefined);
  return values.length === 0 ? undefined : values.reduce((sum, value) => sum + value, 0);
}
