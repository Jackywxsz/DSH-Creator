import { describe, expect, it } from "vitest";

import { goalMetricValue, publishedMetricValue } from "../src/client/operations/metrics.ts";
import { emptyCockpitState } from "../src/cockpit/store.ts";

const goal = {
  id: "goal",
  name: "Views",
  metric: "views" as const,
  target: 10,
  startAt: 1,
  endAt: 2,
  contentIds: [],
  primary: false,
  contentTypeTargets: [],
  note: "",
  createdAt: 1,
  updatedAt: 1,
};

describe("goal metric aggregation", () => {
  it("keeps missing platform metrics undefined instead of inventing zero", () => {
    expect(goalMetricValue(goal, [], emptyCockpitState())).toBeUndefined();
  });

  it("treats a known empty published count as zero", () => {
    expect(goalMetricValue({ ...goal, metric: "published" }, [], emptyCockpitState())).toBe(0);
  });

  it("aggregates only known metrics from published platforms", () => {
    const item = { publish: {
      bilibili: { status: "published", views: 12 },
      douyin: { status: "draft", views: 99 },
      xiaohongshu: { status: "published", views: 8 },
    } } as never;
    expect(publishedMetricValue(item, "views")).toBe(20);
    expect(publishedMetricValue(item, "likes")).toBeUndefined();
  });

  it("uses the latest follower snapshot in the goal period even when an imported backup is unordered", () => {
    const state = emptyCockpitState();
    state.followerSnapshots = [
      { id: "newer", followers: 180, capturedAt: 2 },
      { id: "older", followers: 120, capturedAt: 1 },
    ];
    expect(goalMetricValue({ ...goal, metric: "followers" }, [], state)).toBe(180);
  });
});
