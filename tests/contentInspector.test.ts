import { describe, expect, it } from "vitest";

import {
  isPublishSyncDisabled,
  selectEnabledPublishPlatforms,
} from "../src/client/publishPlatforms.ts";

describe("content inspector enabled platform contract", () => {
  it("filters platform definitions through enabledPlatforms", () => {
    expect(selectEnabledPublishPlatforms(["wechat", "douyin"]).map((platform) => platform.key))
      .toEqual(["douyin", "wechat"]);
    expect(selectEnabledPublishPlatforms([])).toEqual([]);
  });

  it("disables sync while settings load, while busy, or with no enabled platform", () => {
    expect(isPublishSyncDisabled(undefined, true, ["wechat"])).toBe(true);
    expect(isPublishSyncDisabled("sync", false, ["wechat"])).toBe(true);
    expect(isPublishSyncDisabled(undefined, false, [])).toBe(true);
    expect(isPublishSyncDisabled(undefined, false, ["wechat"])).toBe(false);
  });
});
