import { createHash } from "node:crypto";

import type { EvaluationScores } from "./schemas.ts";

export const EVALUATION_RUBRIC_VERSION = "creator-cockpit-six-dimensions-v1";

export const EVALUATION_RUBRIC = {
  audience: "受众是否明确",
  pain: "痛点或需求是否真实",
  differentiation: "是否有差异化",
  assets: "是否有足够案例、素材和证据",
  hook: "开头是否能形成注意力",
  structure: "结构是否清楚且能完成表达",
} as const;

export function evaluationFingerprint(topicNote: string, script: string, rubricVersion = EVALUATION_RUBRIC_VERSION): string {
  return createHash("sha256").update(JSON.stringify({ topicNote, script, rubricVersion })).digest("hex");
}

export function evaluationTotal(scores: EvaluationScores): number {
  return scores.audience
    + scores.pain
    + scores.differentiation
    + scores.assets
    + scores.hook
    + scores.structure;
}
