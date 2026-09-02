import { describe, expect, it } from "vitest";

import { constrainInspectorGeometry } from "../src/client/inspectorGeometry.ts";

describe("content inspector geometry", () => {
  it("keeps at least 480px for conversation in the 1180-1439 tier", () => {
    expect(constrainInspectorGeometry(800, 1280, 280)).toEqual({ docked: true, width: 520 });
    expect(constrainInspectorGeometry(640, 1180, 280)).toEqual({ docked: true, width: 420 });
    expect(constrainInspectorGeometry(320, 1280, 280)).toEqual({ docked: true, width: 420 });
  });

  it("keeps at least 520px for conversation from 1440px", () => {
    expect(constrainInspectorGeometry(800, 1440, 280)).toEqual({ docked: true, width: 640 });
    expect(constrainInspectorGeometry(800, 1520, 280)).toEqual({ docked: true, width: 720 });
    expect(constrainInspectorGeometry(320, 1600, 280)).toEqual({ docked: true, width: 420 });
  });

  it("uses the available content width as a drawer below 1180px", () => {
    expect(constrainInspectorGeometry(640, 1179, 56)).toEqual({ docked: false, width: 1123 });
    expect(constrainInspectorGeometry(640, 1180, 320)).toEqual({ docked: false, width: 860 });
  });
});
