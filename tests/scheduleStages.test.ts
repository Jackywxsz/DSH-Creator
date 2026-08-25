import { describe, expect, it } from "vitest";

import {
  PRODUCTION_STAGES,
  createStageDragPayload,
  parseStageDragPayload,
} from "../src/client/operations/scheduleStages.ts";

describe("schedule production stages", () => {
  it("keeps the six draggable production stages in order", () => {
    expect(PRODUCTION_STAGES).toEqual([
      "topic",
      "script",
      "recording",
      "editing",
      "publishing",
      "review",
    ]);
  });

  it("round-trips a content stage drag payload", () => {
    const raw = createStageDragPayload("content-1", "editing");
    expect(parseStageDragPayload(raw)).toEqual({ contentId: "content-1", milestone: "editing" });
  });

  it("rejects malformed or unsupported stage payloads", () => {
    expect(parseStageDragPayload("not-json")).toBeUndefined();
    expect(parseStageDragPayload(JSON.stringify({ kind: "stage", contentId: "content-1", milestone: "unknown" }))).toBeUndefined();
  });
});
