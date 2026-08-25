import { defineTool, type ToolDefinition } from "@deepseek-ai/dsh-tools";

import { saveEvaluationRequestSchema, saveReviewDraftRequestSchema } from "./schemas.ts";
import type { CreatorCockpitService } from "./service.ts";

interface ToolsContext {
  tools: { register: (tool: ToolDefinition) => void };
}

const JSON_VALUE = { type: "json" } as const;

function asJson(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as never;
}

function present(title: string, rawInput: unknown) {
  return { card: "generic" as const, title, kind: "other" as const, rawInput };
}

function text(title: string, detail: string) {
  return [{ type: "text" as const, text: `${title}: ${detail}` }];
}

const scoreProperties = {
  audience: { type: "integer" as const, required: true, enum: [0, 1, 2, 3, 4, 5] },
  pain: { type: "integer" as const, required: true, enum: [0, 1, 2, 3, 4, 5] },
  differentiation: { type: "integer" as const, required: true, enum: [0, 1, 2, 3, 4, 5] },
  assets: { type: "integer" as const, required: true, enum: [0, 1, 2, 3, 4, 5] },
  hook: { type: "integer" as const, required: true, enum: [0, 1, 2, 3, 4, 5] },
  structure: { type: "integer" as const, required: true, enum: [0, 1, 2, 3, 4, 5] },
} as const;

const evidenceProperties = {
  audience: { type: "string" as const, required: true },
  pain: { type: "string" as const, required: true },
  differentiation: { type: "string" as const, required: true },
  assets: { type: "string" as const, required: true },
  hook: { type: "string" as const, required: true },
  structure: { type: "string" as const, required: true },
} as const;

export function registerCockpitTools(ctx: ToolsContext, service: CreatorCockpitService): void {
  ctx.tools.register(defineTool({
    name: "cockpit_get_script_context",
    description: "Read the real topic note plus the user-selected Creator Cockpit strategy metadata, active review rules, and reusable templates for one Oil Creator content item. Use this before drafting its script; also read oil_script_rules, then write the result to the real script.md instead of returning an untracked copy.",
    parameters: { contentId: { type: "string", required: true, description: "Real Oil Creator content id." } },
    output: { schema: JSON_VALUE, render: (_args, value) => text("Script context", (value as { contentId: string }).contentId) },
    presentCall: (args) => present("Read script context", args),
    execute: (args, exec) => service.getScriptContext({ id: args.contentId }, exec.signal).then(asJson),
  }));

  ctx.tools.register(defineTool({
    name: "cockpit_get_evaluation_context",
    description: "Read the minimum real topic, script, six-dimension rubric, rubric version, and input fingerprint required to evaluate one Creator Cockpit content item.",
    parameters: { contentId: { type: "string", required: true, description: "Real Oil Creator content id." } },
    output: { schema: JSON_VALUE, render: (_args, value) => text("Evaluation context", (value as { contentId: string }).contentId) },
    presentCall: (args) => present("Read evaluation context", args),
    execute: (args, exec) => service.getEvaluationContext({ id: args.contentId }, exec.signal).then(asJson),
  }));

  ctx.tools.register(defineTool({
    name: "cockpit_save_evaluation",
    description: "Save one evidence-based six-dimension evaluation after reading its current context. Scores must be integers from 0 to 5. The Host verifies the fingerprint and recomputes total; do not provide a total.",
    parameters: {
      contentId: { type: "string", required: true },
      rubricVersion: { type: "string", required: true },
      inputFingerprint: { type: "string", required: true },
      scores: { type: "object", required: true, additionalProperties: false, properties: scoreProperties },
      evidence: { type: "object", required: true, additionalProperties: false, properties: evidenceProperties },
      suggestions: { type: "array", required: true, items: { type: "string" } },
    },
    output: { schema: JSON_VALUE, render: (_args, value) => text("Evaluation saved", `revision ${(value as { revision: number }).revision}`) },
    presentCall: (args) => present("Save evaluation", args),
    execute: (args, exec) => service.saveEvaluation(saveEvaluationRequestSchema.parse(args), exec.signal).then(asJson),
  }));

  ctx.tools.register(defineTool({
    name: "cockpit_get_review_context",
    description: "Read the minimum real content facts, publishing metrics, supplemental metrics, latest evaluation, and fingerprint needed to draft a post-publication review.",
    parameters: { contentId: { type: "string", required: true, description: "Real Oil Creator content id." } },
    output: { schema: JSON_VALUE, render: (_args, value) => text("Review context", (value as { contentId: string }).contentId) },
    presentCall: (args) => present("Read review context", args),
    execute: (args, exec) => service.getReviewContext({ id: args.contentId }, exec.signal).then(asJson),
  }));

  ctx.tools.register(defineTool({
    name: "cockpit_save_review_draft",
    description: "Save an AI-generated review as a draft only. The Host verifies the context fingerprint. This tool cannot confirm the review or write a formal rule/template; those actions require explicit UI confirmation.",
    parameters: {
      contentId: { type: "string", required: true },
      inputFingerprint: { type: "string", required: true },
      rating: { type: "integer", enum: [1, 2, 3, 4, 5] },
      analysis: { type: "string", required: true },
      learnedRule: { type: "string" },
    },
    output: { schema: JSON_VALUE, render: (_args, value) => text("Review draft saved", `revision ${(value as { revision: number }).revision}`) },
    presentCall: (args) => present("Save review draft", args),
    execute: (args, exec) => service.saveReviewDraft(saveReviewDraftRequestSchema.parse(args), exec.signal).then(asJson),
  }));
}
