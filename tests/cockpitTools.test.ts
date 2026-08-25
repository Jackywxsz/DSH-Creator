import { describe, expect, it } from "vitest";

import { registerCockpitTools } from "../src/cockpit/tools.ts";

interface RegisteredTool {
  name: string;
  parameters: { properties: Record<string, unknown> };
}

function tools(): Map<string, RegisteredTool> {
  const entries: RegisteredTool[] = [];
  registerCockpitTools({ tools: { register: (tool) => { entries.push(tool as unknown as RegisteredTool); } } }, {} as never);
  return new Map(entries.map((tool) => [tool.name, tool]));
}

describe("Creator Cockpit tool contract", () => {
  it("registers the five Harness-native AI tools", () => {
    expect([...tools().keys()]).toEqual([
      "cockpit_get_script_context",
      "cockpit_get_evaluation_context",
      "cockpit_save_evaluation",
      "cockpit_get_review_context",
      "cockpit_save_review_draft",
    ]);
  });

  it("requires bounded dimension scores and never accepts a model total", () => {
    const parameters = tools().get("cockpit_save_evaluation")?.parameters.properties;
    expect(parameters).not.toHaveProperty("total");
    const scores = parameters?.scores as { properties: Record<string, { type: string; enum: number[] }> };
    expect(Object.keys(scores.properties)).toEqual(["audience", "pain", "differentiation", "assets", "hook", "structure"]);
    expect(Object.values(scores.properties).every((score) => score.type === "integer" && score.enum.join(",") === "0,1,2,3,4,5")).toBe(true);
  });
});
