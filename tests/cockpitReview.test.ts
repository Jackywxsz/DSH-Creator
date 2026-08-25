import { describe, expect, it } from "vitest";

import { reviewDueAt, reviewFingerprint } from "../src/cockpit/review.ts";

describe("Creator Cockpit review timing", () => {
  it("keeps an unknown publish timestamp undefined and computes T+3 exactly", () => {
    expect(reviewDueAt(undefined, 3)).toBeUndefined();
    expect(reviewDueAt(1_000, 3)).toBe(1_000 + 3 * 86_400_000);
  });

  it("changes the review fingerprint when metrics change", () => {
    expect(reviewFingerprint({ views: 1 })).not.toBe(reviewFingerprint({ views: 2 }));
  });
});
