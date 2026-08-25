import { describe, expect, it } from "vitest";

import { evaluationFingerprint, evaluationTotal } from "../src/cockpit/evaluation.ts";
import { saveEvaluationRequestSchema } from "../src/cockpit/schemas.ts";

const scores = { audience: 1, pain: 2, differentiation: 3, assets: 4, hook: 5, structure: 0 };

describe("Creator Cockpit evaluation", () => {
  it("creates a stable input fingerprint and recomputes the six-dimension total", () => {
    expect(evaluationFingerprint("topic", "script", "v1")).toBe(evaluationFingerprint("topic", "script", "v1"));
    expect(evaluationFingerprint("topic changed", "script", "v1")).not.toBe(evaluationFingerprint("topic", "script", "v1"));
    expect(evaluationTotal(scores)).toBe(15);
  });

  it("rejects out-of-range scores, a forged total, and unknown fields", () => {
    const input = { contentId: "demo", rubricVersion: "v1", scores, evidence: {}, suggestions: [], inputFingerprint: "hash" };
    expect(() => saveEvaluationRequestSchema.parse({ ...input, scores: { ...scores, hook: 6 } })).toThrow();
    expect(() => saveEvaluationRequestSchema.parse({ ...input, total: 30 })).toThrow();
  });
});
