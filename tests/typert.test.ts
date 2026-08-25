import { describe, expect, it } from "vitest";

import { OIL_CREATOR_INVOCATIONS, PACKAGE_NAME, REMOTE_NAMESPACE } from "../src/remote-contract.ts";
import { CREATOR_COCKPIT_INVOCATIONS, CREATOR_COCKPIT_NAMESPACE } from "../src/cockpit/remote-contract.ts";
import { ALL_INVOCATIONS, TYPERT } from "../src/typert.host.ts";

describe("handwritten TYPERT", () => {
  it("matches the package and host face", () => {
    expect(TYPERT.package).toBe(PACKAGE_NAME);
    expect(TYPERT.face).toBe("host");
    expect(TYPERT.invocations).toBe(ALL_INVOCATIONS);
  });

  it("exposes oilCreator methods with zod v4 codecs", () => {
    const methods = OIL_CREATOR_INVOCATIONS.map((item) => item.method);
    expect(methods).toEqual([
      "listContents",
      "getContent",
      "getCoverThumb",
      "getVideoPlayback",
      "getArticleMedia",
      "getSubtitleText",
      "getSettings",
      "getCapabilities",
      "getRevision",
      "setLibraryRoot",
      "refreshCatalog",
      "createContent",
      "setContentStage",
      "setProfile",
      "setScriptRules",
      "bindStudio",
      "openStudio",
      "setPublish",
      "syncPublish",
      "setScript",
      "openSubtitlePreview",
      "startSubtitleBurn",
      "startSubtitleGenerate",
      "startCoverGenerate",
    ]);
    for (const item of OIL_CREATOR_INVOCATIONS) {
      expect(item.service).toBe(REMOTE_NAMESPACE);
      expect(item.namespace).toBe(REMOTE_NAMESPACE);
      expect(item.result.mode).toBe("strict");
      if (item.result.mode !== "strict") continue;
      expect("_zod" in item.result.schema).toBe(true);
      expect(typeof item.result.schema.parse).toBe("function");
    }
  });

  it("keeps Creator Cockpit in a separate remote namespace", () => {
    expect(CREATOR_COCKPIT_INVOCATIONS.map((item) => item.method)).toEqual([
      "getState",
      "getRevision",
      "restoreState",
      "createIdea",
      "updateIdea",
      "deleteIdea",
      "setContentMeta",
      "deleteContentMeta",
      "createGoal",
      "updateGoal",
      "deleteGoal",
      "createFollowerSnapshot",
      "deleteFollowerSnapshot",
      "createScheduleItem",
      "updateScheduleItem",
      "deleteScheduleItem",
      "updateSettings",
      "confirmReview",
      "saveRule",
      "saveTemplate",
      "updateKnowledge",
      "promoteIdea",
    ]);
    for (const item of CREATOR_COCKPIT_INVOCATIONS) {
      expect(item.service).toBe(CREATOR_COCKPIT_NAMESPACE);
      expect(item.namespace).toBe(CREATOR_COCKPIT_NAMESPACE);
      expect(item.result.mode).toBe("strict");
    }
  });
});
