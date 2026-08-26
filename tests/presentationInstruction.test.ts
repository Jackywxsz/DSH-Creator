import { describe, expect, it } from "vitest";

import { buildPresentationInstruction } from "../src/client/presentationInstruction.ts";

describe("presentation instruction aspect contract", () => {
  it.each([
    ["16x9", "16:9", "/演示/demo-16x9.html", "3:4"],
    ["3x4", "3:4", "/演示/demo-3x4.html", "16:9"],
  ] as const)("keeps %s label and output path paired", (aspect, label, output, otherLabel) => {
    const instruction = buildPresentationInstruction({
      id: "demo",
      folderPath: "/content/demo",
      aspect,
    });

    expect(instruction).toContain(`画幅选择 ${label}。`);
    expect(instruction).toContain(output);
    expect(instruction).not.toContain(`画幅选择 ${otherLabel}。`);
  });
});
