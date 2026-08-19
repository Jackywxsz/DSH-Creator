import { describe, expect, it } from "vitest";

import { COLLECT_PAGES } from "../src/collectPublish.ts";
import { PUBLISH_PLATFORM_DEFINITIONS, PUBLISH_PLATFORMS } from "../src/platforms.ts";
import { PUBLISH_PLATFORMS as STATUS_PLATFORMS } from "../src/publishStatus.ts";

describe("shared publishing platform contract", () => {
  it("derives the key list and collection pages from one definition", () => {
    expect(PUBLISH_PLATFORMS).toEqual(Object.keys(PUBLISH_PLATFORM_DEFINITIONS));
    expect(STATUS_PLATFORMS).toBe(PUBLISH_PLATFORMS);
    expect(COLLECT_PAGES).toEqual(PUBLISH_PLATFORMS.map((platform) => ({
      platform,
      url: PUBLISH_PLATFORM_DEFINITIONS[platform].collectUrl,
    })));
  });
});
